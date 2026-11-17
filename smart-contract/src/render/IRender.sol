// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice What an NFT contract hands its renderer. Everything the art needs is an on-chain trait of the token.
interface IRender {
    struct PartView {
        string name;
        uint8 slot; // 0 Wings, 1 Tail, 2 Bill
        uint24 color; // fill colour of the part (immutable trait)
        bytes32[] keys; // stat keys (append-only registry)
        int8[] values; // stat value per key
    }

    struct TrackView {
        string name;
        bool platform;
        uint96 rent;
        uint32 version;
        bytes segments;
        uint16 laps;
    }

    struct TitleView {
        string title;
        uint64 raceId;
        uint16 rank;
        string trackName;
        address winner;
    }
}

interface ITrackNames {
    function nameOf(uint256 id) external view returns (string memory);
}

interface IPartRenderer {
    function partURI(uint256 id, IRender.PartView memory v) external view returns (string memory);
}

interface ITrackRenderer {
    function trackURI(uint256 id, IRender.TrackView memory v) external view returns (string memory);
}

interface IBadgeRenderer {
    function badgeURI(uint256 id, IRender.TitleView memory v) external view returns (string memory);
}
