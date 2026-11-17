// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

library SvgLib {
    bytes16 private constant HEX = "0123456789abcdef";
    bytes16 private constant HEX_UPPER = "0123456789ABCDEF";

    // slither-disable-start assembly
    function clean(string memory text) internal pure returns (string memory) {
        bytes memory source = bytes(text);
        bytes memory cleaned = new bytes(source.length);
        uint256 cleanedLength;
        for (uint256 index; index < source.length; ++index) {
            bytes1 character = source[index];
            if (
                uint8(character) < 0x20 || character == '"' || character == "\\" || character == "<" || character == ">"
                    || character == "&" || character == "'"
            ) continue;

            cleaned[cleanedLength++] = character;
        }

        assembly {
            mstore(cleaned, cleanedLength)
        }

        return string(cleaned);
    }
    // slither-disable-end assembly

    function intToString(int256 value) internal pure returns (string memory) {
        return Strings.toStringSigned(value);
    }

    function uintToString(uint256 value) internal pure returns (string memory) {
        return Strings.toString(value);
    }

    function stat(int256 value) internal pure returns (string memory) {
        if (value > 0) return string.concat("+", uintToString(uint256(value)));

        if (value < 0) return string.concat(unicode"−", uintToString(uint256(-value)));

        return "0";
    }

    function usdc(uint256 amount) internal pure returns (string memory) {
        uint256 whole = amount / 1_000_000;
        uint256 cents = (amount % 1_000_000) / 10_000;
        if (cents == 0) return uintToString(whole);

        string memory fraction = cents < 10 ? string.concat("0", uintToString(cents)) : uintToString(cents);
        if (cents % 10 == 0) fraction = uintToString(cents / 10);

        return string.concat(uintToString(whole), ".", fraction);
    }

    function color(uint24 rgb) internal pure returns (string memory) {
        bytes memory output = new bytes(7);
        output[0] = "#";
        for (uint256 nibbleIndex; nibbleIndex < 6; ++nibbleIndex) {
            output[6 - nibbleIndex] = HEX_UPPER[(rgb >> (4 * nibbleIndex)) & 0xf];
        }

        return string(output);
    }

    function shortAddress(address account) internal pure returns (string memory) {
        bytes memory full = bytes(Strings.toHexString(account));
        bytes memory shortened = new bytes(15);
        for (uint256 index; index < 6; ++index) {
            shortened[index] = full[index];
        }

        shortened[6] = 0xE2;
        shortened[7] = 0x80;
        shortened[8] = 0xA6;
        for (uint256 index; index < 6; ++index) {
            shortened[9 + index] = full[36 + index];
        }

        return string(shortened);
    }

    function hexBytes(bytes memory input, uint256 maxBytes) internal pure returns (string memory) {
        uint256 count = input.length < maxBytes ? input.length : maxBytes;
        bytes memory output = new bytes(count * 2);
        for (uint256 index; index < count; ++index) {
            output[2 * index] = HEX[uint8(input[index]) >> 4];
            output[2 * index + 1] = HEX[uint8(input[index]) & 0xf];
        }

        return string(output);
    }

    function upper(string memory text) internal pure returns (string memory) {
        bytes memory source = bytes(text);
        bytes memory upperCased = new bytes(source.length);
        for (uint256 index; index < source.length; ++index) {
            upperCased[index] =
                (source[index] >= 0x61 && source[index] <= 0x7a) ? bytes1(uint8(source[index]) - 32) : source[index];
        }

        return string(upperCased);
    }

    function capitalize(string memory text) internal pure returns (string memory) {
        bytes memory source = bytes(text);
        if (source.length > 0 && source[0] >= 0x61 && source[0] <= 0x7a) source[0] = bytes1(uint8(source[0]) - 32);

        return string(source);
    }

    function key(bytes32 statKey) internal pure returns (string memory) {
        uint256 length;
        while (length < 32 && statKey[length] != 0) ++length;

        bytes memory output = new bytes(length);
        for (uint256 index; index < length; ++index) {
            output[index] = statKey[index];
        }

        return clean(string(output));
    }

    function svgUri(bytes memory svg) internal pure returns (string memory) {
        return string.concat("data:image/svg+xml;base64,", Base64.encode(svg));
    }

    function jsonUri(bytes memory json) internal pure returns (string memory) {
        return string.concat("data:application/json;base64,", Base64.encode(json));
    }

    function pillWidth(uint256 characterCount, uint256 characterWidth) internal pure returns (uint256) {
        return 36 + characterCount * characterWidth;
    }

    function pill(
        uint256 left,
        uint256 top,
        uint256 width,
        string memory fill,
        string memory textFill,
        string memory style,
        string memory text
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            '<rect x="',
            uintToString(left),
            '" y="',
            uintToString(top),
            '" width="',
            uintToString(width),
            '" height="54" rx="27" fill="',
            fill,
            '" stroke="#000" stroke-width="5"/><text x="',
            uintToString(left + width / 2),
            '" y="',
            uintToString(top + 28),
            '" text-anchor="middle" dominant-baseline="central" fill="',
            textFill,
            '" ',
            style,
            ">",
            text,
            "</text>"
        );
    }
}
