// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title DuckWek title badge. Soulbound (ERC-5192): free, only won, never bought or sold.
contract Badge is ERC721, Ownable {
    using Strings for uint256;

    struct Title {
        bytes32 roomKey;
        uint64 raceId;
        uint16 rank;
        string title;
    }

    mapping(uint256 => Title) public titles;
    uint256 public nextId = 1;
    address public minter; // DuckWekRace

    event Locked(uint256 tokenId);

    error Soulbound();
    error NotMinter();

    constructor(address owner_) ERC721("DuckWek Title", "WEKTITLE") Ownable(owner_) {}

    function setMinter(address minter_) external onlyOwner {
        minter = minter_;
    }

    function award(address to, bytes32 roomKey, uint64 raceId, uint16 rank, string calldata title)
        external
        returns (uint256 id)
    {
        if (msg.sender != minter) revert NotMinter();
        id = nextId++;
        titles[id] = Title(roomKey, raceId, rank, title);
        _mint(to, id);
        emit Locked(id);
    }

    function locked(uint256 id) external view returns (bool) {
        _requireOwned(id);
        return true;
    }

    function _update(address to, uint256 id, address auth) internal override returns (address) {
        address from = _ownerOf(id);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, id, auth);
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        Title memory t = titles[id];
        bytes memory json = abi.encodePacked(
            '{"name":"', t.title, '","description":"Won in DuckWek race #', uint256(t.raceId).toString(),
            '. Soulbound.","attributes":[{"trait_type":"rank","value":', uint256(t.rank).toString(), "}]}"
        );
        return string.concat("data:application/json;base64,", Base64.encode(json));
    }

    function supportsInterface(bytes4 id) public view override returns (bool) {
        return id == 0xb45a3c0e || super.supportsInterface(id);
    }
}
