// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IBadgeRenderer, IRender} from "./IRender.sol";
import {SvgLib} from "./SvgLib.sol";

contract BadgeRenderer is IBadgeRenderer {
    string private constant DUCK =
        '<polygon points="10,60 30,40 70,38 100,50 95,75 60,88 25,84" stroke="#000" stroke-width="7" stroke-linejoin="round" fill="';

    function badgeURI(uint256 tokenId, IRender.TitleView memory titleView) external pure returns (string memory) {
        string memory title = SvgLib.clean(titleView.title);
        string memory track = SvgLib.clean(titleView.trackName);
        bytes memory json = abi.encodePacked(
            '{"name":"',
            title,
            '","description":"Won in DuckWek race #',
            SvgLib.uintToString(titleView.raceId),
            '. Earned on the track. Soulbound: it cannot be bought or sold.","image":"',
            SvgLib.svgUri(_svg(tokenId, titleView, title, track, false)),
            '","animation_url":"',
            SvgLib.svgUri(_svg(tokenId, titleView, title, track, true)),
            '","attributes":[{"trait_type":"Rank","display_type":"number","value":',
            SvgLib.uintToString(titleView.rank),
            '},{"trait_type":"Race","display_type":"number","value":',
            SvgLib.uintToString(titleView.raceId),
            '},{"trait_type":"Track","value":"',
            track,
            '"}]}'
        );
        return SvgLib.jsonUri(json);
    }

    function _svg(uint256, IRender.TitleView memory titleView, string memory title, string memory track, bool animated)
        private
        pure
        returns (bytes memory)
    {
        string memory race = string.concat("RACE #", SvgLib.uintToString(titleView.raceId));
        uint256 raceWidth = SvgLib.pillWidth(bytes(race).length, 14);
        return abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800" role="img" aria-label="',
            title,
            '"><rect width="800" height="800" fill="#FFC93C"/>',
            '<rect x="28" y="42" width="744" height="744" rx="48" fill="#000"/>',
            '<rect x="32" y="32" width="736" height="736" rx="44" fill="#FFC93C"/>',
            _confetti(animated),
            '<rect x="32" y="32" width="736" height="736" rx="44" fill="none" stroke="#000" stroke-width="8"/>',
            SvgLib.pill(
                64,
                60,
                230,
                "#1E1446",
                "#fff",
                'font-family="Rubik,Arial,sans-serif" font-size="22" font-weight="900" letter-spacing="3"',
                "SOULBOUND"
            ),
            SvgLib.pill(
                736 - raceWidth,
                60,
                raceWidth,
                "#fff",
                "#1E1446",
                'font-family="\'JetBrains Mono\',monospace" font-size="22" font-weight="700"',
                race
            ),
            _podium(titleView.rank, animated),
            _caption(titleView, title, track),
            "</svg>"
        );
    }

    function _podium(uint16 rank, bool animated) private pure returns (bytes memory) {
        bytes memory bobbing = animated
            ? bytes(
                '<animateTransform attributeName="transform" type="translate" values="0 0;0 -10;0 0" dur="1.2s" repeatCount="indefinite"/>'
            )
            : bytes("");
        return abi.encodePacked(
            '<rect x="171" y="410" width="150" height="120" fill="#C9B8FF" stroke="#000" stroke-width="6"/>',
            '<rect x="315" y="340" width="170" height="190" fill="#fff" stroke="#000" stroke-width="6"/>',
            '<rect x="479" y="440" width="150" height="90" fill="#FF9F1C" stroke="#000" stroke-width="6"/>',
            '<text x="246" y="492" text-anchor="middle" font-family="\'Lilita One\',Impact,sans-serif" font-size="64" fill="#1E1446">2</text>',
            '<text x="400" y="460" text-anchor="middle" font-family="\'Lilita One\',Impact,sans-serif" font-size="96" fill="#836EF9" stroke="#000" stroke-width="6" paint-order="stroke fill">1</text>',
            '<text x="554" y="505" text-anchor="middle" font-family="\'Lilita One\',Impact,sans-serif" font-size="56" fill="#1E1446">3</text>',
            '<rect x="100" y="524" width="600" height="14" rx="7" fill="#000"/>',
            '<svg x="191" y="318" width="110" height="92" viewBox="0 0 120 100" overflow="visible"><g>',
            DUCK,
            '#fff"/>',
            _head("#fff"),
            bobbing,
            "</g></svg>",
            '<svg x="325" y="215" width="150" height="125" viewBox="0 0 120 100" overflow="visible"><g>',
            DUCK,
            '#836EF9"/>',
            _head("#836EF9"),
            '<polygon points="78,10 88,-14 98,8" fill="#FFC93C" stroke="#000" stroke-width="5" stroke-linejoin="round"/>',
            bobbing,
            "</g></svg>",
            '<svg x="504" y="357" width="100" height="83" viewBox="0 0 120 100" overflow="visible"><g>',
            DUCK,
            '#FF7AB6"/>',
            _head("#FF7AB6"),
            bobbing,
            "</g></svg>",
            _marker(rank)
        );
    }

    function _head(string memory fill) private pure returns (bytes memory) {
        return abi.encodePacked(
            '<polygon points="70,40 72,18 88,8 102,16 104,36 92,46" fill="',
            fill,
            '" stroke="#000" stroke-width="7" stroke-linejoin="round"/><polygon points="102,20 119,27 102,34" fill="#FF9F1C" stroke="#000" stroke-width="6"/>'
        );
    }

    function _marker(uint16 rank) private pure returns (bytes memory) {
        uint256 centerX;
        uint256 top;
        if (rank == 1) (centerX, top) = (400, 160);
        else if (rank == 2) (centerX, top) = (246, 282);
        else if (rank == 3) (centerX, top) = (554, 322);
        else return "";
        return abi.encodePacked(
            '<polygon points="',
            SvgLib.uintToString(centerX - 16),
            ",",
            SvgLib.uintToString(top),
            " ",
            SvgLib.uintToString(centerX + 16),
            ",",
            SvgLib.uintToString(top),
            " ",
            SvgLib.uintToString(centerX),
            ",",
            SvgLib.uintToString(top + 26),
            '" fill="#1E1446" stroke="#000" stroke-width="5" stroke-linejoin="round"/>'
        );
    }

    function _caption(IRender.TitleView memory titleView, string memory title, string memory track)
        private
        pure
        returns (bytes memory)
    {
        uint256 length = bytes(title).length;
        uint256 fontSize = length <= 14 ? 70 : (980 / length);
        if (fontSize < 34) fontSize = 34;

        return abi.encodePacked(
            '<text x="400" y="640" text-anchor="middle" font-family="\'Lilita One\',Impact,sans-serif" font-size="',
            SvgLib.uintToString(fontSize),
            '" fill="#fff" stroke="#000" stroke-width="9" paint-order="stroke fill" stroke-linejoin="round">',
            title,
            "</text>",
            '<text x="400" y="695" text-anchor="middle" font-family="Rubik,Arial,sans-serif" font-size="24" font-weight="900" fill="#1E1446">P',
            SvgLib.uintToString(titleView.rank),
            unicode" · ",
            SvgLib.shortAddress(titleView.winner),
            unicode" · ",
            track,
            "</text>",
            '<text x="400" y="735" text-anchor="middle" font-family="Rubik,Arial,sans-serif" font-size="18" font-weight="800" fill="#1E1446">Earned on the track. Cannot be bought or sold.</text>'
        );
    }

    function _confetti(bool animated) private pure returns (bytes memory out) {
        string[6] memory colors = ["#fff", "#FF7AB6", "#4ED1C5", "#836EF9", "#B8F35A", "#1E1446"];
        for (uint256 pieceIndex; pieceIndex < 14; ++pieceIndex) {
            uint256 left = (pieceIndex * 157) % 760 + 10;
            uint256 width = 16 + (pieceIndex % 3) * 8;
            uint256 top = animated ? 0 : (pieceIndex * 61) % 560 + 80;
            bytes memory motion = animated
                ? abi.encodePacked(
                    '<animate attributeName="y" from="-30" to="820" dur="',
                    SvgLib.uintToString(3 + (pieceIndex % 4)),
                    "s",
                    '" begin="',
                    SvgLib.uintToString((pieceIndex * 41) % 300 / 100),
                    's" repeatCount="indefinite"/>'
                )
                : bytes("");
            out = abi.encodePacked(
                out,
                '<rect x="',
                SvgLib.uintToString(left),
                '" y="',
                SvgLib.uintToString(top),
                '" width="',
                SvgLib.uintToString(width),
                '" height="12" fill="',
                colors[pieceIndex % 6],
                '" stroke="#000" stroke-width="3">',
                motion,
                "</rect>"
            );
        }
    }
}
