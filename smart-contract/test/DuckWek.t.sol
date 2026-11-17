// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {DuckWekBase} from "./DuckWekBase.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {TrackNFT} from "../src/TrackNFT.sol";
import {PartNFT} from "../src/PartNFT.sol";
import {Badge} from "../src/Badge.sol";
import {DuckWekVault} from "../src/DuckWekVault.sol";
import {DuckWekRoles} from "../src/DuckWekRoles.sol";

/// Vault, payments, splits, session, loadout, licences, circuits, withdraw. Race lifecycle: DuckWekRace.t.sol. Art: Renderers.t.sol.
contract DuckWekTest is DuckWekBase {
    // ---------- create / join: money and the one rule ----------
    function test_createRoom_platformTrack_allToTreasury() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        (address h, uint64 trackId,, uint32 players, uint32 lv) = vault.rooms(ROOM);
        assertEq(h, host);
        assertEq(trackId, 1);
        assertEq(players, 1);
        assertEq(lv, 1);
        assertEq(vault.available(treasury), ONE);
        assertEq(usdc.balanceOf(address(vault)), ONE);
        assertEq(usdc.balanceOf(host), 99 * 1e6);
        assertTrue(vault.joined(ROOM, host));
    }

    function test_creatorTrack_rent_and_ticket_split_50_50() public {
        uint256 id = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        _payFirst(hostKey, 1, id, ROOM, ONE, 1);
        assertEq(vault.available(creator), ONE / 2);
        assertEq(vault.available(treasury), ONE / 2);
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
            uint256 k = 1000 + i;
            vm.prank(owner);
            usdc.mint(vm.addr(k), 1e6);
            _payFirst(k, 2, 0, ROOM, TICKET, 1);
        }
        (,,, uint32 players,) = vault.rooms(ROOM);
        assertEq(players, 200);
        vm.prank(owner);
        usdc.mint(vm.addr(5000), 1e6);
        DuckWekVault.Order memory o = _order(vm.addr(5000), 2, 0, ROOM, TICKET, 1);
        DuckWekVault.Permit memory p = _permit(5000, CAP, block.timestamp + 1 days);
        vm.expectRevert(DuckWekVault.RoomFull.selector);
        _permitAndSpend(o, p);
    }

    // ---------- 1. the session: one permit, then no signature; dead after its end and past its cap ----------
    function test_permit_then_spend_needs_no_further_signature() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        assertEq(usdc.allowance(host, address(vault)), CAP - ONE);
        _pay(host, 3, 0, bytes32(0), ONE, 1); // buy a part: no signature, no popup
        assertEq(usdc.allowance(host, address(vault)), CAP - 2 * ONE);
        assertEq(parts.ownerOf(1), host);
        assertEq(vault.available(treasury), 2 * ONE);
        assertEq(vault.sessionSpent(host), 2 * ONE);
    }

    function test_session_spend_after_end_reverts() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        vm.warp(block.timestamp + 1 days + 1);
        DuckWekVault.Order memory o = _order(host, 3, 0, bytes32(0), ONE, 1);
        assertGt(usdc.allowance(host, address(vault)), 0); // the leftover allowance exists on the token...
        vm.expectRevert(DuckWekVault.SessionExpired.selector); // ...but the Vault no longer charges it
        _spend(o);
    }

    function test_session_cap_limits_what_the_operator_can_charge() public {
        _permitAndSpend(_order(host, 3, 0, bytes32(0), ONE, 1), _permit(hostKey, ONE, block.timestamp + 1 days)); // cap = one part
        DuckWekVault.Order memory second = _order(host, 3, 1, bytes32(0), ONE, 2);
        vm.expectRevert(abi.encodeWithSelector(DuckWekVault.SessionCapExceeded.selector, uint256(ONE), uint256(2 * ONE)));
        _spend(second);
        assertEq(usdc.balanceOf(host), 99 * 1e6);
    }

    function test_new_permit_resets_the_session() public {
        _permitAndSpend(_order(host, 3, 0, bytes32(0), ONE, 1), _permit(hostKey, ONE, block.timestamp + 1 days));
        _permitAndSpend(_order(host, 3, 1, bytes32(0), ONE, 2), _permit(hostKey, ONE, block.timestamp + 2 days));
        assertEq(vault.sessionSpent(host), ONE);
        assertEq(vault.sessionEnd(host), block.timestamp + 2 days);
        assertEq(usdc.balanceOf(host), 98 * 1e6);
    }

    function test_expired_permit_and_no_session_reverts() public {
        DuckWekVault.Order memory o = _order(host, 1, 1, ROOM, ONE, 1);
        DuckWekVault.Permit memory p = _permit(hostKey, CAP, block.timestamp + 1 hours);
        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert(DuckWekVault.SessionExpired.selector);
        _permitAndSpend(o, p);
        assertEq(usdc.balanceOf(host), 100 * 1e6);
    }

    function test_front_run_permit_does_not_block_the_order() public {
        DuckWekVault.Order memory o = _order(host, 1, 1, ROOM, ONE, 1);
        DuckWekVault.Permit memory p = _permit(hostKey, CAP, block.timestamp + 1 days);
        usdc.permit(host, address(vault), p.value, p.deadline, p.v, p.r, p.s); // anyone can submit it first
        _permitAndSpend(o, p); // applying it reverts; the consumed, payer-signed permit is adopted as the session
        assertEq(vault.available(treasury), ONE);
        assertEq(vault.sessionCap(host), CAP);
    }

    function test_a_consumed_permit_signed_by_someone_else_opens_no_session() public {
        DuckWekVault.Permit memory p = _permit(aliceKey, CAP, block.timestamp + 1 days);
        usdc.permit(alice, address(vault), p.value, p.deadline, p.v, p.r, p.s);
        // the operator names host as payer but carries alice's permit: it is not host's signature
        DuckWekVault.Order memory o = _order(host, 3, 0, bytes32(0), ONE, 1);
        vm.expectRevert(DuckWekVault.SessionExpired.selector);
        _permitAndSpend(o, p);
    }

    function test_replaying_a_consumed_permit_does_not_reset_the_session() public {
        DuckWekVault.Permit memory p = _permit(hostKey, ONE * 2, block.timestamp + 1 days);
        _permitAndSpend(_order(host, 3, 0, bytes32(0), ONE, 1), p);
        _permitAndSpend(_order(host, 3, 1, bytes32(0), ONE, 1), p); // same permit again: applying fails, same session kept
        assertEq(vault.sessionSpent(host), 2 * ONE);
        DuckWekVault.Order memory third = _order(host, 3, 2, bytes32(0), ONE, 1);
        vm.expectRevert(); // cap reached: the replay did not give the operator a fresh cap
        _permitAndSpend(third, p);
    }

    function test_permit_for_someone_else_never_charges_them() public {
        DuckWekVault.Order memory o = _order(alice, 3, 0, bytes32(0), ONE, 1);
        vm.expectRevert(DuckWekVault.SessionExpired.selector);
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
    }

    function test_bad_template_and_bad_kind_revert() public {
        DuckWekVault.Loadout memory l = _empty();
        l.template = 9;
        DuckWekVault.Order memory o = DuckWekVault.Order(host, 1, 1, ROOM, l, ONE, 1);
        DuckWekVault.Permit memory p = _permit(hostKey, CAP, block.timestamp + 1 days);
        vm.expectRevert(DuckWekVault.BadTemplate.selector);
        _permitAndSpend(o, p);
        DuckWekVault.Order memory bad = _order(host, 0, 0, ROOM, ONE, 1);
        vm.expectRevert(DuckWekVault.BadKind.selector);
        _spend(bad);
    }

    function test_inactive_track_cannot_be_rented() public {
        vm.prank(owner);
        tracks.setActive(2, false);
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

    function test_join_price_stays_inside_its_bounds() public {
        vm.startPrank(owner);
        vm.expectRevert(DuckWekVault.PriceOutOfRange.selector);
        vault.setJoinPrice(9_999);
        vm.expectRevert(DuckWekVault.PriceOutOfRange.selector);
        vault.setJoinPrice(1_000_001);
        vault.setJoinPrice(10_000);
        vault.setJoinPrice(1_000_000);
        vm.stopPrank();
    }

    // ---------- 2. loadout ----------
    function test_loadout_part_without_licence_reverts() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        DuckWekVault.Order memory o = DuckWekVault.Order(alice, 2, 0, ROOM, _equip(0, 0), TICKET, 1);
        DuckWekVault.Permit memory p = _permit(aliceKey, CAP, block.timestamp + 1 days);
        vm.expectRevert(abi.encodeWithSelector(DuckWekVault.NoLicense.selector, uint256(0), uint16(0)));
        _permitAndSpend(o, p);
    }

    function test_loadout_with_licence_is_accepted() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        _payFirst(aliceKey, 3, 0, bytes32(0), ONE, 1); // alice buys Layangan Wings
        _spend(DuckWekVault.Order(alice, 2, 0, ROOM, _equip(0, 0), TICKET, 1));
        assertTrue(vault.joined(ROOM, alice));
    }

    function test_loadout_two_parts_revert_while_max_equipped_is_one() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        _payFirst(aliceKey, 3, 0, bytes32(0), ONE, 1);
        _pay(alice, 3, 1, bytes32(0), ONE, 2);
        DuckWekVault.Loadout memory l = _empty();
        l.partBySlot[0] = 0;
        l.partBySlot[1] = 1;
        DuckWekVault.Order memory o = DuckWekVault.Order(alice, 2, 0, ROOM, l, TICKET, 1);
        vm.expectRevert(DuckWekVault.TooManyParts.selector);
        _spend(o);
    }

    function test_loadout_part_in_the_wrong_slot_reverts() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        _payFirst(aliceKey, 3, 1, bytes32(0), ONE, 1); // Turbo Tail is a slot 1 part
        DuckWekVault.Order memory o = DuckWekVault.Order(alice, 2, 0, ROOM, _equip(0, 1), TICKET, 1);
        vm.expectRevert(abi.encodeWithSelector(DuckWekVault.BadPart.selector, uint256(0), uint16(1)));
        _spend(o);
        DuckWekVault.Order memory unknown = DuckWekVault.Order(alice, 2, 0, ROOM, _equip(2, 77), TICKET, 2);
        vm.expectRevert(abi.encodeWithSelector(DuckWekVault.BadPart.selector, uint256(2), uint16(77)));
        _spend(unknown);
    }

    function test_the_loadout_is_part_of_the_order_hash() public view {
        DuckWekVault.Order memory a = _order(alice, 2, 0, ROOM, TICKET, 1);
        DuckWekVault.Order memory b = DuckWekVault.Order(alice, 2, 0, ROOM, _equip(0, 0), TICKET, 1);
        assertTrue(vault.orderHash(a) != vault.orderHash(b));
    }

    // ---------- 3. one licence per type per wallet ----------
    function test_second_licence_of_a_type_reverts() public {
        _payFirst(aliceKey, 3, 0, bytes32(0), ONE, 1);
        DuckWekVault.Order memory o = _order(alice, 3, 0, bytes32(0), ONE, 2);
        vm.expectRevert(abi.encodeWithSelector(PartNFT.AlreadyLicensed.selector, alice, uint256(0)));
        _spend(o);
        assertEq(parts.licenseOf(alice, 0), 1);
    }

    function test_transfer_into_a_holder_of_the_same_type_reverts_and_moves_the_slot() public {
        _payFirst(aliceKey, 3, 0, bytes32(0), ONE, 1); // token 1 -> alice
        _payFirst(hostKey, 3, 0, bytes32(0), ONE, 1); // token 2 -> host
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PartNFT.AlreadyLicensed.selector, host, uint256(0)));
        parts.transferFrom(alice, host, 1);
        address carol = address(0xCA);
        vm.prank(alice);
        parts.transferFrom(alice, carol, 1);
        assertEq(parts.licenseOf(alice, 0), 0);
        assertEq(parts.licenseOf(carol, 0), 1);
    }

    // ---------- welcome mint (mock USDC only) ----------
    function test_welcome_mint_happens_once_inside_the_first_order() public {
        vm.prank(owner);
        vault.setWelcomeEnabled(true);
        address fresh = vm.addr(0xFEED);
        assertEq(usdc.balanceOf(fresh), 0);
        _permitAndSpend(_order(fresh, 3, 0, bytes32(0), ONE, 1), _permit(0xFEED, CAP, block.timestamp + 1 days));
        assertEq(usdc.balanceOf(fresh), usdc.WELCOME_AMOUNT() - ONE);
        assertTrue(usdc.welcomed(fresh));
        _pay(fresh, 3, 1, bytes32(0), ONE, 2);
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
        vm.expectRevert();
        _permitAndSpend(o, p);
    }

    // ---------- parts: one rule, 85 / 15 ----------
    function test_platformPart_100_protocol_and_licence() public {
        _payFirst(aliceKey, 3, 0, bytes32(0), ONE, 1);
        assertEq(vault.available(treasury), ONE);
        assertEq(parts.ownerOf(1), alice);
        assertEq(parts.typeOf(1), 0);
    }

    function test_creatorPart_85_15_and_royalty() public {
        vm.prank(operator);
        uint256 t = parts.createCreatorPart(creator, "Creator Fin", ONE, 1, 0x4ED1C5, _keys(), _vals(1, 1, 0));
        _payFirst(aliceKey, 3, t, bytes32(0), ONE, 1);
        assertEq(vault.available(creator), (uint256(ONE) * 8_500) / 10_000);
        assertEq(vault.available(treasury), ONE - (uint256(ONE) * 8_500) / 10_000);
        (address recv, uint256 amt) = parts.royaltyInfo(1, 1e6);
        assertEq(recv, creator);
        assertEq(amt, 50_000);
    }

    function test_discontinued_part_cannot_be_sold_but_old_licences_stay() public {
        _payFirst(aliceKey, 3, 0, bytes32(0), ONE, 1);
        vm.prank(owner);
        parts.setActive(0, false);
        DuckWekVault.Order memory o = _order(host, 3, 0, bytes32(0), ONE, 1);
        DuckWekVault.Permit memory p = _permit(hostKey, CAP, block.timestamp + 1 days);
        vm.expectRevert(PartNFT.UnknownPart.selector);
        _permitAndSpend(o, p);
        assertEq(parts.ownerOf(1), alice); // alice keeps her licence
        DuckWekVault.Order memory join = DuckWekVault.Order(alice, 2, 0, ROOM, _equip(0, 0), TICKET, 1);
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        _spend(join); // and can still race with it
        assertTrue(vault.joined(ROOM, alice));
    }

    function test_setActive_permissions() public {
        vm.prank(operator);
        uint256 t = parts.createCreatorPart(creator, "Creator Fin", ONE, 1, 0x4ED1C5, _keys(), _vals(1, 1, 0));
        vm.prank(creator);
        parts.setActive(t, false); // a creator can retire their own part
        vm.prank(creator);
        vm.expectRevert(PartNFT.NotAllowed.selector);
        parts.setActive(0, false); // not a platform part
        vm.prank(alice);
        vm.expectRevert(PartNFT.NotAllowed.selector);
        parts.setActive(t, true);
        vm.prank(owner);
        parts.setActive(t, true); // moderation
    }

    // ---------- 8. the owner cannot rewrite what was sold ----------
    function test_owner_has_no_function_to_change_a_part_or_a_creators_rent() public {
        bytes[4] memory calls = [
            abi.encodeWithSignature("setPrice(uint256,uint96)", 0, 1),
            abi.encodeWithSignature("setStats(uint256,int8,int8,int8)", 0, 1, 1, 0),
            abi.encodeWithSignature("setName(uint256,string)", 0, "x"),
            abi.encodeWithSignature("setTrack(uint256,uint96,bool)", 1, 1, true)
        ];
        vm.startPrank(owner);
        for (uint256 i; i < calls.length; ++i) {
            (bool ok1,) = address(parts).call(calls[i]);
            (bool ok2,) = address(tracks).call(calls[i]);
            assertFalse(ok1);
            assertFalse(ok2);
        }
        vm.stopPrank();
        uint256 id = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        vm.prank(owner);
        vm.expectRevert(TrackNFT.NotHolder.selector);
        tracks.setRent(id, 5 * ONE); // the owner cannot touch a creator's price
    }

    // ---------- 4. circuit income follows the NFT ----------
    function test_track_income_goes_to_the_holder_after_a_transfer() public {
        uint256 id = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        _payFirst(hostKey, 1, id, ROOM, ONE, 1); // room created while `creator` holds the circuit
        address buyer = address(0xB1);
        vm.prank(creator);
        tracks.transferFrom(creator, buyer, id);
        _payFirst(aliceKey, 2, 0, ROOM, TICKET, 1); // a ticket after the sale
        assertEq(vault.available(buyer), TICKET / 2); // the new holder earns it, not the old one
        assertEq(vault.available(creator), ONE / 2);
    }

    // ---------- 5. rent ----------
    function test_setRent_only_the_holder_and_only_creator_tracks() public {
        uint256 id = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        vm.prank(alice);
        vm.expectRevert(TrackNFT.NotHolder.selector);
        tracks.setRent(id, 2 * ONE);
        vm.prank(creator);
        tracks.setRent(id, 2 * ONE);
        assertEq(tracks.rentOf(id), 2 * ONE);
        vm.prank(treasury); // holder of a platform circuit
        vm.expectRevert(TrackNFT.PlatformRentFixed.selector);
        tracks.setRent(1, 5 * ONE);
        assertEq(tracks.rentOf(1), ONE);
    }

    function test_new_rent_applies_to_new_rooms_only() public {
        uint256 id = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        _payFirst(hostKey, 1, id, ROOM, ONE, 1);
        vm.prank(creator);
        tracks.setRent(id, 3 * ONE);
        _payFirst(aliceKey, 2, 0, ROOM, TICKET, 1); // the open room keeps working
        DuckWekVault.Order memory old = _order(alice, 1, id, keccak256("B"), ONE, 2);
        vm.expectRevert(abi.encodeWithSelector(DuckWekVault.WrongAmount.selector, uint256(3 * ONE), uint256(ONE)));
        _spend(old);
    }

    // ---------- 6. layouts ----------
    function test_publishLayout_bad_signature_reverts() public {
        uint256 id = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _layoutSig(aliceKey, id, KALI, 1, 2, deadline); // not the holder
        vm.prank(operator);
        vm.expectRevert(TrackNFT.BadSignature.selector);
        tracks.publishLayout(id, KALI, 1, deadline, sig);
    }

    function test_publishLayout_fourth_edit_reverts_and_rooms_keep_their_version() public {
        uint256 id = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        _payFirst(hostKey, 1, id, ROOM, ONE, 1);
        assertEq(_roomVersion(ROOM), 1);
        uint256 deadline = block.timestamp + 1 days;
        for (uint32 v = 2; v <= 4; ++v) {
            bytes memory sig = _layoutSig(creatorKey, id, KALI, 1, v, deadline);
            vm.prank(operator);
            tracks.publishLayout(id, KALI, 1, deadline, sig);
            assertEq(tracks.versionOf(id), v);
        }
        bytes memory sig5 = _layoutSig(creatorKey, id, KALI, 1, 5, deadline);
        vm.prank(operator);
        vm.expectRevert(TrackNFT.NoMoreEdits.selector);
        tracks.publishLayout(id, KALI, 1, deadline, sig5);
        assertEq(_roomVersion(ROOM), 1); // the room created earlier still uses version 1
        (bytes memory seg,) = tracks.layoutOf(id, 1);
        assertEq(seg, MERAPI); // old versions stay readable
        _payFirst(aliceKey, 1, id, keccak256("B"), ONE, 1);
        assertEq(_roomVersion(keccak256("B")), 4); // a new room takes the latest
    }

    function test_publishLayout_signature_cannot_be_replayed() public {
        uint256 id = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _layoutSig(creatorKey, id, KALI, 1, 2, deadline);
        vm.prank(operator);
        tracks.publishLayout(id, KALI, 1, deadline, sig);
        vm.prank(operator);
        vm.expectRevert(TrackNFT.BadSignature.selector); // the version moved on: the nonce no longer matches
        tracks.publishLayout(id, KALI, 1, deadline, sig);
    }

    function test_bad_segments_and_laps_revert() public {
        vm.startPrank(owner);
        vm.expectRevert(); // empty layout
        tracks.createPlatformTrack(treasury, "Empty", hex"", 1);
        vm.expectRevert(); // zero length segment
        tracks.createPlatformTrack(treasury, "Zero", hex"00", 1);
        vm.expectRevert(); // turn nibble out of range
        tracks.createPlatformTrack(treasury, "Turn", hex"7f", 1);
        vm.expectRevert(TrackNFT.BadLaps.selector);
        tracks.createPlatformTrack(treasury, "Laps", KALI, 0);
        vm.stopPrank();
    }

    // ---------- 7. set-once minters, one-way renderer lock ----------
    function test_minters_are_set_once() public {
        vm.startPrank(owner);
        vm.expectRevert(PartNFT.MinterAlreadySet.selector);
        parts.setMinter(address(0xBAD));
        vm.expectRevert(Badge.MinterAlreadySet.selector);
        badge.setMinter(address(0xBAD));
        vm.stopPrank();
    }

    function test_renderer_lock_is_one_way() public {
        vm.startPrank(owner);
        parts.lockRenderer();
        vm.expectRevert(PartNFT.RendererIsLocked.selector);
        parts.setRenderer(address(0x1));
        tracks.lockRenderer();
        vm.expectRevert(TrackNFT.RendererIsLocked.selector);
        tracks.setRenderer(address(0x1));
        badge.lockRenderer();
        vm.expectRevert(Badge.RendererIsLocked.selector);
        badge.setRenderer(address(0x1));
        vm.stopPrank();
    }

    // ---------- creator circuits by signature ----------
    function test_creatorTrack_needs_the_creators_signature_and_a_fresh_nonce() public {
        uint256 id = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        assertEq(tracks.ownerOf(id), creator);
        uint256 deadline = block.timestamp + 1 days;
        bytes memory forged = _sign(
            aliceKey,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    tracks.domainSeparator(),
                    keccak256(abi.encode(tracks.CREATE_TYPEHASH(), creator, keccak256("X"), keccak256(KALI), uint16(1), ONE, uint256(2), deadline))
                )
            )
        );
        vm.prank(operator);
        vm.expectRevert(TrackNFT.BadSignature.selector);
        tracks.createCreatorTrack(creator, "X", KALI, 1, ONE, 2, deadline, forged);
        // the nonce of the first creation (1) cannot be used again, even with a valid signature
        bytes memory again = _sign(
            creatorKey,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    tracks.domainSeparator(),
                    keccak256(abi.encode(tracks.CREATE_TYPEHASH(), creator, keccak256("Other"), keccak256(KALI), uint16(1), ONE, uint256(1), deadline))
                )
            )
        );
        vm.prank(operator);
        vm.expectRevert(TrackNFT.NonceUsed.selector);
        tracks.createCreatorTrack(creator, "Other", KALI, 1, ONE, 1, deadline, again);
    }

    // ---------- withdraw: pull, and gasless ----------
    function test_withdraw_pull_and_gasless() public {
        vm.prank(operator);
        uint256 t = parts.createCreatorPart(creator, "Creator Fin", ONE, 1, 0x4ED1C5, _keys(), _vals(1, 1, 0));
        _payFirst(aliceKey, 3, t, bytes32(0), ONE, 1);
        uint256 earned = vault.available(creator);

        vm.prank(creator);
        vault.withdraw(earned / 2);
        assertEq(usdc.balanceOf(creator), earned / 2);

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
        vault.withdrawWithSig(w, _sign(aliceKey, digest));
        vm.prank(operator);
        vault.withdrawWithSig(w, _sign(creatorKey, digest));
        assertEq(usdc.balanceOf(creator), earned);
        assertEq(vault.available(creator), 0);
        vm.prank(operator);
        vm.expectRevert(DuckWekVault.NonceUsed.selector);
        vault.withdrawWithSig(w, _sign(creatorKey, digest));

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

    // ---------- 9. invariant: the Vault always holds exactly what it owes ----------
    function testFuzz_vault_balance_equals_the_sum_of_available(uint256 seed) public {
        address[4] memory who = [host, alice, creator, treasury];
        uint256 id = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        for (uint256 i; i < 12; ++i) {
            seed = uint256(keccak256(abi.encode(seed, i)));
            uint256 pick = seed % 5;
            uint256 k = 2000 + (seed >> 8) % 6; // a few wallets, so joins collide sometimes
            address w = vm.addr(k);
            if (usdc.balanceOf(w) == 0) {
                vm.prank(owner);
                usdc.mint(w, 50 * 1e6);
            }
            bytes32 room = keccak256(abi.encode("r", seed % 3));
            DuckWekVault.Permit memory p = _permit(k, CAP, block.timestamp + 1 days);
            vm.startPrank(operator);
            if (pick == 0) {
                try vault.permitAndSpend(_order(w, 1, 1 + seed % 2 == 0 ? id : 1, room, vault.priceOf(1, 1 + seed % 2 == 0 ? id : 1), i), p) {} catch {}
            } else if (pick == 1) {
                try vault.permitAndSpend(_order(w, 2, 0, room, TICKET, i), p) {} catch {}
            } else if (pick == 2) {
                try vault.permitAndSpend(_order(w, 3, seed % 3, bytes32(0), ONE, i), p) {} catch {}
            }
            vm.stopPrank();
            uint256 mine = vault.available(w) / 2; // read before the prank: a prank applies to the next call
            if (pick == 3 && mine > 0) {
                vm.prank(w);
                vault.withdraw(mine);
            }
            uint256 theirs = vault.available(treasury) / 3;
            if (pick == 4 && theirs > 0) {
                vm.prank(treasury);
                vault.withdraw(theirs);
            }
        }
        uint256 owed = vault.available(treasury) + vault.available(creator) + vault.available(host) + vault.available(alice);
        for (uint256 j; j < 6; ++j) owed += vault.available(vm.addr(2000 + j));
        assertEq(owed, usdc.balanceOf(address(vault)));
        who; // silence unused
    }

    // ---------- 10. fuzz: the stat budget ----------
    function testFuzz_stat_budget(int8 a, int8 b, int8 c) public {
        int8[] memory v = _vals(a, b, c);
        bool ok = a <= 2 && b <= 2 && c <= 2 && (int256(a) + int256(b) + int256(c)) <= 2;
        vm.prank(owner);
        if (ok) {
            parts.createPlatformPart(treasury, "Fuzz", ONE, 0, 0, _keys(), v);
            assertEq(parts.statOf(parts.typeCount() - 1, "speed"), a);
        } else {
            vm.expectRevert(PartNFT.BadStats.selector);
            parts.createPlatformPart(treasury, "Fuzz", ONE, 0, 0, _keys(), v);
        }
    }

    function test_stat_registry_is_append_only_and_unknown_keys_revert() public {
        bytes32[] memory k = new bytes32[](1);
        k[0] = "grip";
        int8[] memory v = new int8[](1);
        v[0] = 1;
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(PartNFT.UnknownStat.selector, bytes32("grip")));
        parts.createPlatformPart(treasury, "Grippy", ONE, 0, 0, k, v);
        vm.prank(owner);
        parts.addStat("grip");
        vm.prank(owner);
        uint256 t = parts.createPlatformPart(treasury, "Grippy", ONE, 0, 0, k, v);
        assertEq(parts.statOf(t, "grip"), 1);
        assertEq(parts.statOf(0, "grip"), 0); // an older type reads 0 for a key added later
        assertEq(parts.statCount(), 4);
    }
}
