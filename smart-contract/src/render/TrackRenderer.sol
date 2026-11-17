// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ITrackRenderer, IRender} from "./IRender.sol";
import {SvgLib} from "./SvgLib.sol";
import {SegmentLib} from "./SegmentLib.sol";

// slither-disable-start encode-packed-collision
contract TrackRenderer is ITrackRenderer {
    uint256 private constant BOX_LEFT = 50;
    uint256 private constant BOX_TOP = 50;
    uint256 private constant BOX_WIDTH = 700;
    uint256 private constant BOX_HEIGHT = 440;

    struct Shape {
        string path;
        uint256 startX;
        uint256 startY;
        uint256 heading;
    }

    function trackURI(uint256 tokenId, IRender.TrackView memory trackView) external pure returns (string memory) {
        string memory name = SvgLib.clean(trackView.name);
        (uint16 turns, uint32 lengthM) = SegmentLib.turnsAndLength(trackView.segments);
        Shape memory shape = _shape(trackView.segments);
        bytes32 layoutHash = keccak256(abi.encode(trackView.segments, trackView.laps));
        bytes memory json = abi.encodePacked(
            '{"name":"',
            name,
            '","description":"A DuckWek circuit. The road is drawn on chain from its own segment layout.","image":"',
            SvgLib.svgUri(_svg(tokenId, trackView, name, turns, lengthM, shape, layoutHash, false)),
            '","animation_url":"',
            SvgLib.svgUri(_svg(tokenId, trackView, name, turns, lengthM, shape, layoutHash, true)),
            '","attributes":[',
            _attributes(trackView, turns, lengthM, layoutHash),
            "]}"
        );
        return SvgLib.jsonUri(json);
    }

    function _attributes(IRender.TrackView memory trackView, uint16 turns, uint32 lengthM, bytes32 layoutHash)
        private
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(
            '{"trait_type":"Laps","display_type":"number","value":',
            SvgLib.uintToString(trackView.laps),
            '},{"trait_type":"Turns","display_type":"number","value":',
            SvgLib.uintToString(turns),
            '},{"trait_type":"Length (m)","display_type":"number","value":',
            SvgLib.uintToString(lengthM),
            '},{"trait_type":"Layout version","display_type":"number","value":',
            SvgLib.uintToString(trackView.version),
            '},{"trait_type":"Rent (USDC)","value":"',
            SvgLib.usdc(trackView.rent),
            '"},{"trait_type":"Platform","value":"',
            trackView.platform ? "Yes" : "No",
            '"},{"trait_type":"Layout hash","value":"0x',
            SvgLib.hexBytes(abi.encodePacked(layoutHash), 4),
            '"}'
        );
    }

    // ─── Svg ───

    function _svg(
        uint256 tokenId,
        IRender.TrackView memory trackView,
        string memory name,
        uint16 turns,
        uint32 lengthMetres,
        Shape memory shape,
        bytes32 layoutHash,
        bool animated
    ) private pure returns (bytes memory) {
        return abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800" role="img" aria-label="',
            name,
            '"><rect width="800" height="800" fill="#4ED1C5"/>',
            '<rect x="28" y="42" width="744" height="744" rx="48" fill="#000"/>',
            '<rect x="32" y="32" width="736" height="736" rx="44" fill="#B8F35A" stroke="#000" stroke-width="8"/>',
            SvgLib.pill(
                64,
                60,
                150,
                "#1E1446",
                "#FFC93C",
                'font-family="\'Lilita One\',Impact,sans-serif" font-size="26"',
                "CIRCUIT"
            ),
            _idPill(tokenId),
            _road(shape, animated),
            _footer(trackView, name, turns, lengthMetres, layoutHash),
            "</svg>"
        );
    }

    function _idPill(uint256 tokenId) private pure returns (bytes memory) {
        string memory label = string.concat("#", SvgLib.uintToString(tokenId));
        uint256 width = SvgLib.pillWidth(bytes(label).length, 15);
        return SvgLib.pill(
            736 - width,
            60,
            width,
            "#fff",
            "#1E1446",
            'font-family="\'JetBrains Mono\',monospace" font-size="24" font-weight="700"',
            label
        );
    }

    function _road(Shape memory shape, bool animated) private pure returns (bytes memory) {
        string memory path = shape.path;
        bytes memory dash = animated
            ? bytes('<animate attributeName="stroke-dashoffset" from="0" to="-60" dur="1s" repeatCount="indefinite"/>')
            : bytes("");
        return abi.encodePacked(
            '<svg x="64" y="130" width="672" height="454" viewBox="0 0 800 540" overflow="visible">',
            '<path d="',
            path,
            '" fill="none" stroke="#000" stroke-width="70" stroke-linejoin="round" stroke-linecap="round"/>',
            '<path d="',
            path,
            '" fill="none" stroke="#1E1446" stroke-width="52" stroke-linejoin="round" stroke-linecap="round"/>',
            '<path d="',
            path,
            '" fill="none" stroke="#C9B8FF" stroke-width="5" stroke-dasharray="30 30">',
            dash,
            "</path>",
            _startLine(shape),
            _duck(shape, path, animated),
            "</svg>"
        );
    }

    function _startLine(Shape memory shape) private pure returns (bytes memory) {
        return abi.encodePacked(
            '<g transform="translate(',
            SvgLib.uintToString(shape.startX),
            " ",
            SvgLib.uintToString(shape.startY),
            ") rotate(",
            SvgLib.uintToString(shape.heading * 45),
            ')"><rect x="-8" y="-30" width="16" height="60" fill="#fff" stroke="#000" stroke-width="3"/>',
            '<rect x="-8" y="-30" width="8" height="15" fill="#000"/><rect x="0" y="-15" width="8" height="15" fill="#000"/>',
            '<rect x="-8" y="0" width="8" height="15" fill="#000"/><rect x="0" y="15" width="8" height="15" fill="#000"/></g>'
        );
    }

    function _duck(Shape memory shape, string memory path, bool animated) private pure returns (bytes memory) {
        bytes memory body =
            '<g transform="translate(-24,-24) scale(0.4)"><polygon points="10,60 30,40 70,38 100,50 95,75 60,88 25,84" fill="#FFC93C" stroke="#000" stroke-width="8" stroke-linejoin="round"/><polygon points="70,40 72,18 88,8 102,16 104,36 92,46" fill="#FFC93C" stroke="#000" stroke-width="8" stroke-linejoin="round"/><polygon points="102,20 119,27 102,34" fill="#FF9F1C" stroke="#000" stroke-width="7"/></g>';
        if (animated) {
            return abi.encodePacked(
                "<g>", body, '<animateMotion dur="6s" repeatCount="indefinite" rotate="auto" path="', path, '"/></g>'
            );
        }

        return abi.encodePacked(
            '<g transform="translate(',
            SvgLib.uintToString(shape.startX),
            " ",
            SvgLib.uintToString(shape.startY),
            ") rotate(",
            SvgLib.uintToString(shape.heading * 45),
            ')">',
            body,
            "</g>"
        );
    }

    function _footer(
        IRender.TrackView memory trackView,
        string memory name,
        uint16 turns,
        uint32 lengthMetres,
        bytes32 layoutHash
    ) private pure returns (bytes memory) {
        string memory lapsLabel =
            string.concat(SvgLib.uintToString(trackView.laps), trackView.laps == 1 ? " lap" : " laps");
        string memory turnsLabel = string.concat(SvgLib.uintToString(turns), turns == 1 ? " turn" : " turns");
        string memory lengthLabel = string.concat(SvgLib.uintToString(lengthMetres), " m");
        string memory earningsLabel = trackView.platform ? "Platform circuit" : "Holder earns 50%";
        string memory style = 'font-family="Rubik,Arial,sans-serif" font-size="22" font-weight="900"';
        uint256 lapsWidth = SvgLib.pillWidth(bytes(lapsLabel).length, 13);
        uint256 turnsWidth = SvgLib.pillWidth(bytes(turnsLabel).length, 13);
        uint256 lengthWidth = SvgLib.pillWidth(bytes(lengthLabel).length, 13);
        uint256 earningsWidth = SvgLib.pillWidth(bytes(earningsLabel).length, 13);
        uint256 fontSize = bytes(name).length <= 14 ? 66 : (924 / bytes(name).length);
        if (fontSize < 36) fontSize = 36;

        return abi.encodePacked(
            '<text x="64" y="634" font-family="\'Lilita One\',Impact,sans-serif" font-size="',
            SvgLib.uintToString(fontSize),
            '" fill="#fff" stroke="#000" stroke-width="8" paint-order="stroke fill" stroke-linejoin="round">',
            name,
            "</text>",
            SvgLib.pill(64, 652, lapsWidth, "#fff", "#1E1446", style, lapsLabel),
            SvgLib.pill(74 + lapsWidth, 652, turnsWidth, "#fff", "#1E1446", style, turnsLabel),
            SvgLib.pill(84 + lapsWidth + turnsWidth, 652, lengthWidth, "#fff", "#1E1446", style, lengthLabel),
            SvgLib.pill(
                94 + lapsWidth + turnsWidth + lengthWidth,
                652,
                earningsWidth,
                "#FFC93C",
                "#1E1446",
                style,
                earningsLabel
            ),
            _layoutLine(trackView, layoutHash)
        );
    }

    function _layoutLine(IRender.TrackView memory trackView, bytes32 layoutHash) private pure returns (bytes memory) {
        string memory code = SvgLib.hexBytes(trackView.segments, 10);
        if (trackView.segments.length > 10) code = string.concat(code, unicode"…");

        return abi.encodePacked(
            '<text x="64" y="740" font-family="\'JetBrains Mono\',monospace" font-size="18" font-weight="700" fill="#1E1446">LAYOUT v',
            SvgLib.uintToString(trackView.version),
            unicode" · ",
            code,
            unicode" · hash 0x",
            SvgLib.hexBytes(abi.encodePacked(layoutHash), 4),
            "</text>"
        );
    }

    // ─── Path ───

    // slither-disable-start divide-before-multiply
    function _shape(bytes memory segments) private pure returns (Shape memory shape) {
        (int256[] memory pointsX, int256[] memory pointsY, bool closed, uint256 startHeading) =
            SegmentLib.walk(segments);
        uint256 pointCount = pointsX.length;
        int256 minX = pointsX[0];
        int256 maxX = pointsX[0];
        int256 minY = pointsY[0];
        int256 maxY = pointsY[0];
        for (uint256 pointIndex = 1; pointIndex < pointCount; ++pointIndex) {
            if (pointsX[pointIndex] < minX) minX = pointsX[pointIndex];

            if (pointsX[pointIndex] > maxX) maxX = pointsX[pointIndex];

            if (pointsY[pointIndex] < minY) minY = pointsY[pointIndex];

            if (pointsY[pointIndex] > maxY) maxY = pointsY[pointIndex];
        }

        int256 width = maxX - minX;
        int256 height = maxY - minY;
        if (width < 1) width = 1;

        if (height < 1) height = 1;

        int256 scaleX = int256(BOX_WIDTH) * 1e6 / width;
        int256 scaleY = int256(BOX_HEIGHT) * 1e6 / height;
        int256 scale = scaleX < scaleY ? scaleX : scaleY;
        int256 offsetX = int256(BOX_LEFT) + (int256(BOX_WIDTH) - (width * scale) / 1e6) / 2;
        int256 offsetY = int256(BOX_TOP) + (int256(BOX_HEIGHT) - (height * scale) / 1e6) / 2;
        uint256[] memory pixelsX = new uint256[](pointCount);
        uint256[] memory pixelsY = new uint256[](pointCount);
        for (uint256 pointIndex; pointIndex < pointCount; ++pointIndex) {
            pixelsX[pointIndex] = uint256(offsetX + ((pointsX[pointIndex] - minX) * scale) / 1e6);
            pixelsY[pointIndex] = uint256(offsetY + ((pointsY[pointIndex] - minY) * scale) / 1e6);
        }

        shape.startX = pixelsX[0];
        shape.startY = pixelsY[0];
        shape.heading = startHeading;
        shape.path = _smooth(pixelsX, pixelsY, closed);
    }
    // slither-disable-end divide-before-multiply

    function _midpoint(uint256 first, uint256 second) private pure returns (string memory) {
        return string.concat(SvgLib.uintToString((first + second) / 2));
    }

    function _smooth(uint256[] memory pixelsX, uint256[] memory pixelsY, bool closed)
        private
        pure
        returns (string memory)
    {
        uint256 pointCount = pixelsX.length;
        bytes memory path;
        if (closed && pointCount > 2) {
            uint256 uniqueVertexCount = pointCount - 1;
            path = abi.encodePacked(
                "M",
                _midpoint(pixelsX[uniqueVertexCount - 1], pixelsX[0]),
                " ",
                _midpoint(pixelsY[uniqueVertexCount - 1], pixelsY[0])
            );
            for (uint256 pointIndex; pointIndex < uniqueVertexCount; ++pointIndex) {
                uint256 nextIndex = (pointIndex + 1) % uniqueVertexCount;
                path = abi.encodePacked(
                    path,
                    "Q",
                    SvgLib.uintToString(pixelsX[pointIndex]),
                    " ",
                    SvgLib.uintToString(pixelsY[pointIndex]),
                    " ",
                    _midpoint(pixelsX[pointIndex], pixelsX[nextIndex]),
                    " ",
                    _midpoint(pixelsY[pointIndex], pixelsY[nextIndex])
                );
            }

            return string(abi.encodePacked(path, "Z"));
        }

        path = abi.encodePacked("M", SvgLib.uintToString(pixelsX[0]), " ", SvgLib.uintToString(pixelsY[0]));
        if (pointCount == 2) {
            return string(
                abi.encodePacked(path, "L", SvgLib.uintToString(pixelsX[1]), " ", SvgLib.uintToString(pixelsY[1]))
            );
        }

        path = abi.encodePacked(path, "L", _midpoint(pixelsX[0], pixelsX[1]), " ", _midpoint(pixelsY[0], pixelsY[1]));
        for (uint256 pointIndex = 1; pointIndex < pointCount - 1; ++pointIndex) {
            path = abi.encodePacked(
                path,
                "Q",
                SvgLib.uintToString(pixelsX[pointIndex]),
                " ",
                SvgLib.uintToString(pixelsY[pointIndex]),
                " ",
                _midpoint(pixelsX[pointIndex], pixelsX[pointIndex + 1]),
                " ",
                _midpoint(pixelsY[pointIndex], pixelsY[pointIndex + 1])
            );
        }

        return string(
            abi.encodePacked(
                path,
                "L",
                SvgLib.uintToString(pixelsX[pointCount - 1]),
                " ",
                SvgLib.uintToString(pixelsY[pointCount - 1])
            )
        );
    }
}
// slither-disable-end encode-packed-collision
