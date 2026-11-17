// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IBadgeRenderer, IRender} from "./IRender.sol";
import {SvgLib} from "./SvgLib.sol";

/// @title Soulbound title art (design: docs/design/v2/nft-title.dc.html)
/// @notice Podium with the holder's step marked, the title, the rank, the winner and the track. No duck name: that is an
///         off-chain profile field, so the NFT shows the short wallet address instead.
contract BadgeRenderer is IBadgeRenderer {
    string private constant DUCK =
        '<polygon points="10,60 30,40 70,38 100,50 95,75 60,88 25,84" stroke="#000" stroke-width="7" stroke-linejoin="round" fill="';

    function badgeURI(uint256 id, IRender.TitleView memory v) external pure returns (string memory) {
        string memory title = SvgLib.clean(v.title);
        string memory track = SvgLib.clean(v.trackName);
        bytes memory json = abi.encodePacked(
            '{"name":"', title, '","description":"Won in DuckWek race #', SvgLib.u2s(v.raceId),
            '. Earned on the track. Soulbound: it cannot be bought or sold.","image":"', SvgLib.svgUri(_svg(id, v, title, track, false)),
            '","animation_url":"', SvgLib.svgUri(_svg(id, v, title, track, true)),
            '","attributes":[{"trait_type":"Rank","display_type":"number","value":', SvgLib.u2s(v.rank),
            '},{"trait_type":"Race","display_type":"number","value":', SvgLib.u2s(v.raceId),
            '},{"trait_type":"Track","value":"', track, '"}]}'
        );
        return SvgLib.jsonUri(json);
    }

    function _svg(uint256, IRender.TitleView memory v, string memory title, string memory track, bool anim)
        private
        pure
        returns (bytes memory)
    {
        string memory race = string.concat("RACE #", SvgLib.u2s(v.raceId));
        uint256 wr = SvgLib.pillW(bytes(race).length, 14);
        return abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800" role="img" aria-label="', title,
            '"><rect width="800" height="800" fill="#FFC93C"/>',
            '<rect x="28" y="42" width="744" height="744" rx="48" fill="#000"/>',
            '<rect x="32" y="32" width="736" height="736" rx="44" fill="#FFC93C"/>', _confetti(anim),
            '<rect x="32" y="32" width="736" height="736" rx="44" fill="none" stroke="#000" stroke-width="8"/>',
            SvgLib.pill(64, 60, 230, "#1E1446", "#fff", 'font-family="Rubik,Arial,sans-serif" font-size="22" font-weight="900" letter-spacing="3"', "SOULBOUND"),
            SvgLib.pill(736 - wr, 60, wr, "#fff", "#1E1446", 'font-family="\'JetBrains Mono\',monospace" font-size="22" font-weight="700"', race),
            _podium(v.rank, anim), _caption(v, title, track), "</svg>"
        );
    }

    function _podium(uint16 rank, bool anim) private pure returns (bytes memory) {
        bytes memory bob = anim
            ? bytes('<animateTransform attributeName="transform" type="translate" values="0 0;0 -10;0 0" dur="1.2s" repeatCount="indefinite"/>')
            : bytes("");
        return abi.encodePacked(
            // blocks
            '<rect x="171" y="410" width="150" height="120" fill="#C9B8FF" stroke="#000" stroke-width="6"/>',
            '<rect x="315" y="340" width="170" height="190" fill="#fff" stroke="#000" stroke-width="6"/>',
            '<rect x="479" y="440" width="150" height="90" fill="#FF9F1C" stroke="#000" stroke-width="6"/>',
            '<text x="246" y="492" text-anchor="middle" font-family="\'Lilita One\',Impact,sans-serif" font-size="64" fill="#1E1446">2</text>',
            '<text x="400" y="460" text-anchor="middle" font-family="\'Lilita One\',Impact,sans-serif" font-size="96" fill="#836EF9" stroke="#000" stroke-width="6" paint-order="stroke fill">1</text>',
            '<text x="554" y="505" text-anchor="middle" font-family="\'Lilita One\',Impact,sans-serif" font-size="56" fill="#1E1446">3</text>',
            '<rect x="100" y="524" width="600" height="14" rx="7" fill="#000"/>',
            // ducks
            '<svg x="191" y="318" width="110" height="92" viewBox="0 0 120 100" overflow="visible"><g>', DUCK, '#fff"/>', _head("#fff"), bob, "</g></svg>",
            '<svg x="325" y="215" width="150" height="125" viewBox="0 0 120 100" overflow="visible"><g>', DUCK, '#836EF9"/>', _head("#836EF9"),
            '<polygon points="78,10 88,-14 98,8" fill="#FFC93C" stroke="#000" stroke-width="5" stroke-linejoin="round"/>', bob, "</g></svg>",
            '<svg x="504" y="357" width="100" height="83" viewBox="0 0 120 100" overflow="visible"><g>', DUCK, '#FF7AB6"/>', _head("#FF7AB6"), bob, "</g></svg>",
            _marker(rank)
        );
    }

    function _head(string memory fill) private pure returns (bytes memory) {
        return abi.encodePacked(
            '<polygon points="70,40 72,18 88,8 102,16 104,36 92,46" fill="', fill,
            '" stroke="#000" stroke-width="7" stroke-linejoin="round"/><polygon points="102,20 119,27 102,34" fill="#FF9F1C" stroke="#000" stroke-width="6"/>'
        );
    }

    /// @dev Arrow over the holder's duck: this is what makes P1, P2 and P3 titles look different.
    function _marker(uint16 rank) private pure returns (bytes memory) {
        uint256 cx;
        uint256 top;
        if (rank == 1) (cx, top) = (400, 160);
        else if (rank == 2) (cx, top) = (246, 282);
        else if (rank == 3) (cx, top) = (554, 322);
        else return "";
        return abi.encodePacked(
            '<polygon points="', SvgLib.u2s(cx - 16), ",", SvgLib.u2s(top), " ", SvgLib.u2s(cx + 16), ",", SvgLib.u2s(top), " ",
            SvgLib.u2s(cx), ",", SvgLib.u2s(top + 26), '" fill="#1E1446" stroke="#000" stroke-width="5" stroke-linejoin="round"/>'
        );
    }

    function _caption(IRender.TitleView memory v, string memory title, string memory track) private pure returns (bytes memory) {
        uint256 len = bytes(title).length;
        uint256 fs = len <= 14 ? 70 : (980 / len);
        if (fs < 34) fs = 34;
        return abi.encodePacked(
            '<text x="400" y="640" text-anchor="middle" font-family="\'Lilita One\',Impact,sans-serif" font-size="', SvgLib.u2s(fs),
            '" fill="#fff" stroke="#000" stroke-width="9" paint-order="stroke fill" stroke-linejoin="round">', title, "</text>",
            '<text x="400" y="695" text-anchor="middle" font-family="Rubik,Arial,sans-serif" font-size="24" font-weight="900" fill="#1E1446">P',
            SvgLib.u2s(v.rank), unicode" · ", SvgLib.shortAddr(v.winner), unicode" · ", track, "</text>",
            '<text x="400" y="735" text-anchor="middle" font-family="Rubik,Arial,sans-serif" font-size="18" font-weight="800" fill="#1E1446">Earned on the track. Cannot be bought or sold.</text>'
        );
    }

    function _confetti(bool anim) private pure returns (bytes memory out) {
        string[6] memory cols = ["#fff", "#FF7AB6", "#4ED1C5", "#836EF9", "#B8F35A", "#1E1446"];
        for (uint256 j; j < 14; ++j) {
            uint256 x = (j * 157) % 760 + 10;
            uint256 w = 16 + (j % 3) * 8;
            uint256 y = anim ? 0 : (j * 61) % 560 + 80;
            bytes memory motion = anim
                ? abi.encodePacked(
                    '<animate attributeName="y" from="-30" to="820" dur="', SvgLib.u2s(3 + (j % 4)), "s", '" begin="', SvgLib.u2s((j * 41) % 300 / 100), 's" repeatCount="indefinite"/>'
                )
                : bytes("");
            out = abi.encodePacked(
                out, '<rect x="', SvgLib.u2s(x), '" y="', SvgLib.u2s(y), '" width="', SvgLib.u2s(w), '" height="12" fill="', cols[j % 6],
                '" stroke="#000" stroke-width="3">', motion, "</rect>"
            );
        }
    }
}
