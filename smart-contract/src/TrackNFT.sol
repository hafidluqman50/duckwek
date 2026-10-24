// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {DuckWekRoles} from "./DuckWekRoles.sol";

/// @title DuckWek track. Hosts rent a track when they create a room.
/// @notice One rule for every track: it has an owner (`creator`), and the Vault splits both the rent and every ticket of a
///         room 50/50 owner / protocol. Platform tracks are minted to the protocol address (treasury), so the same rule
///         credits the protocol alone. Creator tracks (UGC, roadmap) pay the creator the same way.
contract TrackNFT is ERC721, DuckWekRoles {
    using Strings for uint256;

    struct Track {
        string name;
        address creator;
        uint96 rentPrice; // USDC, 6 decimals
        uint16 laps;
        uint16 turns;
        uint32 lengthMeters;
        bool platform;
        bool active;
    }

    mapping(uint256 => Track) internal _tracks;
    uint256 public nextId = 1;
    bool public ugcOpen; // false on hackathon day: "custom tracks — coming soon"

    event TrackCreated(uint256 indexed id, address indexed creator, bool platform, uint96 rentPrice);
    event TrackUpdated(uint256 indexed id, uint96 rentPrice, bool active);

    error UgcClosed();
    error NotCreator();

    constructor(address owner_) ERC721("DuckWek Track", "WEKTRACK") DuckWekRoles(owner_) {}

    function track(uint256 id) external view returns (Track memory) {
        _requireOwned(id);
        return _tracks[id];
    }

    /// @notice Platform track, minted to `creator` (the protocol / treasury address).
    function createPlatformTrack(address creator, string calldata name, uint96 rentPrice, uint16 laps, uint16 turns, uint32 lengthMeters)
        external
        onlyOwner
        returns (uint256 id)
    {
        id = _create(creator, name, rentPrice, laps, turns, lengthMeters, true);
    }

    /// @notice Creator track (UGC). Closed until `ugcOpen` is set — roadmap.
    function createTrack(string calldata name, uint96 rentPrice, uint16 laps, uint16 turns, uint32 lengthMeters)
        external
        whenNotPaused
        returns (uint256 id)
    {
        if (!ugcOpen) revert UgcClosed();
        id = _create(msg.sender, name, rentPrice, laps, turns, lengthMeters, false);
    }

    function setUgcOpen(bool open) external onlyOwner {
        ugcOpen = open;
    }

    function setTrack(uint256 id, uint96 rentPrice, bool active) external {
        _requireOwned(id);
        Track storage t = _tracks[id];
        if (msg.sender != t.creator && msg.sender != owner()) revert NotCreator();
        t.rentPrice = rentPrice;
        t.active = active;
        emit TrackUpdated(id, rentPrice, active);
    }

    function _create(
        address creator,
        string calldata name,
        uint96 rentPrice,
        uint16 laps,
        uint16 turns,
        uint32 lengthMeters,
        bool platform
    ) internal returns (uint256 id) {
        id = nextId++;
        _tracks[id] = Track(name, creator, rentPrice, laps, turns, lengthMeters, platform, true);
        _mint(creator, id);
        emit TrackCreated(id, creator, platform, rentPrice);
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        Track memory t = _tracks[id];
        bytes memory json = abi.encodePacked(
            '{"name":"', t.name, '","description":"DuckWek race track","attributes":[',
            '{"trait_type":"laps","value":', uint256(t.laps).toString(), "},",
            '{"trait_type":"turns","value":', uint256(t.turns).toString(), "},",
            '{"trait_type":"length_m","value":', uint256(t.lengthMeters).toString(), "}]}"
        );
        return string.concat("data:application/json;base64,", Base64.encode(json));
    }
}
