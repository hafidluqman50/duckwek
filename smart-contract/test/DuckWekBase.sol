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

abstract contract DuckWekBase is Test {
    uint96 constant ONE = 1_000_000;
    uint256 constant TICKET = 100_000;
    uint256 constant CAP = 5_000_000;
    uint16 constant NO_PART = type(uint16).max;
    bytes32 constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    bytes constant KALI = hex"0f4c3d4c3d4c3d";
    bytes constant MERAPI = hex"0a45092a2b0d4c2c2c";

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
        tracks.createPlatformTrack(treasury, "Kali Code Sprint", KALI, 1);
        tracks.createPlatformTrack(treasury, "Merapi Ring", MERAPI, 2);
        parts.createPlatformPart(treasury, "Layangan Wings", ONE, 0, 0xFFFFFF, _keys(), _vals(2, 0, -1));
        parts.createPlatformPart(treasury, "Turbo Tail", ONE, 1, 0xFF9F1C, _keys(), _vals(1, 1, 0));
        parts.createPlatformPart(treasury, "Iron Bill", ONE, 2, 0x9AA3B8, _keys(), _vals(-1, 1, 2));
        usdc.mint(host, 100 * 1e6);
        usdc.mint(alice, 100 * 1e6);
        vm.stopPrank();
    }

    // ─── Helpers ───

    function _keys() internal pure returns (bytes32[] memory keys) {
        keys = new bytes32[](3);
        keys[0] = "speed";
        keys[1] = "weight";
        keys[2] = "boost";
    }

    function _vals(int8 speed, int8 weight, int8 boost) internal pure returns (int8[] memory values) {
        values = new int8[](3);
        values[0] = speed;
        values[1] = weight;
        values[2] = boost;
    }

    function _empty() internal pure returns (DuckWekVault.Loadout memory loadout) {
        loadout.template = 0;
        loadout.partBySlot = [NO_PART, NO_PART, NO_PART];
    }

    function _equip(uint8 slot, uint16 typeId) internal pure returns (DuckWekVault.Loadout memory loadout) {
        loadout = _empty();
        loadout.partBySlot[slot] = typeId;
    }

    function _order(address payer, uint8 kind, uint256 referenceId, bytes32 roomKey, uint256 amount, uint256 salt)
        internal
        pure
        returns (DuckWekVault.Order memory)
    {
        return DuckWekVault.Order(payer, kind, referenceId, roomKey, _empty(), amount, salt);
    }

    function _sign(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 recoveryId, bytes32 signatureR, bytes32 signatureS) = vm.sign(key, digest);
        return abi.encodePacked(signatureR, signatureS, recoveryId);
    }

    function _permit(uint256 key, uint256 value, uint256 deadline)
        internal
        view
        returns (DuckWekVault.Permit memory permit)
    {
        address permitOwner = vm.addr(key);
        bytes32 structHash = keccak256(
            abi.encode(PERMIT_TYPEHASH, permitOwner, address(vault), value, usdc.nonces(permitOwner), deadline)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        (uint8 recoveryId, bytes32 signatureR, bytes32 signatureS) = vm.sign(key, digest);
        permit = DuckWekVault.Permit(value, deadline, recoveryId, signatureR, signatureS);
    }

    function _noPermit() internal pure returns (DuckWekVault.Permit memory permit) {
        permit = DuckWekVault.Permit(0, 0, 0, bytes32(0), bytes32(0));
    }

    function _permitAndSpend(DuckWekVault.Order memory order, DuckWekVault.Permit memory permit)
        internal
        returns (uint256)
    {
        vm.prank(operator);
        return vault.permitAndSpend(order, permit);
    }

    function _spend(DuckWekVault.Order memory order) internal returns (uint256) {
        vm.prank(operator);
        return vault.spend(order);
    }

    function _payFirst(uint256 key, uint8 kind, uint256 referenceId, bytes32 roomKey, uint256 amount, uint256 salt)
        internal
        returns (uint256)
    {
        return _permitAndSpend(
            _order(vm.addr(key), kind, referenceId, roomKey, amount, salt), _permit(key, CAP, block.timestamp + 1 days)
        );
    }

    function _pay(address payer, uint8 kind, uint256 referenceId, bytes32 roomKey, uint256 amount, uint256 salt)
        internal
        returns (uint256)
    {
        return _spend(_order(payer, kind, referenceId, roomKey, amount, salt));
    }

    function _roomVersion(bytes32 key) internal view returns (uint32 version) {
        (,,,, version) = vault.rooms(key);
    }

    function _creatorTrack(string memory name, bytes memory segments, uint16 laps, uint96 rent, uint256 nonce)
        internal
        returns (uint256 trackId)
    {
        uint256 deadline = block.timestamp + 1 days;
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                tracks.domainSeparator(),
                keccak256(
                    abi.encode(
                        tracks.CREATE_TYPEHASH(),
                        creator,
                        keccak256(bytes(name)),
                        keccak256(segments),
                        laps,
                        rent,
                        nonce,
                        deadline
                    )
                )
            )
        );
        bytes memory signature = _sign(creatorKey, digest);
        vm.prank(operator);
        trackId = tracks.createCreatorTrack(creator, name, segments, laps, rent, nonce, deadline, signature);
    }

    function _layoutSig(
        uint256 key,
        uint256 trackId,
        bytes memory segments,
        uint16 laps,
        uint32 newVersion,
        uint256 deadline
    ) internal view returns (bytes memory) {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                tracks.domainSeparator(),
                keccak256(
                    abi.encode(tracks.LAYOUT_TYPEHASH(), trackId, keccak256(segments), laps, newVersion, deadline)
                )
            )
        );
        return _sign(key, digest);
    }
}
