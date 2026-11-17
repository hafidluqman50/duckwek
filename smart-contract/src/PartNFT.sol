// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {DuckWekRoles} from "./DuckWekRoles.sol";
import {IPartRenderer, IRender} from "./render/IRender.sol";

contract PartNFT is ERC721, ERC2981, DuckWekRoles {
    struct PartType {
        string name;
        address creator;
        uint96 price;
        uint8 slot;
        uint24 color;
        bool platform;
        bool active;
    }

    uint96 public constant ROYALTY_BPS = 500;
    int8 public constant MAX_STAT = 2;
    int8 public constant MAX_SUM = 2;
    uint8 public constant SLOTS = 3;
    uint256 public constant MAX_NAME = 32;

    PartType[] internal _types;
    bytes32[] public statKeys;
    mapping(bytes32 => bool) public isStat;
    mapping(uint256 typeId => mapping(bytes32 key => int8)) internal _stat;
    mapping(uint256 tokenId => uint256 typeId) public typeOf;
    mapping(address holder => mapping(uint256 typeId => uint256 tokenId)) public licenseOf;
    uint256 public nextId = 1;
    address public minter;
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
    error ZeroAddress();

    constructor(address owner_) ERC721("DuckWek Part License", "WEKPART") DuckWekRoles(owner_) {
        _addStat("speed");
        _addStat("weight");
        _addStat("boost");
    }

    // ─── Admin ───

    function setMinter(address minter_) external onlyOwner {
        if (minter_ == address(0)) revert ZeroAddress();

        if (minter != address(0)) revert MinterAlreadySet();

        minter = minter_;
        emit MinterSet(minter_);
    }

    function addStat(bytes32 key) external onlyOwner {
        _addStat(key);
    }

    function setRenderer(address renderer_) external onlyOwner {
        if (rendererLocked) revert RendererIsLocked();

        renderer = IPartRenderer(renderer_);
        emit RendererSet(renderer_);
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

    // ─── Catalog ───

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
        int256 sum = 0;
        for (uint256 keyIndex; keyIndex < keys.length; ++keyIndex) {
            if (!isStat[keys[keyIndex]]) revert UnknownStat(keys[keyIndex]);

            for (uint256 earlierKeyIndex; earlierKeyIndex < keyIndex; ++earlierKeyIndex) {
                if (keys[earlierKeyIndex] == keys[keyIndex]) revert BadStats();
            }

            if (values[keyIndex] > MAX_STAT) revert BadStats();

            sum += values[keyIndex];
            _stat[typeId][keys[keyIndex]] = values[keyIndex];
        }

        if (sum > MAX_SUM) revert BadStats();

        _types.push(PartType(name, creator, price, slot, color, platform, true));
        emit PartTypeCreated(typeId, creator, platform, price, slot);
    }

    function setActive(uint256 typeId, bool active) external {
        if (typeId >= _types.length) revert UnknownPart();

        PartType storage part = _types[typeId];
        bool allowed = msg.sender == owner() || (!part.platform && msg.sender == part.creator);
        if (!allowed) revert NotAllowed();

        part.active = active;
        emit PartActive(typeId, active);
    }

    // ─── Licences ───

    function mintLicense(address to, uint256 typeId) external returns (uint256 tokenId) {
        if (msg.sender != minter) revert NotMinter();

        if (typeId >= _types.length || !_types[typeId].active) revert UnknownPart();

        tokenId = nextId++;
        typeOf[tokenId] = typeId;
        _mint(to, tokenId);
        _setTokenRoyalty(tokenId, _types[typeId].creator, ROYALTY_BPS);
        emit PartLicensed(to, tokenId, typeId);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        uint256 typeId = typeOf[tokenId];
        if (to != address(0)) {
            if (licenseOf[to][typeId] != 0) revert AlreadyLicensed(to, typeId);
        }

        from = super._update(to, tokenId, auth);
        if (from != address(0)) licenseOf[from][typeId] = 0;

        if (to != address(0)) licenseOf[to][typeId] = tokenId;
    }

    // ─── Art ───

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        if (address(renderer) == address(0)) revert NoRenderer();

        uint256 typeId = typeOf[tokenId];
        PartType memory part = _types[typeId];
        uint256 keyCount = statKeys.length;
        int8[] memory values = new int8[](keyCount);
        for (uint256 keyIndex; keyIndex < keyCount; ++keyIndex) {
            values[keyIndex] = _stat[typeId][statKeys[keyIndex]];
        }

        return renderer.partURI(tokenId, IRender.PartView(part.name, part.slot, part.color, statKeys, values));
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
