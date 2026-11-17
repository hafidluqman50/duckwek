// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {DuckWekBase} from "./DuckWekBase.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {DuckWekVault} from "../src/DuckWekVault.sol";
import {IRender} from "../src/render/IRender.sol";
import {SvgLib} from "../src/render/SvgLib.sol";
import {SegmentLib} from "../src/render/SegmentLib.sol";

contract RenderersTest is DuckWekBase {
    // ─── Helpers ───

    function _field(string memory json, string memory key) internal pure returns (string memory) {
        bytes memory jsonBytes = bytes(json);
        bytes memory keyPattern = bytes(string.concat('"', key, '":"'));
        for (uint256 offset; offset + keyPattern.length < jsonBytes.length; ++offset) {
            bool hit = true;
            for (uint256 matchIndex; matchIndex < keyPattern.length; ++matchIndex) {
                if (jsonBytes[offset + matchIndex] != keyPattern[matchIndex]) {
                    hit = false;
                    break;
                }
            }

            if (!hit) continue;

            uint256 start = offset + keyPattern.length;
            uint256 end = start;
            while (jsonBytes[end] != '"') ++end;

            bytes memory value = new bytes(end - start);
            for (uint256 characterIndex; characterIndex < value.length; ++characterIndex) {
                value[characterIndex] = jsonBytes[start + characterIndex];
            }

            return string(value);
        }

        return "";
    }

    function _decode(string memory uri, uint256 prefixLength) internal pure returns (string memory) {
        bytes memory encoded = bytes(uri);
        bytes memory payload = new bytes(encoded.length - prefixLength);
        for (uint256 index; index < payload.length; ++index) {
            payload[index] = encoded[prefixLength + index];
        }

        return string(_decodeBase64(payload));
    }

    function _decodeBase64(bytes memory encoded) internal pure returns (bytes memory) {
        bytes memory decoded = new bytes((encoded.length / 4) * 3);
        uint256 decodedLength;
        uint256 accumulator;
        uint256 bitCount;
        for (uint256 index; index < encoded.length; ++index) {
            uint8 character = uint8(encoded[index]);
            uint256 sextet;
            if (character >= 65 && character <= 90) sextet = character - 65;
            else if (character >= 97 && character <= 122) sextet = character - 71;
            else if (character >= 48 && character <= 57) sextet = character + 4;
            else if (character == 43) sextet = 62;
            else if (character == 47) sextet = 63;
            else continue;
            accumulator = (accumulator << 6) | sextet;
            bitCount += 6;
            if (bitCount >= 8) {
                bitCount -= 8;
                decoded[decodedLength++] = bytes1(uint8(accumulator >> bitCount));
                accumulator &= (1 << bitCount) - 1;
            }
        }

        assembly {
            mstore(decoded, decodedLength)
        }

        return decoded;
    }

    function _json(string memory tokenUri) internal pure returns (string memory) {
        return _decode(tokenUri, bytes("data:application/json;base64,").length);
    }

    function _svgOf(string memory json, string memory field) internal pure returns (string memory) {
        return _decode(_field(json, field), bytes("data:image/svg+xml;base64,").length);
    }

    function _buy(address buyer, uint256 key, uint256 typeId, uint256 salt) internal returns (uint256 tokenId) {
        DuckWekVault.Order memory order = _order(buyer, 3, typeId, bytes32(0), ONE, salt);
        DuckWekVault.Permit memory permit = _permit(key, CAP, block.timestamp + 1 days);
        tokenId = _permitAndSpend(order, permit);
    }

    function _write(string memory name, string memory svg) internal {
        vm.createDir("./out/art", true);
        vm.writeFile(string.concat("./out/art/", name, ".svg"), svg);
    }

    // ─── Parts ───

    function test_tokenURI_everyPartDrawsOwnPicture() public {
        uint256 firstTokenId = _buy(alice, aliceKey, 0, 1);
        _buy(alice, aliceKey, 1, 2);
        _buy(alice, aliceKey, 2, 3);
        string memory firstJson = _json(parts.tokenURI(firstTokenId));
        string memory secondJson = _json(parts.tokenURI(firstTokenId + 1));
        string memory thirdJson = _json(parts.tokenURI(firstTokenId + 2));
        string memory firstSvg = _svgOf(firstJson, "image");
        string memory secondSvg = _svgOf(secondJson, "image");
        string memory thirdSvg = _svgOf(thirdJson, "image");
        assertTrue(keccak256(bytes(firstSvg)) != keccak256(bytes(secondSvg)));
        assertTrue(keccak256(bytes(secondSvg)) != keccak256(bytes(thirdSvg)));
        assertTrue(keccak256(bytes(firstSvg)) != keccak256(bytes(thirdSvg)));
        assertEq(_field(firstJson, "name"), "Layangan Wings #1");
        assertTrue(_has(firstSvg, "WINGS"));
        assertTrue(_has(firstSvg, "SPEED BUILD"));
        assertTrue(_has(secondSvg, "TAIL"));
        assertTrue(_has(secondSvg, "ALL-ROUND"));
        assertTrue(_has(thirdSvg, "BILL"));
        assertTrue(_has(thirdSvg, "BOOST BUILD"));
        assertTrue(_has(firstSvg, unicode"−1"));
        assertTrue(_has(firstSvg, "#FFFFFF"));
        assertTrue(_has(secondSvg, "#FF9F1C"));
        assertTrue(_has(thirdSvg, "#9AA3B8"));
        string memory animation = _svgOf(firstJson, "animation_url");
        assertTrue(_has(animation, "animateTransform"));
        assertFalse(_has(firstSvg, "animate"));
        _write("part-layangan-wings", firstSvg);
        _write("part-layangan-wings-anim", animation);
        _write("part-turbo-tail", secondSvg);
        _write("part-iron-bill", thirdSvg);
    }

    function test_tokenURI_twoPartsWithSameSlotStillDiffer() public {
        vm.startPrank(owner);
        parts.createPlatformPart(treasury, "Kite Wings", ONE, 0, 0xFF7AB6, _keys(), _vals(1, 1, 0));
        parts.createPlatformPart(treasury, "Heavy Wings", ONE, 0, 0x836EF9, _keys(), _vals(0, 2, 0));
        vm.stopPrank();
        uint256 firstTokenId = _buy(alice, aliceKey, 3, 1);
        _buy(alice, aliceKey, 4, 2);
        string memory firstSvg = _svgOf(_json(parts.tokenURI(firstTokenId)), "image");
        string memory secondSvg = _svgOf(_json(parts.tokenURI(firstTokenId + 1)), "image");
        assertTrue(keccak256(bytes(firstSvg)) != keccak256(bytes(secondSvg)));
        assertTrue(_has(secondSvg, "WEIGHT BUILD"));
        _write("part-heavy-wings", secondSvg);
    }

    function test_tokenURI_samePartBoughtByTwoWalletsSharesArtNotId() public {
        uint256 aliceTokenId = _buy(alice, aliceKey, 0, 1);
        uint256 hostTokenId = _buy(host, hostKey, 0, 1);
        string memory aliceJson = _json(parts.tokenURI(aliceTokenId));
        string memory hostJson = _json(parts.tokenURI(hostTokenId));
        assertEq(_field(aliceJson, "name"), "Layangan Wings #1");
        assertEq(_field(hostJson, "name"), "Layangan Wings #2");
        assertTrue(_has(_svgOf(hostJson, "image"), "LICENSE #2"));
    }

    function test_tokenURI_newStatKeyShowsUpInArt() public {
        vm.prank(owner);
        parts.addStat("grip");
        uint256 tokenId = _buy(alice, aliceKey, 0, 1);
        string memory svg = _svgOf(_json(parts.tokenURI(tokenId)), "image");
        assertTrue(_has(svg, "Grip"));
    }

    function test_tokenURI_hostileNamesAreStripped() public {
        bytes32[] memory keys = new bytes32[](1);
        keys[0] = "speed";
        int8[] memory values = new int8[](1);
        values[0] = 1;
        vm.prank(owner);
        uint256 partTypeId = parts.createPlatformPart(treasury, 'A"<script>&\'x\\', ONE, 0, 0, keys, values);
        uint256 tokenId = _buy(alice, aliceKey, partTypeId, 1);
        string memory json = _json(parts.tokenURI(tokenId));
        string memory svg = _svgOf(json, "image");
        assertEq(_field(json, "name"), "Ascriptx #1");
        assertFalse(_has(svg, "<script"));
        assertFalse(_has(svg, "&"));
    }

    function test_tokenURI_revertsWithoutRendererOrToken() public {
        uint256 tokenId = _buy(alice, aliceKey, 0, 1);
        vm.prank(owner);
        parts.setRenderer(address(0));
        vm.expectRevert();
        parts.tokenURI(tokenId);
        vm.expectRevert();
        parts.tokenURI(999);
    }

    // ─── Circuits ───

    function test_tokenURI_eachCircuitDrawsOwnRoad() public {
        string memory kali = _json(tracks.tokenURI(1));
        string memory merapi = _json(tracks.tokenURI(2));
        string memory sKali = _svgOf(kali, "image");
        string memory sMerapi = _svgOf(merapi, "image");
        assertTrue(keccak256(bytes(sKali)) != keccak256(bytes(sMerapi)));
        assertEq(_field(kali, "name"), "Kali Code Sprint");
        assertEq(_field(merapi, "name"), "Merapi Ring");
        assertTrue(_has(sKali, "1 lap"));
        assertTrue(_has(sKali, "6 turns"));
        assertTrue(_has(sKali, "1800 m"));
        assertTrue(_has(sMerapi, "2 laps"));
        assertTrue(_has(sMerapi, "6 turns"));
        assertTrue(_has(sMerapi, "1880 m"));
        assertTrue(_has(sMerapi, "Z"));
        assertFalse(_has(sKali, "Z"));
        assertTrue(_has(sKali, "Platform circuit"));
        string memory animation = _svgOf(merapi, "animation_url");
        assertTrue(_has(animation, "animateMotion"));
        assertFalse(_has(sMerapi, "animate"));
        _write("circuit-kali-code-sprint", sKali);
        _write("circuit-merapi-ring", sMerapi);
        _write("circuit-merapi-ring-anim", animation);
    }

    function test_tokenURI_creatorCircuitArtChangesWithNewLayoutVersion() public {
        uint256 trackId = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        string memory svgBefore = _svgOf(_json(tracks.tokenURI(trackId)), "image");
        uint256 deadline = block.timestamp + 1 days;
        bytes memory signature = _layoutSig(creatorKey, trackId, KALI, 3, 2, deadline);
        vm.prank(operator);
        tracks.publishLayout(trackId, KALI, 3, deadline, signature);
        string memory svgAfter = _svgOf(_json(tracks.tokenURI(trackId)), "image");
        assertTrue(keccak256(bytes(svgBefore)) != keccak256(bytes(svgAfter)));
        assertTrue(_has(svgAfter, "3 laps"));
        assertTrue(_has(svgAfter, "Holder earns 50%"));
        assertTrue(_has(svgAfter, "LAYOUT v2"));
        _write("circuit-creator-cup", svgAfter);
    }

    function test_walk_closesAndMeasures() public pure {
        (uint16 turns, uint32 lengthMetres) = SegmentLib.turnsAndLength(hex"0a45092a2b0d4c2c2c");
        assertEq(turns, 6);
        assertEq(lengthMetres, 1880);
        (,, bool closed,) = SegmentLib.walk(hex"0a45092a2b0d4c2c2c");
        assertTrue(closed);
        (,, bool closedKali,) = SegmentLib.walk(hex"0f4c3d4c3d4c3d");
        assertFalse(closedKali);
        (,, bool square,) = SegmentLib.walk(hex"0a4a4a4a");
        assertTrue(square);
    }

    // ─── Titles ───

    function test_tokenURI_titlesDifferByRankAndShowTrack() public {
        uint256 roomId = _openRaceRoom();
        DuckWekVault.Order[] memory orders = new DuckWekVault.Order[](1);
        DuckWekVault.Permit[] memory permits = new DuckWekVault.Permit[](1);
        orders[0] = DuckWekVault.Order(alice, 2, 0, keccak256("WEK-RACE"), _empty(), TICKET, 1);
        permits[0] = _permit(aliceKey, CAP, block.timestamp + 1 days);
        vm.prank(operator);
        race.joinBatch(roomId, orders, permits);
        vm.prank(operator);
        race.start(roomId, 2, bytes32(0), bytes32(0));
        address[3] memory podium = [host, alice, address(0)];
        vm.prank(operator);
        race.finalize(roomId, bytes32(0), podium);
        string memory first = _json(badge.tokenURI(1));
        string memory second = _json(badge.tokenURI(2));
        string memory winnerSvg = _svgOf(first, "image");
        string memory runnerUpSvg = _svgOf(second, "image");
        assertTrue(keccak256(bytes(winnerSvg)) != keccak256(bytes(runnerUpSvg)));
        assertEq(_field(first, "name"), "First Time Winner");
        assertEq(_field(second, "name"), "First Time Runner-up");
        assertTrue(_has(winnerSvg, "Kali Code Sprint"));
        assertTrue(_has(winnerSvg, "P1"));
        assertTrue(_has(runnerUpSvg, "P2"));
        assertTrue(_has(winnerSvg, "SOULBOUND"));
        assertTrue(_has(winnerSvg, "RACE #1"));
        assertTrue(_has(_svgOf(first, "animation_url"), "<animate "));
        _write("title-winner", winnerSvg);
        _write("title-runner-up", runnerUpSvg);
        _write("title-winner-anim", _svgOf(first, "animation_url"));
    }

    function _openRaceRoom() internal returns (uint256 roomId) {
        DuckWekVault.Order memory order = _order(host, 1, 1, keccak256("WEK-RACE"), ONE, 9);
        DuckWekVault.Permit memory permit = _permit(hostKey, CAP, block.timestamp + 1 days);
        vm.prank(operator);
        roomId = race.createRoom(order, permit);
    }

    function test_gas_tokenURI() public {
        uint256 tokenId = _buy(alice, aliceKey, 0, 1);
        uint256 gasBefore = gasleft();
        parts.tokenURI(tokenId);
        uint256 part = gasBefore - gasleft();
        gasBefore = gasleft();
        tracks.tokenURI(2);
        uint256 track = gasBefore - gasleft();
        uint256 roomId = _openRaceRoom();
        vm.prank(operator);
        race.start(roomId, 1, bytes32(0), bytes32(0));
        address[3] memory podium = [host, address(0), address(0)];
        vm.prank(operator);
        race.finalize(roomId, bytes32(0), podium);
        gasBefore = gasleft();
        badge.tokenURI(1);
        uint256 title = gasBefore - gasleft();
        emit log_named_uint("gas tokenURI part (view, local EVM)", part);
        emit log_named_uint("gas tokenURI circuit (view, local EVM)", track);
        emit log_named_uint("gas tokenURI title (view, local EVM)", title);
        assertLt(part, 10_000_000);
        assertLt(track, 10_000_000);
        assertLt(title, 10_000_000);
    }

    // ─── The 0..2 stat bars never leave their track ───

    function test_tokenURI_statBarsAreClamped() public {
        bytes32[] memory keys = new bytes32[](3);
        keys[0] = "speed";
        keys[1] = "weight";
        keys[2] = "boost";
        int8[] memory values = new int8[](3);
        values[0] = -100;
        values[1] = 2;
        values[2] = -100;
        vm.prank(owner);
        uint256 partTypeId = parts.createPlatformPart(treasury, "Extreme", ONE, 2, 0x123456, keys, values);
        uint256 tokenId = _buy(alice, aliceKey, partTypeId, 1);
        string memory svg = _svgOf(_json(parts.tokenURI(tokenId)), "image");
        assertTrue(_has(svg, unicode"−100"));
        assertFalse(_has(svg, 'width="-'));
    }

    function _has(string memory hay, string memory needle) internal pure returns (bool) {
        bytes memory haystackBytes = bytes(hay);
        bytes memory needleBytes = bytes(needle);
        if (needleBytes.length == 0 || haystackBytes.length < needleBytes.length) return false;

        for (uint256 offset; offset + needleBytes.length <= haystackBytes.length; ++offset) {
            bool matches = true;
            for (uint256 needleIndex; needleIndex < needleBytes.length; ++needleIndex) {
                if (haystackBytes[offset + needleIndex] != needleBytes[needleIndex]) {
                    matches = false;
                    break;
                }
            }

            if (matches) return true;
        }

        return false;
    }
}
