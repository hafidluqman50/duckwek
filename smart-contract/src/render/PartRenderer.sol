// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPartRenderer, IRender} from "./IRender.sol";
import {SvgLib} from "./SvgLib.sol";

/// @title Part licence art (design: docs/design/v2/nft-part.dc.html, nft-part-slots.dc.html)
/// @notice Builds the NFT image from the part's own traits, so two different parts never render the same picture:
///   slot geometry + slot frame colour, the part's fill colour, two accent colours taken from its name, the name itself,
///   one stat bar per registered stat key, and a build label from the highest stat. `image` is static, `animation_url`
///   is the same picture with SMIL motion (no script, no external file).
// slither-disable-start encode-packed-collision -- abi.encodePacked only concatenates picture text here; the result is never hashed or compared
contract PartRenderer is IPartRenderer {
    using SvgLib for *;

    string private constant RAYS =
        "M400 300L1400 300L1385 474ZM400 300L1340 642L1266 800ZM400 300L1166 943L1043 1066ZM400 300L900 1166L742 1240ZM400 300L574 1285L400 1300ZM400 300L226 1285L58 1240ZM400 300L-100 1166L-243 1066ZM400 300L-366 943L-466 800ZM400 300L-540 642L-585 474ZM400 300L-600 300L-585 126ZM400 300L-540 -42L-466 -200ZM400 300L-366 -343L-243 -466ZM400 300L-100 -566L58 -640ZM400 300L226 -685L400 -700ZM400 300L574 -685L742 -640ZM400 300L900 -566L1043 -466ZM400 300L1166 -343L1266 -200ZM400 300L1340 -42L1385 126Z";

    uint256 private constant MAX_ROWS = 6;

    function partURI(uint256 id, IRender.PartView memory v) external pure returns (string memory) {
        string memory name = SvgLib.clean(v.name);
        string memory build = _build(v);
        bytes memory json = abi.encodePacked(
            '{"name":"', name, " #", SvgLib.u2s(id), '","description":"A DuckWek part licence. The picture is drawn on chain from the part\'s own traits.","image":"',
            SvgLib.svgUri(_svg(id, v, name, build, false)), '","animation_url":"', SvgLib.svgUri(_svg(id, v, name, build, true)),
            '","attributes":[{"trait_type":"Slot","value":"', _slotName(v.slot, false), '"},{"trait_type":"Build","value":"',
            SvgLib.capitalize(_lower(build)), '"}', _attrs(v), "]}"
        );
        return SvgLib.jsonUri(json);
    }

    // ------------------------------------------------------------------ svg

    function _svg(uint256 id, IRender.PartView memory v, string memory name, string memory build, bool anim)
        private
        pure
        returns (bytes memory)
    {
        string memory frame = _frame(v.slot);
        uint256 rows = v.keys.length > MAX_ROWS ? MAX_ROWS : v.keys.length;
        uint256 cardH = 24 + rows * 38;
        uint256 cardY = 736 - cardH;
        return abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800" role="img" aria-label="',
            name, '"><rect width="800" height="800" fill="#1E1446"/>',
            _rays(anim),
            '<rect x="28" y="28" width="744" height="744" rx="48" fill="none" stroke="#000" stroke-width="22"/>',
            '<rect x="28" y="28" width="744" height="744" rx="48" fill="none" stroke="', frame, '" stroke-width="10"/>',
            _top(id, v.slot, build, frame),
            _art(v, anim),
            _name(name, cardY),
            _stats(v, rows, cardY, cardH),
            "</svg>"
        );
    }

    function _rays(bool anim) private pure returns (bytes memory) {
        if (!anim) return abi.encodePacked('<path d="', RAYS, '" fill="#2A1D5E"/>');
        return abi.encodePacked(
            '<g><path d="', RAYS, '" fill="#2A1D5E"/><animateTransform attributeName="transform" type="rotate" from="0 400 300" to="360 400 300" dur="30s" repeatCount="indefinite"/></g>'
        );
    }

    function _top(uint256 id, uint8 slot, string memory build, string memory frame) private pure returns (bytes memory) {
        string memory left = string.concat(_slotName(slot, true), unicode" · ", build);
        string memory right = string.concat("LICENSE #", SvgLib.u2s(id));
        uint256 wl = SvgLib.pillW(bytes(left).length, 17);
        uint256 wr = SvgLib.pillW(bytes(right).length, 15);
        return abi.encodePacked(
            SvgLib.pill(64, 60, wl, frame, "#1E1446", 'font-family="Rubik,Arial,sans-serif" font-size="24" font-weight="900" letter-spacing="2"', left),
            SvgLib.pill(736 - wr, 60, wr, "#fff", "#1E1446", 'font-family="\'JetBrains Mono\',monospace" font-size="24" font-weight="700"', right)
        );
    }

    /// @dev Part drawing in the slot's own coordinate box (from the design), centred in the art area.
    function _art(IRender.PartView memory v, bool anim) private pure returns (bytes memory) {
        string memory fill = SvgLib.color(v.color);
        (string memory vb, string memory shape) = _geometry(v.slot);
        bytes32 h = keccak256(bytes(v.name));
        string memory c1 = _accent(uint8(h[0]));
        string memory c2 = _accent(uint8(h[1]));
        bytes memory part = abi.encodePacked(
            '<svg x="190" y="150" width="420" height="300" viewBox="', vb, '" overflow="visible"><polygon points="', shape,
            '" fill="', fill, '" stroke="#000" stroke-width="3" stroke-linejoin="round"/>', _deco(v.slot, c1, c2), "</svg>"
        );
        if (!anim) return part;
        return abi.encodePacked(
            "<g>", part,
            '<animateTransform attributeName="transform" type="translate" values="0 0;0 -14;0 0" dur="2.4s" repeatCount="indefinite"/></g>'
        );
    }

    function _deco(uint8 slot, string memory c1, string memory c2) private pure returns (bytes memory) {
        if (slot == 0) {
            return abi.encodePacked(
                '<polyline points="66,62 100,38" fill="none" stroke="', c1, '" stroke-width="2.5" stroke-linecap="round"/>',
                '<polyline points="74,66 104,42" fill="none" stroke="', c2, '" stroke-width="2.5" stroke-linecap="round"/>',
                '<polyline points="90,74 84,80 92,82 86,88" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"/>'
            );
        }
        if (slot == 1) {
            return abi.encodePacked(
                '<polyline points="30,62 14,60" fill="none" stroke="', c1, '" stroke-width="2.5" stroke-linecap="round"/>',
                '<polyline points="31,72 15,76" fill="none" stroke="', c2, '" stroke-width="2.5" stroke-linecap="round"/>'
            );
        }
        return abi.encodePacked(
            '<polyline points="121,34 138,39" fill="none" stroke="', c1, '" stroke-width="1.6" stroke-linecap="round"/>',
            '<polyline points="121,44 138,40" fill="none" stroke="', c2, '" stroke-width="1.6" stroke-linecap="round"/>'
        );
    }

    function _name(string memory name, uint256 cardY) private pure returns (bytes memory) {
        uint256 len = bytes(name).length;
        uint256 fs = len <= 14 ? 66 : (924 / len);
        if (fs < 36) fs = 36;
        return abi.encodePacked(
            '<text x="64" y="', SvgLib.u2s(cardY - 26), '" font-family="\'Lilita One\',Impact,sans-serif" font-size="', SvgLib.u2s(fs),
            '" fill="#fff" stroke="#000" stroke-width="8" paint-order="stroke fill" stroke-linejoin="round">', name, "</text>"
        );
    }

    function _stats(IRender.PartView memory v, uint256 rows, uint256 cardY, uint256 cardH) private pure returns (bytes memory out) {
        out = abi.encodePacked(
            '<rect x="64" y="', SvgLib.u2s(cardY), '" width="672" height="', SvgLib.u2s(cardH),
            '" rx="26" fill="#fff" stroke="#000" stroke-width="5"/>'
        );
        for (uint256 i; i < rows; ++i) {
            int256 val = v.values[i];
            uint256 y = cardY + 12 + i * 38;
            int256 pct = 50 + 25 * val;
            if (pct < 6) pct = 6;
            if (pct > 100) pct = 100;
            uint256 fillW = (442 * uint256(pct)) / 100;
            out = abi.encodePacked(
                out,
                '<text x="84" y="', SvgLib.u2s(y + 19), '" font-family="Rubik,Arial,sans-serif" font-size="22" font-weight="900" fill="#1E1446">',
                SvgLib.capitalize(SvgLib.key(v.keys[i])), "</text>",
                '<rect x="206" y="', SvgLib.u2s(y + 4), '" width="450" height="26" rx="13" fill="#EEE8FF" stroke="#000" stroke-width="4"/>',
                '<rect x="210" y="', SvgLib.u2s(y + 8), '" width="', SvgLib.u2s(fillW), '" height="18" rx="9" fill="', _statColor(SvgLib.key(v.keys[i])), '"/>',
                '<text x="718" y="', SvgLib.u2s(y + 19), '" text-anchor="end" font-family="\'JetBrains Mono\',monospace" font-size="22" font-weight="700" fill="#1E1446">',
                SvgLib.stat(val), "</text>"
            );
        }
    }

    // ------------------------------------------------------------------ traits

    function _build(IRender.PartView memory v) private pure returns (string memory) {
        int256 best = type(int256).min;
        uint256 bestAt = 0;
        uint256 ties = 0;
        for (uint256 i; i < v.values.length; ++i) {
            if (v.values[i] > best) {
                best = v.values[i];
                bestAt = i;
                ties = 1;
            } else if (v.values[i] == best) {
                ++ties;
            }
        }
        if (v.values.length == 0 || best <= 0 || ties > 1) return "ALL-ROUND";
        return string.concat(SvgLib.upper(SvgLib.key(v.keys[bestAt])), " BUILD");
    }

    function _attrs(IRender.PartView memory v) private pure returns (bytes memory out) {
        for (uint256 i; i < v.keys.length; ++i) {
            out = abi.encodePacked(
                out, ',{"trait_type":"', SvgLib.capitalize(SvgLib.key(v.keys[i])), '","display_type":"number","value":', SvgLib.i2s(v.values[i]), "}"
            );
        }
    }

    function _slotName(uint8 slot, bool upperCase) private pure returns (string memory) {
        if (slot == 0) return upperCase ? "WINGS" : "Wings";
        if (slot == 1) return upperCase ? "TAIL" : "Tail";
        return upperCase ? "BILL" : "Bill";
    }

    function _frame(uint8 slot) private pure returns (string memory) {
        if (slot == 0) return "#7CC6FE";
        if (slot == 1) return "#FF7AB6";
        return "#B8F35A";
    }

    function _geometry(uint8 slot) private pure returns (string memory vb, string memory shape) {
        if (slot == 0) return ("50 25 70 55", "58,66 98,34 110,40 90,74");
        if (slot == 1) return ("0 45 45 55", "36,64 6,52 16,72 6,92 38,84");
        return ("112 22 40 34", "118,30 147,39 118,48");
    }

    function _accent(uint8 b) private pure returns (string memory) {
        uint8 i = b % 6;
        if (i == 0) return "#FF7AB6";
        if (i == 1) return "#4ED1C5";
        if (i == 2) return "#FFC93C";
        if (i == 3) return "#836EF9";
        if (i == 4) return "#B8F35A";
        return "#F25F5C";
    }

    function _statColor(string memory k) private pure returns (string memory) {
        bytes32 h = keccak256(bytes(k));
        if (h == keccak256("speed")) return "#FFC93C";
        if (h == keccak256("weight")) return "#C9B8FF";
        if (h == keccak256("boost")) return "#F25F5C";
        return "#B8F35A";
    }

    function _lower(string memory s) private pure returns (string memory) {
        bytes memory b = bytes(s);
        for (uint256 i; i < b.length; ++i) if (b[i] >= 0x41 && b[i] <= 0x5a) b[i] = bytes1(uint8(b[i]) + 32);
        return string(b);
    }
}
// slither-disable-end encode-packed-collision
