// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {TrackNFT} from "../src/TrackNFT.sol";
import {PartNFT} from "../src/PartNFT.sol";
import {DuckNFT} from "../src/DuckNFT.sol";
import {Badge} from "../src/Badge.sol";
import {DuckWekVault} from "../src/DuckWekVault.sol";
import {DuckWekRoles} from "../src/DuckWekRoles.sol";

/// Vault, payments, splits, session (permit), welcome mint, withdraw, NFTs. Race lifecycle: DuckWekRace.t.sol.
contract DuckWekTest is Test {
    uint96 constant ONE = 1_000_000;
    uint256 constant TICKET = 100_000;
    uint256 constant CAP = 5_000_000; // the session cap (5 USDC)

    MockUSDC usdc;
    TrackNFT tracks;
    PartNFT parts;
    DuckNFT ducks;
    Badge badge;
    DuckWekVault vault;

    address owner = address(0xA0);
    address operator = address(0x0E);
    address treasury = address(0x7E);

    uint256 hostKey = 0xB0B;
    address host;
    uint256 aliceKey = 0xA11CE;
    address alice;
    uint256 creatorKey = 0xC0FFEE;
    address creator;

    bytes32 constant ROOM = keccak256("WEK-7Q2");
    bytes32 constant PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    function setUp() public {
        host = vm.addr(hostKey);
        alice = vm.addr(aliceKey);
        creator = vm.addr(creatorKey);
        vm.startPrank(owner);
        usdc = new MockUSDC(owner);
        tracks = new TrackNFT(owner);
        parts = new PartNFT(owner);
        ducks = new DuckNFT(owner);
        badge = new Badge(owner);
        vault = new DuckWekVault(owner, address(usdc), address(tracks), address(parts), treasury);
        parts.setMinter(address(vault));
        usdc.setVault(address(vault));
        vault.setOperator(operator, true);
        ducks.setOperator(operator, true);
        // Platform circuits and parts are owned by the protocol address (treasury): the one owner/protocol rule credits it alone.
        tracks.createPlatformTrack(treasury, "Kali Code Sprint", ONE, 1, 6, 1800); // id 1
        tracks.createPlatformTrack(treasury, "Alpine Ring", ONE, 2, 10, 4326); // id 2
        parts.createPlatformPart(treasury, "Buroq Wings", ONE, 2, 0, -1); // type 0
        usdc.mint(host, 100 * 1e6);
        usdc.mint(alice, 100 * 1e6);
        vm.stopPrank();
    }

    // ---------- helpers ----------
    function _order(address payer, uint8 kind, uint256 ref, bytes32 roomKey, uint256 amount, uint256 salt)
        internal
        pure
        returns (DuckWekVault.Order memory)
    {
        return DuckWekVault.Order(payer, kind, ref, roomKey, 0, amount, salt);
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

    /// First paid order of a session: the permit travels with it.
    function _payFirst(uint256 key, uint8 kind, uint256 ref, bytes32 roomKey, uint256 amount, uint256 salt)
        internal
        returns (uint256)
    {
        return _permitAndSpend(_order(vm.addr(key), kind, ref, roomKey, amount, salt), _permit(key, CAP, block.timestamp + 1 days));
    }

    /// Arguments are built before this call: a prank or an expectRevert must apply to the Vault call, not to a helper.
    function _permitAndSpend(DuckWekVault.Order memory o, DuckWekVault.Permit memory p) internal returns (uint256) {
        vm.prank(operator);
        return vault.permitAndSpend(o, p);
    }

    function _spend(DuckWekVault.Order memory o) internal returns (uint256) {
        vm.prank(operator);
        return vault.spend(o);
    }

    /// Later orders: no signature at all.
    function _pay(address payer, uint8 kind, uint256 ref, bytes32 roomKey, uint256 amount, uint256 salt) internal returns (uint256) {
        return _spend(_order(payer, kind, ref, roomKey, amount, salt));
    }

    function _roomOwner(bytes32 key) internal view returns (address co) {
        (,,,, co) = vault.rooms(key);
    }

    function _openUgc() internal {
        vm.startPrank(owner);
        tracks.setUgcOpen(true);
        parts.setUgcOpen(true);
        vm.stopPrank();
    }

    // ---------- create / join: money and the one rule ----------
    function test_createRoom_platformTrack_allToTreasury() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        (address h, uint64 trackId,, uint32 players, address co) = vault.rooms(ROOM);
        assertEq(h, host);
        assertEq(trackId, 1);
        assertEq(players, 1);
        assertEq(co, treasury);
        assertEq(vault.available(treasury), ONE);
        assertEq(usdc.balanceOf(address(vault)), ONE);
        assertEq(usdc.balanceOf(host), 99 * 1e6);
        assertTrue(vault.joined(ROOM, host));
    }

    function test_creatorTrack_rent_and_ticket_split_50_50() public {
        _openUgc();
        vm.prank(creator);
        uint256 id = tracks.createTrack("Creator Cup", ONE, 1, 4, 1000);
        _payFirst(hostKey, 1, id, ROOM, ONE, 1);
        assertEq(vault.available(creator), ONE / 2);
        assertEq(vault.available(treasury), ONE / 2);
        assertEq(_roomOwner(ROOM), creator);

        _payFirst(aliceKey, 2, 0, ROOM, TICKET, 1);
        assertEq(vault.available(creator), ONE / 2 + TICKET / 2); // the circuit owner earns on every ticket of its rooms
        assertEq(vault.available(treasury), ONE / 2 + TICKET / 2);
    }

    function test_join_platformTrack_ticket_allToTreasury_once() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        _payFirst(aliceKey, 2, 0, ROOM, TICKET, 1);
        assertEq(vault.available(treasury), ONE + TICKET);
        (,,, uint32 players,) = vault.rooms(ROOM);
        assertEq(players, 2);
        assertTrue(vault.joined(ROOM, alice));
    }

    function test_host_is_first_entrant_and_cannot_pay_a_second_entry() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        DuckWekVault.Order memory o = _order(host, 2, 0, ROOM, TICKET, 2);
        vm.expectRevert(DuckWekVault.AlreadyJoined.selector);
        _spend(o);
        assertEq(usdc.balanceOf(host), 99 * 1e6);
    }

    function test_double_join_reverts() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        _payFirst(aliceKey, 2, 0, ROOM, TICKET, 1);
        DuckWekVault.Order memory o = _order(alice, 2, 0, ROOM, TICKET, 2);
        vm.expectRevert(DuckWekVault.AlreadyJoined.selector);
        _spend(o);
    }

    function test_join_unknownRoom_reverts() public {
        DuckWekVault.Order memory o = _order(alice, 2, 0, ROOM, TICKET, 1);
        DuckWekVault.Permit memory p = _permit(aliceKey, CAP, block.timestamp + 1 days);
        vm.expectRevert(DuckWekVault.RoomNotFound.selector);
        _permitAndSpend(o, p);
    }

    function test_createRoom_twice_same_key_reverts() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        DuckWekVault.Order memory o = _order(host, 1, 1, ROOM, ONE, 2);
        vm.expectRevert(DuckWekVault.RoomExists.selector);
        _spend(o);
    }

    function test_room_is_full_at_200() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        for (uint256 i; i < 199; ++i) {
            address p = vm.addr(1000 + i);
            vm.prank(owner);
            usdc.mint(p, 1e6);
            vm.prank(p);
            usdc.approve(address(vault), type(uint256).max); // a session that already exists
            _pay(p, 2, 0, ROOM, TICKET, 1);
        }
        (,,, uint32 players,) = vault.rooms(ROOM);
        assertEq(players, 200);
        address last = vm.addr(5000);
        vm.prank(owner);
        usdc.mint(last, 1e6);
        vm.prank(last);
        usdc.approve(address(vault), type(uint256).max);
        DuckWekVault.Order memory o = _order(last, 2, 0, ROOM, TICKET, 1);
        vm.expectRevert(DuckWekVault.RoomFull.selector);
        _spend(o);
    }

    // ---------- the session: one permit, then no signature ----------
    function test_permit_then_spend_needs_no_further_signature() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        assertEq(usdc.allowance(host, address(vault)), CAP - ONE);
        _pay(host, 3, 0, bytes32(0), ONE, 1); // buy a part: no signature, no popup
        assertEq(usdc.allowance(host, address(vault)), CAP - 2 * ONE);
        assertEq(parts.ownerOf(1), host);
        assertEq(vault.available(treasury), 2 * ONE);
    }

    function test_session_cap_limits_what_the_operator_can_charge() public {
        _permitAndSpend(_order(host, 3, 0, bytes32(0), ONE, 1), _permit(hostKey, ONE, block.timestamp + 1 days)); // cap = exactly one part
        DuckWekVault.Order memory second = _order(host, 3, 0, bytes32(0), ONE, 2);
        vm.expectRevert(); // ERC20InsufficientAllowance
        _spend(second);
        assertEq(usdc.balanceOf(host), 99 * 1e6);
    }

    function test_expired_permit_and_no_allowance_reverts() public {
        DuckWekVault.Order memory o = _order(host, 1, 1, ROOM, ONE, 1);
        DuckWekVault.Permit memory p = _permit(hostKey, CAP, block.timestamp + 1 hours);
        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert(); // permit expired is skipped, then the transfer has no allowance
        _permitAndSpend(o, p);
        assertEq(usdc.balanceOf(host), 100 * 1e6);
    }

    function test_front_run_permit_does_not_block_the_order() public {
        DuckWekVault.Order memory o = _order(host, 1, 1, ROOM, ONE, 1);
        DuckWekVault.Permit memory p = _permit(hostKey, CAP, block.timestamp + 1 days);
        usdc.permit(host, address(vault), p.value, p.deadline, p.v, p.r, p.s); // anyone can submit it first
        _permitAndSpend(o, p); // the permit now reverts inside the try/catch, the allowance is there
        assertEq(vault.available(treasury), ONE);
    }

    function test_permit_for_someone_else_never_charges_them() public {
        // alice never signed a permit for the Vault: the operator cannot take her USDC.
        DuckWekVault.Order memory o = _order(alice, 3, 0, bytes32(0), ONE, 1);
        vm.expectRevert();
        _spend(o);
        assertEq(usdc.balanceOf(alice), 100 * 1e6);
    }

    // ---------- price, replay, validation ----------
    function test_amount_must_match_the_on_chain_price() public {
        DuckWekVault.Order memory o = _order(host, 1, 1, ROOM, ONE - 1, 1);
        DuckWekVault.Permit memory p = _permit(hostKey, CAP, block.timestamp + 1 days);
        vm.expectRevert(abi.encodeWithSelector(DuckWekVault.WrongAmount.selector, uint256(ONE), uint256(ONE - 1)));
        _permitAndSpend(o, p);
    }

    function test_the_same_order_is_charged_at_most_once() public {
        _payFirst(hostKey, 3, 0, bytes32(0), ONE, 7);
        DuckWekVault.Order memory same = _order(host, 3, 0, bytes32(0), ONE, 7);
        vm.expectRevert(DuckWekVault.OrderUsed.selector);
        _spend(same);
        _pay(host, 3, 0, bytes32(0), ONE, 8); // a different salt is a second copy of the part
        assertEq(parts.ownerOf(2), host);
    }

    function test_bad_template_and_bad_kind_revert() public {
        DuckWekVault.Order memory o = DuckWekVault.Order(host, 1, 1, ROOM, 9, ONE, 1);
        DuckWekVault.Permit memory p = _permit(hostKey, CAP, block.timestamp + 1 days);
        vm.expectRevert(DuckWekVault.BadTemplate.selector);
        _permitAndSpend(o, p);
        DuckWekVault.Order memory bad = _order(host, 0, 0, ROOM, ONE, 1);
        vm.expectRevert(DuckWekVault.BadKind.selector);
        _spend(bad);
    }

    function test_inactive_track_cannot_be_rented() public {
        vm.prank(owner);
        tracks.setTrack(2, ONE, false);
        DuckWekVault.Order memory o = _order(host, 1, 2, ROOM, ONE, 1);
        DuckWekVault.Permit memory p = _permit(hostKey, CAP, block.timestamp + 1 days);
        vm.expectRevert(DuckWekVault.TrackInactive.selector);
        _permitAndSpend(o, p);
    }

    function test_onlyOperator() public {
        DuckWekVault.Order memory o = _order(host, 1, 1, ROOM, ONE, 1);
        DuckWekVault.Permit memory p = _permit(hostKey, CAP, block.timestamp + 1 days);
        vm.expectRevert(DuckWekRoles.NotOperator.selector);
        vault.spend(o);
        vm.expectRevert(DuckWekRoles.NotOperator.selector);
        vault.permitAndSpend(o, p);
        DuckWekVault.Withdrawal memory w = DuckWekVault.Withdrawal(treasury, treasury, 1, 1, block.timestamp + 1);
        vm.expectRevert(DuckWekRoles.NotOperator.selector);
        vault.withdrawWithSig(w, "");
    }

    function test_paused_blocks_payments() public {
        vm.prank(owner);
        vault.pause();
        DuckWekVault.Order memory o = _order(host, 1, 1, ROOM, ONE, 1);
        DuckWekVault.Permit memory p = _permit(hostKey, CAP, block.timestamp + 1 days);
        vm.expectRevert();
        _permitAndSpend(o, p);
    }

    // ---------- welcome mint (mock USDC only) ----------
    function test_welcome_mint_happens_once_inside_the_first_order() public {
        vm.prank(owner);
        vault.setWelcomeEnabled(true);
        address fresh = vm.addr(0xFEED);
        assertEq(usdc.balanceOf(fresh), 0);
        _permitAndSpend(_order(fresh, 3, 0, bytes32(0), ONE, 1), _permit(0xFEED, CAP, block.timestamp + 1 days));
        assertEq(usdc.balanceOf(fresh), usdc.WELCOME_AMOUNT() - ONE); // 5 USDC welcome, 1 USDC paid, one transaction
        assertTrue(usdc.welcomed(fresh));
        _pay(fresh, 3, 0, bytes32(0), ONE, 2);
        assertEq(usdc.balanceOf(fresh), usdc.WELCOME_AMOUNT() - 2 * ONE); // not minted a second time
    }

    function test_welcome_mint_only_the_vault_can_call() public {
        vm.expectRevert(MockUSDC.NotVault.selector);
        usdc.welcomeMint(alice);
    }

    function test_welcome_is_off_by_default_so_real_usdc_needs_nothing_special() public {
        address fresh = vm.addr(0xFEED);
        DuckWekVault.Order memory o = _order(fresh, 3, 0, bytes32(0), ONE, 1);
        DuckWekVault.Permit memory p = _permit(0xFEED, CAP, block.timestamp + 1 days);
        vm.expectRevert(); // no USDC, no welcome: the transfer fails
        _permitAndSpend(o, p);
    }

    // ---------- parts: one rule, 85 / 15 ----------
    function test_platformPart_100_protocol_and_license() public {
        _payFirst(aliceKey, 3, 0, bytes32(0), ONE, 1);
        assertEq(vault.available(treasury), ONE);
        assertEq(parts.ownerOf(1), alice);
        assertEq(parts.typeOf(1), 0);
    }

    function test_creatorPart_85_15_and_royalty() public {
        _openUgc();
        vm.prank(creator);
        uint256 t = parts.createPart("Creator Fin", ONE, 1, 1, 0);
        _payFirst(aliceKey, 3, t, bytes32(0), ONE, 1);
        assertEq(vault.available(creator), (uint256(ONE) * 8_500) / 10_000);
        assertEq(vault.available(treasury), ONE - (uint256(ONE) * 8_500) / 10_000);
        (address recv, uint256 amt) = parts.royaltyInfo(1, 1e6);
        assertEq(recv, creator);
        assertEq(amt, 50_000);
    }

    function test_ugc_closed_by_default() public {
        vm.prank(creator);
        vm.expectRevert(TrackNFT.UgcClosed.selector);
        tracks.createTrack("Nope", ONE, 1, 1, 100);
        vm.prank(creator);
        vm.expectRevert(PartNFT.UgcClosed.selector);
        parts.createPart("Nope", ONE, 1, 0, 0);
    }

    // ---------- withdraw: pull, and gasless ----------
    function test_withdraw_pull_and_gasless() public {
        _openUgc();
        vm.prank(creator);
        uint256 t = parts.createPart("Creator Fin", ONE, 1, 1, 0);
        _payFirst(aliceKey, 3, t, bytes32(0), ONE, 1);
        uint256 earned = vault.available(creator);

        // pull: the receiver calls withdraw herself
        vm.prank(creator);
        vault.withdraw(earned / 2);
        assertEq(usdc.balanceOf(creator), earned / 2);

        // gasless: the creator signs, the operator pays gas
        DuckWekVault.Withdrawal memory w = DuckWekVault.Withdrawal(creator, creator, earned - earned / 2, 1, block.timestamp + 1 hours);
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                vault.domainSeparator(),
                keccak256(abi.encode(vault.WITHDRAWAL_TYPEHASH(), w.owner, w.to, w.amount, w.nonce, w.deadline))
            )
        );
        vm.prank(operator);
        vm.expectRevert(DuckWekVault.BadSignature.selector);
        vault.withdrawWithSig(w, _sign(aliceKey, digest)); // not the owner's signature
        vm.prank(operator);
        vault.withdrawWithSig(w, _sign(creatorKey, digest));
        assertEq(usdc.balanceOf(creator), earned);
        assertEq(vault.available(creator), 0);
        vm.prank(operator);
        vm.expectRevert(DuckWekVault.NonceUsed.selector);
        vault.withdrawWithSig(w, _sign(creatorKey, digest)); // replay

        uint256 protocol = vault.available(treasury);
        vm.prank(treasury);
        vault.withdraw(protocol);
        assertEq(usdc.balanceOf(address(vault)), 0);
    }

    function test_withdraw_more_than_available_reverts() public {
        vm.prank(alice);
        vm.expectRevert(DuckWekVault.Insufficient.selector);
        vault.withdraw(1);
    }

    // ---------- duck ----------
    function test_duck_once_per_wallet() public {
        DuckNFT.Duck memory d = DuckNFT.Duck("QuackZilla", 1, 0xFFC93C, 0xFF9F1C, 1);
        vm.prank(operator);
        uint256 id = ducks.hatch(alice, d);
        assertEq(ducks.ownerOf(id), alice);
        (address recv,) = ducks.royaltyInfo(id, 1e6);
        assertEq(recv, alice);
        vm.prank(operator);
        vm.expectRevert(DuckNFT.AlreadyHatched.selector);
        ducks.hatch(alice, d);
    }

}
