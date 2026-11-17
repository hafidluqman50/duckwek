// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @notice Small helpers shared by the three renderers. Pure functions only.
library SvgLib {
    bytes16 private constant HEX = "0123456789abcdef";
    bytes16 private constant HEX_UPPER = "0123456789ABCDEF";

    /// @dev Strips every character that could break out of JSON or SVG text: control characters, `" \ < > & '`. Names are
    ///      reviewed before they reach the chain, this is the second line of defence.
    function clean(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory o = new bytes(b.length);
        uint256 n;
        for (uint256 i; i < b.length; ++i) {
            bytes1 c = b[i];
            if (uint8(c) < 0x20 || c == '"' || c == "\\" || c == "<" || c == ">" || c == "&" || c == "'") continue;
            o[n++] = c;
        }
        assembly {
            mstore(o, n)
        }
        return string(o);
    }

    function i2s(int256 v) internal pure returns (string memory) {
        return Strings.toStringSigned(v);
    }

    function u2s(uint256 v) internal pure returns (string memory) {
        return Strings.toString(v);
    }

    /// @dev Signed stat for display: `+2`, `0`, `−1` (U+2212 minus).
    function stat(int256 v) internal pure returns (string memory) {
        if (v > 0) return string.concat("+", u2s(uint256(v)));
        if (v < 0) return string.concat(unicode"−", u2s(uint256(-v)));
        return "0";
    }

    /// @dev USDC (6 decimals) as `1`, `0.1`, `2.5`: up to 2 decimals, trailing zeros trimmed.
    function usdc(uint256 v) internal pure returns (string memory) {
        uint256 whole = v / 1_000_000;
        uint256 cents = (v % 1_000_000) / 10_000;
        if (cents == 0) return u2s(whole);
        string memory frac = cents < 10 ? string.concat("0", u2s(cents)) : u2s(cents);
        if (cents % 10 == 0) frac = u2s(cents / 10);
        return string.concat(u2s(whole), ".", frac);
    }

    function color(uint24 c) internal pure returns (string memory) {
        bytes memory o = new bytes(7);
        o[0] = "#";
        for (uint256 i; i < 6; ++i) o[6 - i] = HEX_UPPER[(c >> (4 * i)) & 0xf];
        return string(o);
    }

    /// @dev `0xabcd…1234`
    function shortAddr(address a) internal pure returns (string memory) {
        bytes memory full = bytes(Strings.toHexString(a));
        bytes memory o = new bytes(15);
        for (uint256 i; i < 6; ++i) o[i] = full[i];
        // "…" is 3 bytes in UTF-8
        o[6] = 0xE2;
        o[7] = 0x80;
        o[8] = 0xA6;
        for (uint256 i; i < 6; ++i) o[9 + i] = full[36 + i];
        return string(o);
    }

    function hexBytes(bytes memory b, uint256 max) internal pure returns (string memory) {
        uint256 n = b.length < max ? b.length : max;
        bytes memory o = new bytes(n * 2);
        for (uint256 i; i < n; ++i) {
            o[2 * i] = HEX[uint8(b[i]) >> 4];
            o[2 * i + 1] = HEX[uint8(b[i]) & 0xf];
        }
        return string(o);
    }

    function upper(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory o = new bytes(b.length);
        for (uint256 i; i < b.length; ++i) o[i] = (b[i] >= 0x61 && b[i] <= 0x7a) ? bytes1(uint8(b[i]) - 32) : b[i];
        return string(o);
    }

    function capitalize(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        if (b.length > 0 && b[0] >= 0x61 && b[0] <= 0x7a) b[0] = bytes1(uint8(b[0]) - 32);
        return string(b);
    }

    /// @dev bytes32 key ("speed") -> string, trailing zeros trimmed.
    function key(bytes32 k) internal pure returns (string memory) {
        uint256 n;
        while (n < 32 && k[n] != 0) ++n;
        bytes memory o = new bytes(n);
        for (uint256 i; i < n; ++i) o[i] = k[i];
        return clean(string(o));
    }

    function svgUri(bytes memory svg) internal pure returns (string memory) {
        return string.concat("data:image/svg+xml;base64,", Base64.encode(svg));
    }

    function jsonUri(bytes memory json) internal pure returns (string memory) {
        return string.concat("data:application/json;base64,", Base64.encode(json));
    }

    /// @dev Approximate text width in px: `chars * cw + 36` (padding). Used to size pills without measuring text.
    function pillW(uint256 chars, uint256 cw) internal pure returns (uint256) {
        return 36 + chars * cw;
    }

    /// @dev A complete rounded pill with centred text. `style` is the text attributes (family, size, weight), pre-built.
    function pill(uint256 x, uint256 y, uint256 w, string memory fill, string memory textFill, string memory style, string memory text)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(
            '<rect x="', u2s(x), '" y="', u2s(y), '" width="', u2s(w), '" height="54" rx="27" fill="', fill,
            '" stroke="#000" stroke-width="5"/><text x="', u2s(x + w / 2), '" y="', u2s(y + 28),
            '" text-anchor="middle" dominant-baseline="central" fill="', textFill, '" ', style, ">", text, "</text>"
        );
    }
}
