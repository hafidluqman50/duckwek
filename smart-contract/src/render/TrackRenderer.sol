// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ITrackRenderer, IRender} from "./IRender.sol";
import {SvgLib} from "./SvgLib.sol";
import {SegmentLib} from "./SegmentLib.sol";

/// @title Circuit NFT art (design: docs/design/v2/nft-circuit.dc.html)
/// @notice The road is drawn from the track's own segment bytes (`SegmentLib` turtle code), so every layout renders its own
///         shape. `animation_url` adds the duck lapping the path (`animateMotion`) and the dashed centre line.
contract TrackRenderer is ITrackRenderer {
    uint256 private constant BOX_X = 50;
    uint256 private constant BOX_Y = 50;
    uint256 private constant BOX_W = 700;
    uint256 private constant BOX_H = 440;

    struct Shape {
        string d; // smooth path
        uint256 sx; // start point (px in the 800x540 box)
        uint256 sy;
        uint256 heading; // 0..7 (45 degree steps, clockwise from east)
    }

    function trackURI(uint256 id, IRender.TrackView memory v) external pure returns (string memory) {
        string memory name = SvgLib.clean(v.name);
        (uint16 turns, uint32 lengthM) = SegmentLib.turnsAndLength(v.segments);
        Shape memory sh = _shape(v.segments);
        bytes32 layoutHash = keccak256(abi.encode(v.segments, v.laps));
        bytes memory json = abi.encodePacked(
            '{"name":"', name, '","description":"A DuckWek circuit. The road is drawn on chain from its own segment layout.","image":"',
            SvgLib.svgUri(_svg(id, v, name, turns, lengthM, sh, layoutHash, false)), '","animation_url":"',
            SvgLib.svgUri(_svg(id, v, name, turns, lengthM, sh, layoutHash, true)), '","attributes":[',
            _attrs(v, turns, lengthM, layoutHash), "]}"
        );
        return SvgLib.jsonUri(json);
    }

    function _attrs(IRender.TrackView memory v, uint16 turns, uint32 lengthM, bytes32 layoutHash) private pure returns (bytes memory) {
        return abi.encodePacked(
            '{"trait_type":"Laps","display_type":"number","value":', SvgLib.u2s(v.laps),
            '},{"trait_type":"Turns","display_type":"number","value":', SvgLib.u2s(turns),
            '},{"trait_type":"Length (m)","display_type":"number","value":', SvgLib.u2s(lengthM),
            '},{"trait_type":"Layout version","display_type":"number","value":', SvgLib.u2s(v.version),
            '},{"trait_type":"Rent (USDC)","value":"', SvgLib.usdc(v.rent),
            '"},{"trait_type":"Platform","value":"', v.platform ? "Yes" : "No",
            '"},{"trait_type":"Layout hash","value":"0x', SvgLib.hexBytes(abi.encodePacked(layoutHash), 4), '"}'
        );
    }

    // ------------------------------------------------------------------ svg

    function _svg(uint256 id, IRender.TrackView memory v, string memory name, uint16 turns, uint32 lengthM, Shape memory sh, bytes32 layoutHash, bool anim)
        private
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800" role="img" aria-label="', name,
            '"><rect width="800" height="800" fill="#4ED1C5"/>',
            '<rect x="28" y="42" width="744" height="744" rx="48" fill="#000"/>',
            '<rect x="32" y="32" width="736" height="736" rx="44" fill="#B8F35A" stroke="#000" stroke-width="8"/>',
            SvgLib.pill(64, 60, 150, "#1E1446", "#FFC93C", 'font-family="\'Lilita One\',Impact,sans-serif" font-size="26"', "CIRCUIT"),
            _idPill(id),
            _road(sh, anim),
            _footer(v, name, turns, lengthM, layoutHash),
            "</svg>"
        );
    }

    function _idPill(uint256 id) private pure returns (bytes memory) {
        string memory t = string.concat("#", SvgLib.u2s(id));
        uint256 w = SvgLib.pillW(bytes(t).length, 15);
        return SvgLib.pill(736 - w, 60, w, "#fff", "#1E1446", 'font-family="\'JetBrains Mono\',monospace" font-size="24" font-weight="700"', t);
    }

    function _road(Shape memory sh, bool anim) private pure returns (bytes memory) {
        string memory d = sh.d;
        bytes memory dash = anim
            ? bytes('<animate attributeName="stroke-dashoffset" from="0" to="-60" dur="1s" repeatCount="indefinite"/>')
            : bytes("");
        return abi.encodePacked(
            '<svg x="64" y="130" width="672" height="454" viewBox="0 0 800 540" overflow="visible">',
            '<path d="', d, '" fill="none" stroke="#000" stroke-width="70" stroke-linejoin="round" stroke-linecap="round"/>',
            '<path d="', d, '" fill="none" stroke="#1E1446" stroke-width="52" stroke-linejoin="round" stroke-linecap="round"/>',
            '<path d="', d, '" fill="none" stroke="#C9B8FF" stroke-width="5" stroke-dasharray="30 30">', dash, "</path>",
            _startLine(sh), _duck(sh, d, anim), "</svg>"
        );
    }

    function _startLine(Shape memory sh) private pure returns (bytes memory) {
        return abi.encodePacked(
            '<g transform="translate(', SvgLib.u2s(sh.sx), " ", SvgLib.u2s(sh.sy), ") rotate(", SvgLib.u2s(sh.heading * 45),
            ')"><rect x="-8" y="-30" width="16" height="60" fill="#fff" stroke="#000" stroke-width="3"/>',
            '<rect x="-8" y="-30" width="8" height="15" fill="#000"/><rect x="0" y="-15" width="8" height="15" fill="#000"/>',
            '<rect x="-8" y="0" width="8" height="15" fill="#000"/><rect x="0" y="15" width="8" height="15" fill="#000"/></g>'
        );
    }

    function _duck(Shape memory sh, string memory d, bool anim) private pure returns (bytes memory) {
        bytes memory body =
            '<g transform="translate(-24,-24) scale(0.4)"><polygon points="10,60 30,40 70,38 100,50 95,75 60,88 25,84" fill="#FFC93C" stroke="#000" stroke-width="8" stroke-linejoin="round"/><polygon points="70,40 72,18 88,8 102,16 104,36 92,46" fill="#FFC93C" stroke="#000" stroke-width="8" stroke-linejoin="round"/><polygon points="102,20 119,27 102,34" fill="#FF9F1C" stroke="#000" stroke-width="7"/></g>';
        if (anim) {
            return abi.encodePacked("<g>", body, '<animateMotion dur="6s" repeatCount="indefinite" rotate="auto" path="', d, '"/></g>');
        }
        return abi.encodePacked(
            '<g transform="translate(', SvgLib.u2s(sh.sx), " ", SvgLib.u2s(sh.sy), ") rotate(", SvgLib.u2s(sh.heading * 45), ')">', body, "</g>"
        );
    }

    function _footer(IRender.TrackView memory v, string memory name, uint16 turns, uint32 lengthM, bytes32 layoutHash)
        private
        pure
        returns (bytes memory)
    {
        string memory a = string.concat(SvgLib.u2s(v.laps), v.laps == 1 ? " lap" : " laps");
        string memory b = string.concat(SvgLib.u2s(turns), turns == 1 ? " turn" : " turns");
        string memory c = string.concat(SvgLib.u2s(lengthM), " m");
        string memory e = v.platform ? "Platform circuit" : "Holder earns 50%";
        string memory style = 'font-family="Rubik,Arial,sans-serif" font-size="22" font-weight="900"';
        uint256 wa = SvgLib.pillW(bytes(a).length, 13);
        uint256 wb = SvgLib.pillW(bytes(b).length, 13);
        uint256 wc = SvgLib.pillW(bytes(c).length, 13);
        uint256 we = SvgLib.pillW(bytes(e).length, 13);
        uint256 fs = bytes(name).length <= 14 ? 66 : (924 / bytes(name).length);
        if (fs < 36) fs = 36;
        return abi.encodePacked(
            '<text x="64" y="634" font-family="\'Lilita One\',Impact,sans-serif" font-size="', SvgLib.u2s(fs),
            '" fill="#fff" stroke="#000" stroke-width="8" paint-order="stroke fill" stroke-linejoin="round">', name, "</text>",
            SvgLib.pill(64, 652, wa, "#fff", "#1E1446", style, a),
            SvgLib.pill(74 + wa, 652, wb, "#fff", "#1E1446", style, b),
            SvgLib.pill(84 + wa + wb, 652, wc, "#fff", "#1E1446", style, c),
            SvgLib.pill(94 + wa + wb + wc, 652, we, "#FFC93C", "#1E1446", style, e),
            _layoutLine(v, layoutHash)
        );
    }

    function _layoutLine(IRender.TrackView memory v, bytes32 layoutHash) private pure returns (bytes memory) {
        string memory code = SvgLib.hexBytes(v.segments, 10);
        if (v.segments.length > 10) code = string.concat(code, unicode"…");
        return abi.encodePacked(
            '<text x="64" y="740" font-family="\'JetBrains Mono\',monospace" font-size="18" font-weight="700" fill="#1E1446">LAYOUT v',
            SvgLib.u2s(v.version), unicode" · ", code, unicode" · hash 0x", SvgLib.hexBytes(abi.encodePacked(layoutHash), 4), "</text>"
        );
    }

    // ------------------------------------------------------------------ path

    function _shape(bytes memory seg) private pure returns (Shape memory sh) {
        (int256[] memory xs, int256[] memory ys, bool closed, uint256 h0) = SegmentLib.walk(seg);
        uint256 n = xs.length;
        int256 minX = xs[0];
        int256 maxX = xs[0];
        int256 minY = ys[0];
        int256 maxY = ys[0];
        for (uint256 i = 1; i < n; ++i) {
            if (xs[i] < minX) minX = xs[i];
            if (xs[i] > maxX) maxX = xs[i];
            if (ys[i] < minY) minY = ys[i];
            if (ys[i] > maxY) maxY = ys[i];
        }
        int256 w = maxX - minX;
        int256 hh = maxY - minY;
        if (w < 1) w = 1;
        if (hh < 1) hh = 1;
        int256 kx = int256(BOX_W) * 1e6 / w;
        int256 ky = int256(BOX_H) * 1e6 / hh;
        int256 k = kx < ky ? kx : ky;
        int256 offX = int256(BOX_X) + (int256(BOX_W) - (w * k) / 1e6) / 2;
        int256 offY = int256(BOX_Y) + (int256(BOX_H) - (hh * k) / 1e6) / 2;
        uint256[] memory px = new uint256[](n);
        uint256[] memory py = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            px[i] = uint256(offX + ((xs[i] - minX) * k) / 1e6);
            py[i] = uint256(offY + ((ys[i] - minY) * k) / 1e6);
        }
        sh.sx = px[0];
        sh.sy = py[0];
        sh.heading = h0;
        sh.d = _smooth(px, py, closed);
    }

    function _mid(uint256 a, uint256 b) private pure returns (string memory) {
        return string.concat(SvgLib.u2s((a + b) / 2));
    }

    function _smooth(uint256[] memory px, uint256[] memory py, bool closed) private pure returns (string memory) {
        uint256 n = px.length; // vertices V0..V(n-1); segments = n-1
        bytes memory d;
        if (closed && n > 2) {
            uint256 m = n - 1; // drop the last vertex (it is the start again)
            d = abi.encodePacked("M", _mid(px[m - 1], px[0]), " ", _mid(py[m - 1], py[0]));
            for (uint256 i; i < m; ++i) {
                uint256 nx = (i + 1) % m;
                d = abi.encodePacked(d, "Q", SvgLib.u2s(px[i]), " ", SvgLib.u2s(py[i]), " ", _mid(px[i], px[nx]), " ", _mid(py[i], py[nx]));
            }
            return string(abi.encodePacked(d, "Z"));
        }
        d = abi.encodePacked("M", SvgLib.u2s(px[0]), " ", SvgLib.u2s(py[0]));
        if (n == 2) return string(abi.encodePacked(d, "L", SvgLib.u2s(px[1]), " ", SvgLib.u2s(py[1])));
        d = abi.encodePacked(d, "L", _mid(px[0], px[1]), " ", _mid(py[0], py[1]));
        for (uint256 i = 1; i < n - 1; ++i) {
            d = abi.encodePacked(d, "Q", SvgLib.u2s(px[i]), " ", SvgLib.u2s(py[i]), " ", _mid(px[i], px[i + 1]), " ", _mid(py[i], py[i + 1]));
        }
        return string(abi.encodePacked(d, "L", SvgLib.u2s(px[n - 1]), " ", SvgLib.u2s(py[n - 1])));
    }
}
