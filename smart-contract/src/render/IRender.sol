// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IRender {
    struct PartView {
        string name;
        uint8 slot;
        uint24 color;
        bytes32[] keys;
        int8[] values;
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
    function nameOf(uint256 trackId) external view returns (string memory);
}

interface IPartRenderer {
    function partURI(uint256 tokenId, IRender.PartView memory partView) external view returns (string memory);
}

interface ITrackRenderer {
    function trackURI(uint256 tokenId, IRender.TrackView memory trackView) external view returns (string memory);
}

interface IBadgeRenderer {
    function badgeURI(uint256 tokenId, IRender.TitleView memory titleView) external view returns (string memory);
}
