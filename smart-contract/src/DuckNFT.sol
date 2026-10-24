// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {DuckWekRoles} from "./DuckWekRoles.sol";

/// @title DuckWek duck (ERC-721 + 5% ERC-2981 royalty to the builder).
/// @notice Anti-spam: one duck per wallet, minted by the operator only after that wallet has
///         finished a paid race. Never minted per race.
contract DuckNFT is ERC721, ERC2981, DuckWekRoles {
    using Strings for uint256;

    struct Duck {
        string name;
        uint8 template; // 0 balanced, 1 sprint, 2 tank
        uint24 bodyColor;
        uint24 billColor;
        uint8 cosmetics; // bit 0 hat, bit 1 shades, bit 2 scarf
    }

    uint96 public constant ROYALTY_BPS = 500;
    mapping(uint256 => Duck) public ducks;
    mapping(address => uint256) public duckOf;
    uint256 public nextId = 1;

    event DuckHatched(address indexed builder, uint256 indexed tokenId);

    error AlreadyHatched();

    constructor(address owner_) ERC721("DuckWek Duck", "WEKDUCK") DuckWekRoles(owner_) {}

    function hatch(address to, Duck calldata d) external onlyOperator whenNotPaused returns (uint256 id) {
        if (duckOf[to] != 0) revert AlreadyHatched();
        id = nextId++;
        ducks[id] = d;
        duckOf[to] = id;
        _mint(to, id);
        _setTokenRoyalty(id, to, ROYALTY_BPS);
        emit DuckHatched(to, id);
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        Duck memory d = ducks[id];
        string[3] memory t = ["Balanced", "Sprint", "Tank"];
        bytes memory json = abi.encodePacked(
            '{"name":"', d.name, '","description":"Built and raced live on Monad.","attributes":[',
            '{"trait_type":"template","value":"', t[d.template % 3], '"},',
            '{"trait_type":"body","value":"#', uint256(d.bodyColor).toHexString(3), '"}]}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(json));
    }

    function supportsInterface(bytes4 id) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(id);
    }
}
