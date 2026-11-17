// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {DuckWekRoles} from "./DuckWekRoles.sol";
import {IPartRenderer, IRender} from "./render/IRender.sol";

/// @title DuckWek part licence (ERC-721, v2). Each token is a permanent licence for one part type.
/// @notice Plan 0013 §4.4. A part type is immutable: name, price, slot, colour and stats are written once. A price change
///         is a new type. Stats live in an append-only registry of keys, so the engine can add a stat later without a
///         contract change (an old type reads 0 for a key added after it). One licence per type per wallet.
///         Primary sale goes through the Vault (85% creator / 15% protocol); platform parts are created with the protocol
///         address as `creator`. Secondary sales carry a 5% ERC-2981 royalty to the creator.
contract PartNFT is ERC721, ERC2981, DuckWekRoles {
    struct PartType {
        string name;
        address creator;
        uint96 price; // USDC, 6 decimals
        uint8 slot; // 0 Wings, 1 Tail, 2 Bill
        uint24 color; // fill colour used by the NFT art
        bool platform;
        bool active;
    }

    uint96 public constant ROYALTY_BPS = 500;
    int8 public constant MAX_STAT = 2;
    int8 public constant MAX_SUM = 2;
    uint8 public constant SLOTS = 3;
    uint256 public constant MAX_NAME = 32;

    PartType[] internal _types;
    bytes32[] public statKeys; // append-only
    mapping(bytes32 => bool) public isStat;
    mapping(uint256 typeId => mapping(bytes32 key => int8)) internal _stat;
    mapping(uint256 tokenId => uint256 typeId) public typeOf;
    mapping(address holder => mapping(uint256 typeId => uint256 tokenId)) public licenseOf; // 0 = none
    uint256 public nextId = 1;
    address public minter; // the Vault, set once
    IPartRenderer public renderer;
    bool public rendererLocked;

    event PartTypeCreated(uint256 indexed typeId, address indexed creator, bool platform, uint96 price, uint8 slot);
    event PartLicensed(address indexed to, uint256 indexed tokenId, uint256 indexed typeId);
    event PartActive(uint256 indexed typeId, bool active);
    event StatAdded(bytes32 indexed key);
    event MinterSet(address minter);
    event RendererSet(address renderer);
    event RendererLockedSet();

    error NotMinter();
    error UnknownPart();
    error MinterAlreadySet();
    error BadSlot();
    error BadName();
    error BadStats();
    error UnknownStat(bytes32 key);
    error AlreadyLicensed(address holder, uint256 typeId);
    error NotAllowed();
    error RendererIsLocked();
    error NoRenderer();

    constructor(address owner_) ERC721("DuckWek Part License", "WEKPART") DuckWekRoles(owner_) {
        _addStat("speed");
        _addStat("weight");
        _addStat("boost");
    }

    // ---------------------------------------------------------------- admin

    /// @notice Set once. A second call reverts, so the owner can never re-point minting.
    function setMinter(address minter_) external onlyOwner {
        if (minter != address(0)) revert MinterAlreadySet();
        minter = minter_;
        emit MinterSet(minter_);
    }

    function addStat(bytes32 key) external onlyOwner {
        _addStat(key);
    }

    function setRenderer(address r) external onlyOwner {
        if (rendererLocked) revert RendererIsLocked();
        renderer = IPartRenderer(r);
        emit RendererSet(r);
    }

    function lockRenderer() external onlyOwner {
        rendererLocked = true;
        emit RendererLockedSet();
    }

    function _addStat(bytes32 key) internal {
        require(key != bytes32(0) && !isStat[key], "bad stat key");
        isStat[key] = true;
        statKeys.push(key);
        emit StatAdded(key);
    }

    // ---------------------------------------------------------------- catalog

    function typeCount() external view returns (uint256) {
        return _types.length;
    }

    function statCount() external view returns (uint256) {
        return statKeys.length;
    }

    function partType(uint256 typeId) external view returns (PartType memory) {
        if (typeId >= _types.length) revert UnknownPart();
        return _types[typeId];
    }

    function statOf(uint256 typeId, bytes32 key) external view returns (int8) {
        if (typeId >= _types.length) revert UnknownPart();
        return _stat[typeId][key];
    }

    /// @notice Platform part, created with `creator` (the protocol / treasury address) as its owner.
    function createPlatformPart(
        address creator,
        string calldata name,
        uint96 price,
        uint8 slot,
        uint24 color,
        bytes32[] calldata keys,
        int8[] calldata values
    ) external onlyOwner returns (uint256) {
        return _createType(creator, name, price, slot, color, keys, values, true);
    }

    /// @notice Creator part, published by the operator after review (the creator never needs MON).
    function createCreatorPart(
        address creator,
        string calldata name,
        uint96 price,
        uint8 slot,
        uint24 color,
        bytes32[] calldata keys,
        int8[] calldata values
    ) external onlyOperator whenNotPaused returns (uint256) {
        return _createType(creator, name, price, slot, color, keys, values, false);
    }

    function _createType(
        address creator,
        string calldata name,
        uint96 price,
        uint8 slot,
        uint24 color,
        bytes32[] calldata keys,
        int8[] calldata values,
        bool platform
    ) internal returns (uint256 typeId) {
        if (slot >= SLOTS) revert BadSlot();
        if (bytes(name).length == 0 || bytes(name).length > MAX_NAME) revert BadName();
        if (keys.length != values.length || keys.length == 0) revert BadStats();
        typeId = _types.length;
        int256 sum;
        for (uint256 i; i < keys.length; ++i) {
            if (!isStat[keys[i]]) revert UnknownStat(keys[i]);
            for (uint256 j; j < i; ++j) if (keys[j] == keys[i]) revert BadStats(); // no duplicate key
            if (values[i] > MAX_STAT) revert BadStats();
            sum += values[i];
            _stat[typeId][keys[i]] = values[i];
        }
        if (sum > MAX_SUM) revert BadStats();
        _types.push(PartType(name, creator, price, slot, color, platform, true));
        emit PartTypeCreated(typeId, creator, platform, price, slot);
    }

    /// @notice Discontinue or re-open a type. Platform part: owner. Creator part: its creator or the owner (moderation).
    ///         Licences already sold stay valid; only new sales stop.
    function setActive(uint256 typeId, bool active) external {
        if (typeId >= _types.length) revert UnknownPart();
        PartType storage t = _types[typeId];
        bool allowed = msg.sender == owner() || (!t.platform && msg.sender == t.creator);
        if (!allowed) revert NotAllowed();
        t.active = active;
        emit PartActive(typeId, active);
    }

    // ---------------------------------------------------------------- licences

    function mintLicense(address to, uint256 typeId) external returns (uint256 id) {
        if (msg.sender != minter) revert NotMinter();
        if (typeId >= _types.length || !_types[typeId].active) revert UnknownPart();
        id = nextId++;
        typeOf[id] = typeId;
        _mint(to, id);
        _setTokenRoyalty(id, _types[typeId].creator, ROYALTY_BPS);
        emit PartLicensed(to, id, typeId);
    }

    /// @dev One licence per type per wallet: minting or transferring into a holder of the same type reverts.
    function _update(address to, uint256 id, address auth) internal override returns (address from) {
        uint256 typeId = typeOf[id];
        if (to != address(0)) {
            if (licenseOf[to][typeId] != 0) revert AlreadyLicensed(to, typeId);
        }
        from = super._update(to, id, auth);
        if (from != address(0)) licenseOf[from][typeId] = 0;
        if (to != address(0)) licenseOf[to][typeId] = id;
    }

    // ---------------------------------------------------------------- art

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        if (address(renderer) == address(0)) revert NoRenderer();
        uint256 typeId = typeOf[id];
        PartType memory p = _types[typeId];
        uint256 n = statKeys.length;
        int8[] memory values = new int8[](n);
        for (uint256 i; i < n; ++i) values[i] = _stat[typeId][statKeys[i]];
        return renderer.partURI(id, IRender.PartView(p.name, p.slot, p.color, statKeys, values));
    }

    function supportsInterface(bytes4 id) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(id);
    }
}
