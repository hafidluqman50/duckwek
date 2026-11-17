// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {DuckWekBase} from "./DuckWekBase.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {DuckWekVault} from "../src/DuckWekVault.sol";
import {IRender} from "../src/render/IRender.sol";
import {SvgLib} from "../src/render/SvgLib.sol";
import {SegmentLib} from "../src/render/SegmentLib.sol";

/// On-chain art: every NFT must draw its own picture from its own traits. Samples are written to out/art for a visual check.
contract RenderersTest is DuckWekBase {
    // ---------- helpers ----------
    function _field(string memory json, string memory key) internal pure returns (string memory) {
        bytes memory j = bytes(json);
        bytes memory k = bytes(string.concat('"', key, '":"'));
        for (uint256 i; i + k.length < j.length; ++i) {
            bool hit = true;
            for (uint256 x; x < k.length; ++x) {
                if (j[i + x] != k[x]) {
                    hit = false;
                    break;
                }
            }
            if (!hit) continue;
            uint256 start = i + k.length;
            uint256 end = start;
            while (j[end] != '"') ++end;
            bytes memory out = new bytes(end - start);
            for (uint256 y; y < out.length; ++y) out[y] = j[start + y];
            return string(out);
        }
        return "";
    }

    function _decode(string memory uri, uint256 prefixLen) internal pure returns (string memory) {
        bytes memory b = bytes(uri);
        bytes memory payload = new bytes(b.length - prefixLen);
        for (uint256 i; i < payload.length; ++i) payload[i] = b[prefixLen + i];
        return string(_b64d(payload));
    }

    function _b64d(bytes memory data) internal pure returns (bytes memory) {
        bytes memory out = new bytes((data.length / 4) * 3);
        uint256 n;
        uint256 acc;
        uint256 bits;
        for (uint256 i; i < data.length; ++i) {
            uint8 c = uint8(data[i]);
            uint256 v;
            if (c >= 65 && c <= 90) v = c - 65;
            else if (c >= 97 && c <= 122) v = c - 71;
            else if (c >= 48 && c <= 57) v = c + 4;
            else if (c == 43) v = 62;
            else if (c == 47) v = 63;
            else continue; // '='
            acc = (acc << 6) | v;
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                out[n++] = bytes1(uint8(acc >> bits));
                acc &= (1 << bits) - 1;
            }
        }
        assembly {
            mstore(out, n)
        }
        return out;
    }

    function _json(string memory tokenUri) internal pure returns (string memory) {
        return _decode(tokenUri, bytes("data:application/json;base64,").length);
    }

    function _svgOf(string memory json, string memory field) internal pure returns (string memory) {
        return _decode(_field(json, field), bytes("data:image/svg+xml;base64,").length);
    }

    function _buy(address who, uint256 key, uint256 typeId, uint256 salt) internal returns (uint256 tokenId) {
        DuckWekVault.Order memory o = _order(who, 3, typeId, bytes32(0), ONE, salt);
        DuckWekVault.Permit memory p = _permit(key, CAP, block.timestamp + 1 days);
        tokenId = _permitAndSpend(o, p);
    }

    function _write(string memory name, string memory svg) internal {
        vm.createDir("./out/art", true); // git-ignored folder: the test creates it, it does not depend on it existing
        vm.writeFile(string.concat("./out/art/", name, ".svg"), svg);
    }

    // ---------- parts ----------
    function test_every_part_draws_its_own_picture() public {
        uint256 a = _buy(alice, aliceKey, 0, 1); // Layangan Wings
        _buy(alice, aliceKey, 1, 2); // Turbo Tail
        _buy(alice, aliceKey, 2, 3); // Iron Bill
        string memory j0 = _json(parts.tokenURI(a));
        string memory j1 = _json(parts.tokenURI(a + 1));
        string memory j2 = _json(parts.tokenURI(a + 2));
        string memory s0 = _svgOf(j0, "image");
        string memory s1 = _svgOf(j1, "image");
        string memory s2 = _svgOf(j2, "image");
        assertTrue(keccak256(bytes(s0)) != keccak256(bytes(s1)));
        assertTrue(keccak256(bytes(s1)) != keccak256(bytes(s2)));
        assertTrue(keccak256(bytes(s0)) != keccak256(bytes(s2)));
        // slot, name, build label and stat values come from the part's traits
        assertEq(_field(j0, "name"), "Layangan Wings #1");
        assertTrue(_has(s0, "WINGS"));
        assertTrue(_has(s0, "SPEED BUILD"));
        assertTrue(_has(s1, "TAIL"));
        assertTrue(_has(s1, "ALL-ROUND")); // speed +1 and weight +1 tie
        assertTrue(_has(s2, "BILL"));
        assertTrue(_has(s2, "BOOST BUILD"));
        assertTrue(_has(s0, unicode"−1")); // boost -1 shown with a real minus
        assertTrue(_has(s0, "#FFFFFF"));
        assertTrue(_has(s1, "#FF9F1C"));
        assertTrue(_has(s2, "#9AA3B8"));
        // animation_url is a different, animated drawing; the static image has no motion
        string memory anim = _svgOf(j0, "animation_url");
        assertTrue(_has(anim, "animateTransform"));
        assertFalse(_has(s0, "animate"));
        _write("part-layangan-wings", s0);
        _write("part-layangan-wings-anim", anim);
        _write("part-turbo-tail", s1);
        _write("part-iron-bill", s2);
    }

    function test_two_parts_with_the_same_slot_still_differ() public {
        vm.startPrank(owner);
        parts.createPlatformPart(treasury, "Kite Wings", ONE, 0, 0xFF7AB6, _keys(), _vals(1, 1, 0));
        parts.createPlatformPart(treasury, "Heavy Wings", ONE, 0, 0x836EF9, _keys(), _vals(0, 2, 0));
        vm.stopPrank();
        uint256 a = _buy(alice, aliceKey, 3, 1);
        _buy(alice, aliceKey, 4, 2);
        string memory s0 = _svgOf(_json(parts.tokenURI(a)), "image");
        string memory s1 = _svgOf(_json(parts.tokenURI(a + 1)), "image");
        assertTrue(keccak256(bytes(s0)) != keccak256(bytes(s1)));
        assertTrue(_has(s1, "WEIGHT BUILD"));
        _write("part-heavy-wings", s1);
    }

    function test_the_same_part_bought_by_two_wallets_shares_the_art_but_not_the_id() public {
        uint256 a = _buy(alice, aliceKey, 0, 1);
        uint256 b = _buy(host, hostKey, 0, 1);
        string memory j0 = _json(parts.tokenURI(a));
        string memory j1 = _json(parts.tokenURI(b));
        assertEq(_field(j0, "name"), "Layangan Wings #1");
        assertEq(_field(j1, "name"), "Layangan Wings #2");
        assertTrue(_has(_svgOf(j1, "image"), "LICENSE #2"));
    }

    function test_a_new_stat_key_shows_up_in_the_art() public {
        vm.prank(owner);
        parts.addStat("grip");
        uint256 a = _buy(alice, aliceKey, 0, 1);
        string memory s = _svgOf(_json(parts.tokenURI(a)), "image");
        assertTrue(_has(s, "Grip")); // an old type reads 0 for the new key
    }

    function test_hostile_names_are_stripped() public {
        bytes32[] memory k = new bytes32[](1);
        k[0] = "speed";
        int8[] memory v = new int8[](1);
        v[0] = 1;
        vm.prank(owner);
        uint256 t = parts.createPlatformPart(treasury, 'A"<script>&\'x\\', ONE, 0, 0, k, v);
        uint256 id = _buy(alice, aliceKey, t, 1);
        string memory json = _json(parts.tokenURI(id));
        string memory svg = _svgOf(json, "image");
        assertEq(_field(json, "name"), "Ascriptx #1");
        assertFalse(_has(svg, "<script"));
        assertFalse(_has(svg, "&"));
    }

    function test_tokenURI_reverts_without_a_renderer_or_a_token() public {
        uint256 id = _buy(alice, aliceKey, 0, 1);
        vm.prank(owner);
        parts.setRenderer(address(0));
        vm.expectRevert();
        parts.tokenURI(id);
        vm.expectRevert();
        parts.tokenURI(999);
    }

    // ---------- circuits ----------
    function test_each_circuit_draws_its_own_road() public {
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
        assertTrue(_has(sMerapi, "Z")); // the closed layout closes its path
        assertFalse(_has(sKali, "Z"));
        assertTrue(_has(sKali, "Platform circuit"));
        string memory anim = _svgOf(merapi, "animation_url");
        assertTrue(_has(anim, "animateMotion"));
        assertFalse(_has(sMerapi, "animate"));
        _write("circuit-kali-code-sprint", sKali);
        _write("circuit-merapi-ring", sMerapi);
        _write("circuit-merapi-ring-anim", anim);
    }

    function test_creator_circuit_art_changes_with_a_new_layout_version() public {
        uint256 id = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        string memory before_ = _svgOf(_json(tracks.tokenURI(id)), "image");
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _layoutSig(creatorKey, id, KALI, 3, 2, deadline);
        vm.prank(operator);
        tracks.publishLayout(id, KALI, 3, deadline, sig);
        string memory after_ = _svgOf(_json(tracks.tokenURI(id)), "image");
        assertTrue(keccak256(bytes(before_)) != keccak256(bytes(after_)));
        assertTrue(_has(after_, "3 laps"));
        assertTrue(_has(after_, "Holder earns 50%"));
        assertTrue(_has(after_, "LAYOUT v2"));
        _write("circuit-creator-cup", after_);
    }

    function test_segment_walk_closes_and_measures() public pure {
        (uint16 turns, uint32 len) = SegmentLib.turnsAndLength(hex"0a45092a2b0d4c2c2c");
        assertEq(turns, 6);
        assertEq(len, 1880);
        (,, bool closed,) = SegmentLib.walk(hex"0a45092a2b0d4c2c2c");
        assertTrue(closed);
        (,, bool closedKali,) = SegmentLib.walk(hex"0f4c3d4c3d4c3d");
        assertFalse(closedKali);
        // a plain square closes
        (,, bool square,) = SegmentLib.walk(hex"0a4a4a4a");
        assertTrue(square);
    }

    // ---------- titles ----------
    function test_titles_differ_by_rank_and_show_the_track() public {
        uint256 rid = _openRaceRoom(); // Kali Code Sprint, host joined
        DuckWekVault.Order[] memory os = new DuckWekVault.Order[](1);
        DuckWekVault.Permit[] memory ps = new DuckWekVault.Permit[](1);
        os[0] = DuckWekVault.Order(alice, 2, 0, keccak256("WEK-RACE"), _empty(), TICKET, 1);
        ps[0] = _permit(aliceKey, CAP, block.timestamp + 1 days);
        vm.prank(operator);
        race.joinBatch(rid, os, ps);
        vm.prank(operator);
        race.start(rid, 2, bytes32(0), bytes32(0));
        address[3] memory pod = [host, alice, address(0)];
        vm.prank(operator);
        race.finalize(rid, bytes32(0), pod);
        string memory first = _json(badge.tokenURI(1));
        string memory second = _json(badge.tokenURI(2));
        string memory s1 = _svgOf(first, "image");
        string memory s2 = _svgOf(second, "image");
        assertTrue(keccak256(bytes(s1)) != keccak256(bytes(s2)));
        assertEq(_field(first, "name"), "First Time Winner");
        assertEq(_field(second, "name"), "First Time Runner-up");
        assertTrue(_has(s1, "Kali Code Sprint"));
        assertTrue(_has(s1, "P1"));
        assertTrue(_has(s2, "P2"));
        assertTrue(_has(s1, "SOULBOUND"));
        assertTrue(_has(s1, "RACE #1"));
        assertTrue(_has(_svgOf(first, "animation_url"), "<animate "));
        _write("title-winner", s1);
        _write("title-runner-up", s2);
        _write("title-winner-anim", _svgOf(first, "animation_url"));
    }

    function _openRaceRoom() internal returns (uint256 id) {
        DuckWekVault.Order memory o = _order(host, 1, 1, keccak256("WEK-RACE"), ONE, 9);
        DuckWekVault.Permit memory p = _permit(hostKey, CAP, block.timestamp + 1 days);
        vm.prank(operator);
        id = race.createRoom(o, p);
    }

    /// `tokenURI` is a view called by wallets over eth_call: it must stay far below the 30M per-call gas limit.
    function test_gas_tokenURI() public {
        uint256 id = _buy(alice, aliceKey, 0, 1);
        uint256 g = gasleft();
        parts.tokenURI(id);
        uint256 part = g - gasleft();
        g = gasleft();
        tracks.tokenURI(2);
        uint256 track = g - gasleft();
        uint256 rid = _openRaceRoom();
        vm.prank(operator);
        race.start(rid, 1, bytes32(0), bytes32(0));
        address[3] memory pod = [host, address(0), address(0)];
        vm.prank(operator);
        race.finalize(rid, bytes32(0), pod);
        g = gasleft();
        badge.tokenURI(1);
        uint256 title = g - gasleft();
        emit log_named_uint("gas tokenURI part (view, local EVM)", part);
        emit log_named_uint("gas tokenURI circuit (view, local EVM)", track);
        emit log_named_uint("gas tokenURI title (view, local EVM)", title);
        assertLt(part, 10_000_000);
        assertLt(track, 10_000_000);
        assertLt(title, 10_000_000);
    }

    // ---------- the 0..2 stat bars never leave their track ----------
    function test_stat_bars_are_clamped() public {
        bytes32[] memory k = new bytes32[](3);
        k[0] = "speed";
        k[1] = "weight";
        k[2] = "boost";
        int8[] memory v = new int8[](3);
        v[0] = -100;
        v[1] = 2;
        v[2] = -100;
        vm.prank(owner);
        uint256 t = parts.createPlatformPart(treasury, "Extreme", ONE, 2, 0x123456, k, v);
        uint256 id = _buy(alice, aliceKey, t, 1);
        string memory svg = _svgOf(_json(parts.tokenURI(id)), "image");
        assertTrue(_has(svg, unicode"−100"));
        assertFalse(_has(svg, 'width="-'));
    }

    function _has(string memory hay, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(hay);
        bytes memory n = bytes(needle);
        if (n.length == 0 || h.length < n.length) return false;
        for (uint256 i; i + n.length <= h.length; ++i) {
            bool ok = true;
            for (uint256 j; j < n.length; ++j) {
                if (h[i + j] != n[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return true;
        }
        return false;
    }
}
