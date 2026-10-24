// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {DuckWekRoles} from "./DuckWekRoles.sol";

/// @title DuckWek part license (ERC-721). Each token is a permanent license for one part type.
/// @notice Primary sale goes through the Vault with one rule for every part: 85% creator / 15% protocol. Platform parts are
///         created with the protocol address as creator, so the same rule credits the protocol alone.
///         Secondary sales carry a 5% ERC-2981 royalty to the part's creator (marketplace: roadmap).
contract PartNFT is ERC721, ERC2981, DuckWekRoles {
    using Strings for uint256;

    struct PartType {
        string name;
        address creator;
        uint96 price; // USDC, 6 decimals
        int8 speed;
        int8 weight;
        int8 boost;
        bool platform;
        bool active;
    }

    uint96 public constant ROYALTY_BPS = 500;

    PartType[] internal _types;
    mapping(uint256 tokenId => uint256 typeId) public typeOf;
    uint256 public nextId = 1;
    address public minter; // the Vault
    bool public ugcOpen;

    event PartTypeCreated(uint256 indexed typeId, address indexed creator, bool platform, uint96 price);
    event PartLicensed(address indexed to, uint256 indexed tokenId, uint256 indexed typeId);

    error NotMinter();
    error UnknownPart();
    error UgcClosed();

    constructor(address owner_) ERC721("DuckWek Part License", "WEKPART") DuckWekRoles(owner_) {}

    function setMinter(address minter_) external onlyOwner {
        minter = minter_;
    }

    function setUgcOpen(bool open) external onlyOwner {
        ugcOpen = open;
    }

    function typeCount() external view returns (uint256) {
        return _types.length;
    }

    function partType(uint256 typeId) external view returns (PartType memory) {
        if (typeId >= _types.length) revert UnknownPart();
        return _types[typeId];
    }

    /// @notice Platform part, created with `creator` (the protocol / treasury address) as its owner.
    function createPlatformPart(address creator, string calldata name, uint96 price, int8 speed, int8 weight, int8 boost)
        external
        onlyOwner
        returns (uint256)
    {
        return _createType(creator, name, price, speed, weight, boost, true);
    }

    /// @notice Creator-made part (UGC, roadmap). Stats are bounded so no part wins on every track.
    function createPart(string calldata name, uint96 price, int8 speed, int8 weight, int8 boost)
        external
        whenNotPaused
        returns (uint256)
    {
        if (!ugcOpen) revert UgcClosed();
        require(speed + weight + boost <= 2 && speed <= 2 && weight <= 2 && boost <= 2, "Stats out of budget");
        return _createType(msg.sender, name, price, speed, weight, boost, false);
    }

    function _createType(address creator, string calldata name, uint96 price, int8 s, int8 w, int8 b, bool platform)
        internal
        returns (uint256 typeId)
    {
        typeId = _types.length;
        _types.push(PartType(name, creator, price, s, w, b, platform, true));
        emit PartTypeCreated(typeId, creator, platform, price);
    }

    function mintLicense(address to, uint256 typeId) external returns (uint256 id) {
        if (msg.sender != minter) revert NotMinter();
        if (typeId >= _types.length || !_types[typeId].active) revert UnknownPart();
        id = nextId++;
        typeOf[id] = typeId;
        _mint(to, id);
        _setTokenRoyalty(id, _types[typeId].creator, ROYALTY_BPS);
        emit PartLicensed(to, id, typeId);
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        PartType memory p = _types[typeOf[id]];
        bytes memory json = abi.encodePacked(
            '{"name":"', p.name, " #", id.toString(), '","description":"DuckWek part license","attributes":[',
            '{"trait_type":"speed","value":', _i(p.speed), "},",
            '{"trait_type":"weight","value":', _i(p.weight), "},",
            '{"trait_type":"boost","value":', _i(p.boost), "}]}"
        );
        return string.concat("data:application/json;base64,", Base64.encode(json));
    }

    function _i(int8 v) private pure returns (string memory) {
        return v < 0 ? string.concat("-", uint256(uint8(-v)).toString()) : uint256(uint8(v)).toString();
    }

    function supportsInterface(bytes4 id) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(id);
    }
}
