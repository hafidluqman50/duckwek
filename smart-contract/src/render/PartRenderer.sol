// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPartRenderer, IRender} from "./IRender.sol";
import {SvgLib} from "./SvgLib.sol";

// slither-disable-start encode-packed-collision
contract PartRenderer is IPartRenderer {
    using SvgLib for *;

    string private constant RAYS =
        "M400 300L1400 300L1385 474ZM400 300L1340 642L1266 800ZM400 300L1166 943L1043 1066ZM400 300L900 1166L742 1240ZM400 300L574 1285L400 1300ZM400 300L226 1285L58 1240ZM400 300L-100 1166L-243 1066ZM400 300L-366 943L-466 800ZM400 300L-540 642L-585 474ZM400 300L-600 300L-585 126ZM400 300L-540 -42L-466 -200ZM400 300L-366 -343L-243 -466ZM400 300L-100 -566L58 -640ZM400 300L226 -685L400 -700ZM400 300L574 -685L742 -640ZM400 300L900 -566L1043 -466ZM400 300L1166 -343L1266 -200ZM400 300L1340 -42L1385 126Z";

    uint256 private constant MAX_ROWS = 6;

    function partURI(uint256 tokenId, IRender.PartView memory partView) external pure returns (string memory) {
        string memory name = SvgLib.clean(partView.name);
        string memory build = _build(partView);
        bytes memory json = abi.encodePacked(
            '{"name":"',
            name,
            " #",
            SvgLib.uintToString(tokenId),
            '","description":"A DuckWek part licence. The picture is drawn on chain from the part\'s own traits.","image":"',
            SvgLib.svgUri(_svg(tokenId, partView, name, build, false)),
            '","animation_url":"',
            SvgLib.svgUri(_svg(tokenId, partView, name, build, true)),
            '","attributes":[{"trait_type":"Slot","value":"',
            _slotName(partView.slot, false),
            '"},{"trait_type":"Build","value":"',
            SvgLib.capitalize(_lower(build)),
            '"}',
            _attributes(partView),
            "]}"
        );
        return SvgLib.jsonUri(json);
    }

    // ─── Svg ───

    function _svg(
        uint256 tokenId,
        IRender.PartView memory partView,
        string memory name,
        string memory build,
        bool animated
    ) private pure returns (bytes memory) {
        string memory frame = _frame(partView.slot);
        uint256 rows = partView.keys.length > MAX_ROWS ? MAX_ROWS : partView.keys.length;
        uint256 cardHeight = 24 + rows * 38;
        uint256 cardY = 736 - cardHeight;
        return abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800" role="img" aria-label="',
            name,
            '"><rect width="800" height="800" fill="#1E1446"/>',
            _rays(animated),
            '<rect x="28" y="28" width="744" height="744" rx="48" fill="none" stroke="#000" stroke-width="22"/>',
            '<rect x="28" y="28" width="744" height="744" rx="48" fill="none" stroke="',
            frame,
            '" stroke-width="10"/>',
            _top(tokenId, partView.slot, build, frame),
            _art(partView, animated),
            _name(name, cardY),
            _stats(partView, rows, cardY, cardHeight),
            "</svg>"
        );
    }

    function _rays(bool animated) private pure returns (bytes memory) {
        if (!animated) return abi.encodePacked('<path d="', RAYS, '" fill="#2A1D5E"/>');

        return abi.encodePacked(
            '<g><path d="',
            RAYS,
            '" fill="#2A1D5E"/><animateTransform attributeName="transform" type="rotate" from="0 400 300" to="360 400 300" dur="30s" repeatCount="indefinite"/></g>'
        );
    }

    function _top(uint256 tokenId, uint8 slot, string memory build, string memory frame)
        private
        pure
        returns (bytes memory)
    {
        string memory left = string.concat(_slotName(slot, true), unicode" · ", build);
        string memory right = string.concat("LICENSE #", SvgLib.uintToString(tokenId));
        uint256 leftWidth = SvgLib.pillWidth(bytes(left).length, 17);
        uint256 rightWidth = SvgLib.pillWidth(bytes(right).length, 15);
        return abi.encodePacked(
            SvgLib.pill(
                64,
                60,
                leftWidth,
                frame,
                "#1E1446",
                'font-family="Rubik,Arial,sans-serif" font-size="24" font-weight="900" letter-spacing="2"',
                left
            ),
            SvgLib.pill(
                736 - rightWidth,
                60,
                rightWidth,
                "#fff",
                "#1E1446",
                'font-family="\'JetBrains Mono\',monospace" font-size="24" font-weight="700"',
                right
            )
        );
    }

    function _art(IRender.PartView memory partView, bool animated) private pure returns (bytes memory) {
        string memory fill = SvgLib.color(partView.color);
        (string memory viewBox, string memory shape) = _geometry(partView.slot);
        bytes32 nameHash = keccak256(bytes(partView.name));
        string memory firstColor = _accent(uint8(nameHash[0]));
        string memory secondColor = _accent(uint8(nameHash[1]));
        bytes memory part = abi.encodePacked(
            '<svg x="190" y="150" width="420" height="300" viewBox="',
            viewBox,
            '" overflow="visible"><polygon points="',
            shape,
            '" fill="',
            fill,
            '" stroke="#000" stroke-width="3" stroke-linejoin="round"/>',
            _decoration(partView.slot, firstColor, secondColor),
            "</svg>"
        );
        if (!animated) return part;

        return abi.encodePacked(
            "<g>",
            part,
            '<animateTransform attributeName="transform" type="translate" values="0 0;0 -14;0 0" dur="2.4s" repeatCount="indefinite"/></g>'
        );
    }

    function _decoration(uint8 slot, string memory firstColor, string memory secondColor)
        private
        pure
        returns (bytes memory)
    {
        if (slot == 0) {
            return abi.encodePacked(
                '<polyline points="66,62 100,38" fill="none" stroke="',
                firstColor,
                '" stroke-width="2.5" stroke-linecap="round"/>',
                '<polyline points="74,66 104,42" fill="none" stroke="',
                secondColor,
                '" stroke-width="2.5" stroke-linecap="round"/>',
                '<polyline points="90,74 84,80 92,82 86,88" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"/>'
            );
        }

        if (slot == 1) {
            return abi.encodePacked(
                '<polyline points="30,62 14,60" fill="none" stroke="',
                firstColor,
                '" stroke-width="2.5" stroke-linecap="round"/>',
                '<polyline points="31,72 15,76" fill="none" stroke="',
                secondColor,
                '" stroke-width="2.5" stroke-linecap="round"/>'
            );
        }

        return abi.encodePacked(
            '<polyline points="121,34 138,39" fill="none" stroke="',
            firstColor,
            '" stroke-width="1.6" stroke-linecap="round"/>',
            '<polyline points="121,44 138,40" fill="none" stroke="',
            secondColor,
            '" stroke-width="1.6" stroke-linecap="round"/>'
        );
    }

    function _name(string memory name, uint256 cardY) private pure returns (bytes memory) {
        uint256 length = bytes(name).length;
        uint256 fontSize = length <= 14 ? 66 : (924 / length);
        if (fontSize < 36) fontSize = 36;

        return abi.encodePacked(
            '<text x="64" y="',
            SvgLib.uintToString(cardY - 26),
            '" font-family="\'Lilita One\',Impact,sans-serif" font-size="',
            SvgLib.uintToString(fontSize),
            '" fill="#fff" stroke="#000" stroke-width="8" paint-order="stroke fill" stroke-linejoin="round">',
            name,
            "</text>"
        );
    }

    function _stats(IRender.PartView memory partView, uint256 rows, uint256 cardY, uint256 cardHeight)
        private
        pure
        returns (bytes memory out)
    {
        out = abi.encodePacked(
            '<rect x="64" y="',
            SvgLib.uintToString(cardY),
            '" width="672" height="',
            SvgLib.uintToString(cardHeight),
            '" rx="26" fill="#fff" stroke="#000" stroke-width="5"/>'
        );
        for (uint256 rowIndex; rowIndex < rows; ++rowIndex) {
            int256 value = partView.values[rowIndex];
            uint256 rowTop = cardY + 12 + rowIndex * 38;
            int256 percent = 50 + 25 * value;
            if (percent < 6) percent = 6;

            if (percent > 100) percent = 100;

            uint256 fillWidth = (442 * uint256(percent)) / 100;
            out = abi.encodePacked(
                out,
                '<text x="84" y="',
                SvgLib.uintToString(rowTop + 19),
                '" font-family="Rubik,Arial,sans-serif" font-size="22" font-weight="900" fill="#1E1446">',
                SvgLib.capitalize(SvgLib.key(partView.keys[rowIndex])),
                "</text>",
                '<rect x="206" y="',
                SvgLib.uintToString(rowTop + 4),
                '" width="450" height="26" rx="13" fill="#EEE8FF" stroke="#000" stroke-width="4"/>',
                '<rect x="210" y="',
                SvgLib.uintToString(rowTop + 8),
                '" width="',
                SvgLib.uintToString(fillWidth),
                '" height="18" rx="9" fill="',
                _statColor(SvgLib.key(partView.keys[rowIndex])),
                '"/>',
                '<text x="718" y="',
                SvgLib.uintToString(rowTop + 19),
                '" text-anchor="end" font-family="\'JetBrains Mono\',monospace" font-size="22" font-weight="700" fill="#1E1446">',
                SvgLib.stat(value),
                "</text>"
            );
        }
    }

    // ─── Traits ───

    function _build(IRender.PartView memory partView) private pure returns (string memory) {
        int256 best = type(int256).min;
        uint256 bestIndex = 0;
        uint256 ties = 0;
        for (uint256 valueIndex; valueIndex < partView.values.length; ++valueIndex) {
            if (partView.values[valueIndex] > best) {
                best = partView.values[valueIndex];
                bestIndex = valueIndex;
                ties = 1;
            } else if (partView.values[valueIndex] == best) {
                ++ties;
            }
        }

        if (partView.values.length == 0 || best <= 0 || ties > 1) return "ALL-ROUND";

        return string.concat(SvgLib.upper(SvgLib.key(partView.keys[bestIndex])), " BUILD");
    }

    function _attributes(IRender.PartView memory partView) private pure returns (bytes memory out) {
        for (uint256 keyIndex; keyIndex < partView.keys.length; ++keyIndex) {
            out = abi.encodePacked(
                out,
                ',{"trait_type":"',
                SvgLib.capitalize(SvgLib.key(partView.keys[keyIndex])),
                '","display_type":"number","value":',
                SvgLib.intToString(partView.values[keyIndex]),
                "}"
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

    function _accent(uint8 byteValue) private pure returns (string memory) {
        uint8 colorIndex = byteValue % 6;
        if (colorIndex == 0) return "#FF7AB6";

        if (colorIndex == 1) return "#4ED1C5";

        if (colorIndex == 2) return "#FFC93C";

        if (colorIndex == 3) return "#836EF9";

        if (colorIndex == 4) return "#B8F35A";

        return "#F25F5C";
    }

    function _statColor(string memory statKey) private pure returns (string memory) {
        bytes32 keyHash = keccak256(bytes(statKey));
        if (keyHash == keccak256("speed")) return "#FFC93C";

        if (keyHash == keccak256("weight")) return "#C9B8FF";

        if (keyHash == keccak256("boost")) return "#F25F5C";

        return "#B8F35A";
    }

    function _lower(string memory text) private pure returns (string memory) {
        bytes memory source = bytes(text);
        for (uint256 index; index < source.length; ++index) {
            if (source[index] >= 0x41 && source[index] <= 0x5a) source[index] = bytes1(uint8(source[index]) + 32);
        }

        return string(source);
    }
}
// slither-disable-end encode-packed-collision
