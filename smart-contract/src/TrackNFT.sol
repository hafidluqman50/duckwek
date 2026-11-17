// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {DuckWekRoles} from "./DuckWekRoles.sol";
import {SegmentLib} from "./render/SegmentLib.sol";
import {ITrackRenderer, IRender, ITrackNames} from "./render/IRender.sol";

contract TrackNFT is ERC721, EIP712, DuckWekRoles, ITrackNames {
    struct Track {
        string name;
        address creator;
        uint96 rent;
        bool platform;
        bool active;
        uint32 version;
        uint8 editsUsed;
    }

    struct Layout {
        bytes segments;
        uint16 laps;
    }

    uint96 public constant PLATFORM_RENT = 1_000_000;
    uint8 public constant MAX_EDITS = 3;
    uint16 public constant MAX_LAPS = 9;
    uint256 public constant MAX_NAME = 32;

    bytes32 public constant LAYOUT_TYPEHASH =
        keccak256("LayoutUpdate(uint256 id,bytes32 segmentsHash,uint16 laps,uint32 version,uint256 deadline)");
    bytes32 public constant CREATE_TYPEHASH = keccak256(
        "CreateTrack(address creator,bytes32 nameHash,bytes32 segmentsHash,uint16 laps,uint96 rent,uint256 nonce,uint256 deadline)"
    );

    mapping(uint256 => Track) internal _tracks;
    mapping(uint256 => mapping(uint32 => Layout)) internal _layouts;
    mapping(address => mapping(uint256 => bool)) public usedNonce;
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

    // ─── Views ───

    function track(uint256 trackId) external view returns (Track memory) {
        _requireOwned(trackId);
        return _tracks[trackId];
    }

    function rentOf(uint256 trackId) public view returns (uint96) {
        _requireOwned(trackId);
        return _tracks[trackId].platform ? PLATFORM_RENT : _tracks[trackId].rent;
    }

    function versionOf(uint256 trackId) external view returns (uint32) {
        _requireOwned(trackId);
        return _tracks[trackId].version;
    }

    function nameOf(uint256 trackId) external view returns (string memory) {
        _requireOwned(trackId);
        return _tracks[trackId].name;
    }

    function layoutOf(uint256 trackId, uint32 version) external view returns (bytes memory segments, uint16 laps) {
        _requireOwned(trackId);
        Layout storage storedLayout = _layouts[trackId][version];
        return (storedLayout.segments, storedLayout.laps);
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ─── Create ───

    function createPlatformTrack(address creator, string calldata name, bytes calldata segments, uint16 laps)
        external
        onlyOwner
        returns (uint256 trackId)
    {
        trackId = _create(creator, name, segments, laps, 0, true);
    }

    // slither-disable-start timestamp
    function createCreatorTrack(
        address creator,
        string calldata name,
        bytes calldata segments,
        uint16 laps,
        uint96 rent,
        uint256 nonce,
        uint256 deadline,
        bytes calldata creatorSignature
    ) external onlyOperator whenNotPaused returns (uint256 trackId) {
        if (block.timestamp > deadline) revert Expired();

        if (usedNonce[creator][nonce]) revert NonceUsed();

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    CREATE_TYPEHASH, creator, keccak256(bytes(name)), keccak256(segments), laps, rent, nonce, deadline
                )
            )
        );
        if (!SignatureChecker.isValidSignatureNow(creator, digest, creatorSignature)) revert BadSignature();

        usedNonce[creator][nonce] = true;
        trackId = _create(creator, name, segments, laps, rent, false);
    }
    // slither-disable-end timestamp

    function _create(
        address creator,
        string calldata name,
        bytes calldata segments,
        uint16 laps,
        uint96 rent,
        bool platform
    ) internal returns (uint256 trackId) {
        if (bytes(name).length == 0 || bytes(name).length > MAX_NAME) revert BadName();

        if (laps == 0 || laps > MAX_LAPS) revert BadLaps();

        SegmentLib.validate(segments);
        trackId = nextId++;
        _tracks[trackId] = Track(name, creator, rent, platform, true, 1, 0);
        _layouts[trackId][1] = Layout(segments, laps);
        _mint(creator, trackId);
        emit TrackCreated(trackId, creator, platform, platform ? PLATFORM_RENT : rent, laps);
        emit LayoutPublished(trackId, 1, laps, keccak256(abi.encode(segments, laps)));
    }

    // ─── Layout edits ───

    // slither-disable-start timestamp
    function publishLayout(
        uint256 trackId,
        bytes calldata segments,
        uint16 laps,
        uint256 deadline,
        bytes calldata holderSignature
    ) external onlyOperator whenNotPaused {
        address holder = ownerOf(trackId);
        Track storage currentTrack = _tracks[trackId];
        if (block.timestamp > deadline) revert Expired();

        uint32 newVersion = currentTrack.version + 1;
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(LAYOUT_TYPEHASH, trackId, keccak256(segments), laps, newVersion, deadline))
        );
        if (!SignatureChecker.isValidSignatureNow(holder, digest, holderSignature)) revert BadSignature();

        _publish(trackId, currentTrack, segments, laps);
    }
    // slither-disable-end timestamp

    function publishPlatformLayout(uint256 trackId, bytes calldata segments, uint16 laps) external onlyOwner {
        _requireOwned(trackId);
        Track storage currentTrack = _tracks[trackId];
        if (!currentTrack.platform) revert NotAllowed();

        _publish(trackId, currentTrack, segments, laps);
    }

    function _publish(uint256 trackId, Track storage currentTrack, bytes calldata segments, uint16 laps) internal {
        if (currentTrack.editsUsed >= MAX_EDITS) revert NoMoreEdits();

        if (laps == 0 || laps > MAX_LAPS) revert BadLaps();

        SegmentLib.validate(segments);
        currentTrack.editsUsed += 1;
        currentTrack.version += 1;
        _layouts[trackId][currentTrack.version] = Layout(segments, laps);
        emit LayoutPublished(trackId, currentTrack.version, laps, keccak256(abi.encode(segments, laps)));
    }

    // ─── Holder controls ───

    function setRent(uint256 trackId, uint96 rent) external {
        if (msg.sender != ownerOf(trackId)) revert NotHolder();

        Track storage currentTrack = _tracks[trackId];
        if (currentTrack.platform) revert PlatformRentFixed();

        currentTrack.rent = rent;
        emit RentSet(trackId, rent);
    }

    function setActive(uint256 trackId, bool active) external {
        address holder = ownerOf(trackId);
        if (msg.sender != holder && msg.sender != owner()) revert NotAllowed();

        _tracks[trackId].active = active;
        emit TrackActive(trackId, active);
    }

    // ─── Art ───

    function setRenderer(address renderer_) external onlyOwner {
        if (rendererLocked) revert RendererIsLocked();

        renderer = ITrackRenderer(renderer_);
        emit RendererSet(renderer_);
    }

    function lockRenderer() external onlyOwner {
        rendererLocked = true;
        emit RendererLockedSet();
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        if (address(renderer) == address(0)) revert NoRenderer();

        Track storage currentTrack = _tracks[tokenId];
        Layout storage storedLayout = _layouts[tokenId][currentTrack.version];
        return renderer.trackURI(
            tokenId,
            IRender.TrackView(
                currentTrack.name,
                currentTrack.platform,
                currentTrack.platform ? PLATFORM_RENT : currentTrack.rent,
                currentTrack.version,
                storedLayout.segments,
                storedLayout.laps
            )
        );
    }
}
