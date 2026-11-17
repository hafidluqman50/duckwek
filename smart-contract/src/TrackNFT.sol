// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {DuckWekRoles} from "./DuckWekRoles.sol";
import {SegmentLib} from "./render/SegmentLib.sol";
import {ITrackRenderer, IRender, ITrackNames} from "./render/IRender.sol";

/// @title DuckWek circuit (ERC-721, v2). Hosts rent a circuit when they create a room.
/// @notice Plan 0013 §4.5. The income of a room (rent and every ticket) goes to `ownerOf(trackId)` at the moment of the
///         order, so selling a circuit NFT moves its income. Platform circuits are minted to the protocol address and their
///         rent is fixed. A creator circuit's holder sets its own rent for new rooms. The road is a list of segments
///         (`SegmentLib`); each edit publishes a new version (max `MAX_EDITS`, lifetime), old versions stay readable and a room
///         keeps the version it was created on. Layouts are published by the operator after review, carrying the holder's
///         EIP-712 signature, so the holder never needs MON.
contract TrackNFT is ERC721, EIP712, DuckWekRoles, ITrackNames {
    struct Track {
        string name;
        address creator;
        uint96 rent; // creator circuits only; platform circuits use PLATFORM_RENT
        bool platform;
        bool active;
        uint32 version; // latest layout version, starts at 1
        uint8 editsUsed;
    }

    struct Layout {
        bytes segments;
        uint16 laps;
    }

    uint96 public constant PLATFORM_RENT = 1_000_000; // 1 USDC
    uint8 public constant MAX_EDITS = 3;
    uint16 public constant MAX_LAPS = 9;
    uint256 public constant MAX_NAME = 32;

    bytes32 public constant LAYOUT_TYPEHASH =
        keccak256("LayoutUpdate(uint256 id,bytes32 segmentsHash,uint16 laps,uint32 version,uint256 deadline)");
    bytes32 public constant CREATE_TYPEHASH =
        keccak256("CreateTrack(address creator,bytes32 nameHash,bytes32 segmentsHash,uint16 laps,uint96 rent,uint256 nonce,uint256 deadline)");

    mapping(uint256 => Track) internal _tracks;
    mapping(uint256 => mapping(uint32 => Layout)) internal _layouts;
    mapping(address => mapping(uint256 => bool)) public usedNonce; // creator track creation
    uint256 public nextId = 1;
    ITrackRenderer public renderer;
    bool public rendererLocked;

    event TrackCreated(uint256 indexed id, address indexed creator, bool platform, uint96 rent, uint16 laps);
    event LayoutPublished(uint256 indexed id, uint32 indexed version, uint16 laps, bytes32 layoutHash);
    event RentSet(uint256 indexed id, uint96 rent);
    event TrackActive(uint256 indexed id, bool active);
    event RendererSet(address renderer);
    event RendererLockedSet();

    error NotHolder();
    error NotAllowed();
    error BadName();
    error BadLaps();
    error BadSignature();
    error Expired();
    error NonceUsed();
    error NoMoreEdits();
    error PlatformRentFixed();
    error RendererIsLocked();
    error NoRenderer();

    constructor(address owner_) ERC721("DuckWek Track", "WEKTRACK") EIP712("DuckWekTrack", "1") DuckWekRoles(owner_) {}

    // ---------------------------------------------------------------- views

    function track(uint256 id) external view returns (Track memory) {
        _requireOwned(id);
        return _tracks[id];
    }

    function rentOf(uint256 id) public view returns (uint96) {
        _requireOwned(id);
        return _tracks[id].platform ? PLATFORM_RENT : _tracks[id].rent;
    }

    function versionOf(uint256 id) external view returns (uint32) {
        _requireOwned(id);
        return _tracks[id].version;
    }

    function nameOf(uint256 id) external view returns (string memory) {
        _requireOwned(id);
        return _tracks[id].name;
    }

    function layoutOf(uint256 id, uint32 v) external view returns (bytes memory segments, uint16 laps) {
        _requireOwned(id);
        Layout storage l = _layouts[id][v];
        return (l.segments, l.laps);
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ---------------------------------------------------------------- create

    /// @notice Platform circuit, minted to `creator` (the protocol / treasury address). Rent is fixed at 1 USDC.
    function createPlatformTrack(address creator, string calldata name, bytes calldata segments, uint16 laps)
        external
        onlyOwner
        returns (uint256 id)
    {
        id = _create(creator, name, segments, laps, 0, true);
    }

    // slither-disable-start timestamp -- deadlines and the session end are compared with block.timestamp on purpose
    /// @notice Creator circuit, published by the operator after review with the creator's signature.
    function createCreatorTrack(
        address creator,
        string calldata name,
        bytes calldata segments,
        uint16 laps,
        uint96 rent,
        uint256 nonce,
        uint256 deadline,
        bytes calldata creatorSig
    ) external onlyOperator whenNotPaused returns (uint256 id) {
        if (block.timestamp > deadline) revert Expired();
        if (usedNonce[creator][nonce]) revert NonceUsed();
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(CREATE_TYPEHASH, creator, keccak256(bytes(name)), keccak256(segments), laps, rent, nonce, deadline))
        );
        if (!SignatureChecker.isValidSignatureNow(creator, digest, creatorSig)) revert BadSignature();
        usedNonce[creator][nonce] = true;
        id = _create(creator, name, segments, laps, rent, false);
    }
    // slither-disable-end timestamp

    function _create(address creator, string calldata name, bytes calldata segments, uint16 laps, uint96 rent, bool platform)
        internal
        returns (uint256 id)
    {
        if (bytes(name).length == 0 || bytes(name).length > MAX_NAME) revert BadName();
        if (laps == 0 || laps > MAX_LAPS) revert BadLaps();
        SegmentLib.validate(segments);
        id = nextId++;
        _tracks[id] = Track(name, creator, rent, platform, true, 1, 0);
        _layouts[id][1] = Layout(segments, laps);
        _mint(creator, id);
        emit TrackCreated(id, creator, platform, platform ? PLATFORM_RENT : rent, laps);
        emit LayoutPublished(id, 1, laps, keccak256(abi.encode(segments, laps)));
    }

    // ---------------------------------------------------------------- layout edits (D5: max 3, lifetime)

    // slither-disable-start timestamp -- deadlines and the session end are compared with block.timestamp on purpose
    /// @notice New layout version for a creator circuit, after review, carrying the holder's `LayoutUpdate` signature.
    ///         The nonce is the new version number, so a signature cannot be replayed.
    function publishLayout(uint256 id, bytes calldata segments, uint16 laps, uint256 deadline, bytes calldata holderSig)
        external
        onlyOperator
        whenNotPaused
    {
        address holder = ownerOf(id);
        Track storage t = _tracks[id];
        if (block.timestamp > deadline) revert Expired();
        uint32 newVersion = t.version + 1;
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(LAYOUT_TYPEHASH, id, keccak256(segments), laps, newVersion, deadline))
        );
        if (!SignatureChecker.isValidSignatureNow(holder, digest, holderSig)) revert BadSignature();
        _publish(id, t, segments, laps);
    }
    // slither-disable-end timestamp

    /// @notice Same edit for a platform circuit: the owner (protocol) publishes it. Counts against the same limit.
    function publishPlatformLayout(uint256 id, bytes calldata segments, uint16 laps) external onlyOwner {
        _requireOwned(id);
        Track storage t = _tracks[id];
        if (!t.platform) revert NotAllowed();
        _publish(id, t, segments, laps);
    }

    function _publish(uint256 id, Track storage t, bytes calldata segments, uint16 laps) internal {
        if (t.editsUsed >= MAX_EDITS) revert NoMoreEdits();
        if (laps == 0 || laps > MAX_LAPS) revert BadLaps();
        SegmentLib.validate(segments);
        t.editsUsed += 1;
        t.version += 1;
        _layouts[id][t.version] = Layout(segments, laps);
        emit LayoutPublished(id, t.version, laps, keccak256(abi.encode(segments, laps)));
    }

    // ---------------------------------------------------------------- holder controls

    /// @notice The holder sets the rent for new rooms of a creator circuit. Platform rent is fixed; the owner cannot set it.
    function setRent(uint256 id, uint96 rent) external {
        if (msg.sender != ownerOf(id)) revert NotHolder();
        Track storage t = _tracks[id];
        if (t.platform) revert PlatformRentFixed();
        t.rent = rent;
        emit RentSet(id, rent);
    }

    /// @notice Close or re-open a circuit for new rooms. Holder, or the owner (moderation).
    function setActive(uint256 id, bool active) external {
        address holder = ownerOf(id);
        if (msg.sender != holder && msg.sender != owner()) revert NotAllowed();
        _tracks[id].active = active;
        emit TrackActive(id, active);
    }

    // ---------------------------------------------------------------- art

    function setRenderer(address r) external onlyOwner {
        if (rendererLocked) revert RendererIsLocked();
        renderer = ITrackRenderer(r);
        emit RendererSet(r);
    }

    function lockRenderer() external onlyOwner {
        rendererLocked = true;
        emit RendererLockedSet();
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        if (address(renderer) == address(0)) revert NoRenderer();
        Track storage t = _tracks[id];
        Layout storage l = _layouts[id][t.version];
        return renderer.trackURI(
            id, IRender.TrackView(t.name, t.platform, t.platform ? PLATFORM_RENT : t.rent, t.version, l.segments, l.laps)
        );
    }
}
