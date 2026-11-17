// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {TrackNFT} from "../src/TrackNFT.sol";
import {PartNFT} from "../src/PartNFT.sol";
import {Badge} from "../src/Badge.sol";
import {DuckWekVault} from "../src/DuckWekVault.sol";
import {DuckWekRace} from "../src/DuckWekRace.sol";
import {PartRenderer} from "../src/render/PartRenderer.sol";
import {TrackRenderer} from "../src/render/TrackRenderer.sol";
import {BadgeRenderer} from "../src/render/BadgeRenderer.sol";

/// Shared deployment for the v2 suites: the same wiring as DeployV2 (without ownership transfer).
abstract contract DuckWekBase is Test {
    uint96 constant ONE = 1_000_000;
    uint256 constant TICKET = 100_000;
    uint256 constant CAP = 5_000_000; // the session cap (5 USDC)
    uint16 constant NO_PART = type(uint16).max;
    bytes32 constant PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    // Platform layouts (turtle code, plan 0013 §12 G4)
    bytes constant KALI = hex"0f4c3d4c3d4c3d"; // 6 turns, 1800 m, open
    bytes constant MERAPI = hex"0a45092a2b0d4c2c2c"; // closed, 6 turns, 1880 m

    MockUSDC usdc;
    TrackNFT tracks;
    PartNFT parts;
    Badge badge;
    DuckWekVault vault;
    DuckWekRace race;
    PartRenderer partArt;
    TrackRenderer trackArt;
    BadgeRenderer badgeArt;

    address owner = address(0xA0);
    address operator = address(0x0E);
    address treasury = address(0x7E);

    uint256 hostKey = 0xB0B;
    uint256 aliceKey = 0xA11CE;
    uint256 creatorKey = 0xC0FFEE;
    address host;
    address alice;
    address creator;

    bytes32 constant ROOM = keccak256("WEK-7Q2");

    function setUp() public virtual {
        host = vm.addr(hostKey);
        alice = vm.addr(aliceKey);
        creator = vm.addr(creatorKey);
        vm.startPrank(owner);
        usdc = new MockUSDC(owner);
        tracks = new TrackNFT(owner);
        parts = new PartNFT(owner);
        badge = new Badge(owner, address(tracks));
        vault = new DuckWekVault(owner, address(usdc), address(tracks), address(parts), treasury);
        race = new DuckWekRace(owner, address(vault), address(badge));
        partArt = new PartRenderer();
        trackArt = new TrackRenderer();
        badgeArt = new BadgeRenderer();
        parts.setMinter(address(vault));
        badge.setMinter(address(race));
        usdc.setVault(address(vault));
        vault.setOperator(operator, true);
        vault.setOperator(address(race), true);
        race.setOperator(operator, true);
        tracks.setOperator(operator, true);
        parts.setOperator(operator, true);
        parts.setRenderer(address(partArt));
        tracks.setRenderer(address(trackArt));
        badge.setRenderer(address(badgeArt));
        // Platform circuits and parts are owned by the protocol address (treasury): the one owner/protocol rule credits it alone.
        tracks.createPlatformTrack(treasury, "Kali Code Sprint", KALI, 1); // id 1
        tracks.createPlatformTrack(treasury, "Merapi Ring", MERAPI, 2); // id 2
        parts.createPlatformPart(treasury, "Layangan Wings", ONE, 0, 0xFFFFFF, _keys(), _vals(2, 0, -1)); // type 0
        parts.createPlatformPart(treasury, "Turbo Tail", ONE, 1, 0xFF9F1C, _keys(), _vals(1, 1, 0)); // type 1
        parts.createPlatformPart(treasury, "Iron Bill", ONE, 2, 0x9AA3B8, _keys(), _vals(-1, 1, 2)); // type 2
        usdc.mint(host, 100 * 1e6);
        usdc.mint(alice, 100 * 1e6);
        vm.stopPrank();
    }

    // ---------- helpers ----------
    function _keys() internal pure returns (bytes32[] memory k) {
        k = new bytes32[](3);
        k[0] = "speed";
        k[1] = "weight";
        k[2] = "boost";
    }

    function _vals(int8 a, int8 b, int8 c) internal pure returns (int8[] memory v) {
        v = new int8[](3);
        v[0] = a;
        v[1] = b;
        v[2] = c;
    }

    function _empty() internal pure returns (DuckWekVault.Loadout memory l) {
        l.template = 0;
        l.partBySlot = [NO_PART, NO_PART, NO_PART];
    }

    function _equip(uint8 slot, uint16 typeId) internal pure returns (DuckWekVault.Loadout memory l) {
        l = _empty();
        l.partBySlot[slot] = typeId;
    }

    function _order(address payer, uint8 kind, uint256 ref, bytes32 roomKey, uint256 amount, uint256 salt)
        internal
        pure
        returns (DuckWekVault.Order memory)
    {
        return DuckWekVault.Order(payer, kind, ref, roomKey, _empty(), amount, salt);
    }

    function _sign(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    /// The ONE signature, given at connect: an EIP-2612 permit (payer -> Vault, a cap, an expiry).
    function _permit(uint256 key, uint256 value, uint256 deadline) internal view returns (DuckWekVault.Permit memory p) {
        address o = vm.addr(key);
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, o, address(vault), value, usdc.nonces(o), deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        p = DuckWekVault.Permit(value, deadline, v, r, s);
    }

    function _noPermit() internal pure returns (DuckWekVault.Permit memory p) {
        p = DuckWekVault.Permit(0, 0, 0, bytes32(0), bytes32(0));
    }

    function _permitAndSpend(DuckWekVault.Order memory o, DuckWekVault.Permit memory p) internal returns (uint256) {
        vm.prank(operator);
        return vault.permitAndSpend(o, p);
    }

    function _spend(DuckWekVault.Order memory o) internal returns (uint256) {
        vm.prank(operator);
        return vault.spend(o);
    }

    /// First paid order of a session: the permit travels with it.
    function _payFirst(uint256 key, uint8 kind, uint256 ref, bytes32 roomKey, uint256 amount, uint256 salt) internal returns (uint256) {
        return _permitAndSpend(_order(vm.addr(key), kind, ref, roomKey, amount, salt), _permit(key, CAP, block.timestamp + 1 days));
    }

    /// Later orders: no signature at all.
    function _pay(address payer, uint8 kind, uint256 ref, bytes32 roomKey, uint256 amount, uint256 salt) internal returns (uint256) {
        return _spend(_order(payer, kind, ref, roomKey, amount, salt));
    }

    function _roomVersion(bytes32 key) internal view returns (uint32 v) {
        (,,,, v) = vault.rooms(key);
    }

    /// Creator circuit through the operator, with the creator's EIP-712 signature.
    function _creatorTrack(string memory name, bytes memory seg, uint16 laps, uint96 rent, uint256 nonce) internal returns (uint256 id) {
        uint256 deadline = block.timestamp + 1 days;
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                tracks.domainSeparator(),
                keccak256(abi.encode(tracks.CREATE_TYPEHASH(), creator, keccak256(bytes(name)), keccak256(seg), laps, rent, nonce, deadline))
            )
        );
        bytes memory sig = _sign(creatorKey, digest);
        vm.prank(operator);
        id = tracks.createCreatorTrack(creator, name, seg, laps, rent, nonce, deadline, sig);
    }

    function _layoutSig(uint256 key, uint256 id, bytes memory seg, uint16 laps, uint32 newVersion, uint256 deadline) internal view returns (bytes memory) {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                tracks.domainSeparator(),
                keccak256(abi.encode(tracks.LAYOUT_TYPEHASH(), id, keccak256(seg), laps, newVersion, deadline))
            )
        );
        return _sign(key, digest);
    }
}
