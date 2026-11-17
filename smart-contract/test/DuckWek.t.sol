// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {DuckWekBase} from "./DuckWekBase.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {TrackNFT} from "../src/TrackNFT.sol";
import {PartNFT} from "../src/PartNFT.sol";
import {Badge} from "../src/Badge.sol";
import {DuckWekVault} from "../src/DuckWekVault.sol";
import {DuckWekRoles} from "../src/DuckWekRoles.sol";

contract DuckWekTest is DuckWekBase {
    // ─── Create / join ───

    function test_createRoom_platformTrack_allToTreasury() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        (address roomHost, uint64 trackId,, uint32 players, uint32 layoutVersion) = vault.rooms(ROOM);
        assertEq(roomHost, host);
        assertEq(trackId, 1);
        assertEq(players, 1);
        assertEq(layoutVersion, 1);
        assertEq(vault.available(treasury), ONE);
        assertEq(usdc.balanceOf(address(vault)), ONE);
        assertEq(usdc.balanceOf(host), 99 * 1e6);
        assertTrue(vault.joined(ROOM, host));
    }

    function test_permitAndSpend_creatorTrackSplitsRentAndTicketEvenly() public {
        uint256 trackId = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        _payFirst(hostKey, 1, trackId, ROOM, ONE, 1);
        assertEq(vault.available(creator), ONE / 2);
        assertEq(vault.available(treasury), ONE / 2);
        _payFirst(aliceKey, 2, 0, ROOM, TICKET, 1);
        assertEq(vault.available(creator), ONE / 2 + TICKET / 2);
        assertEq(vault.available(treasury), ONE / 2 + TICKET / 2);
    }

    function test_permitAndSpend_platformTrackTicketGoesToTreasury() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        _payFirst(aliceKey, 2, 0, ROOM, TICKET, 1);
        assertEq(vault.available(treasury), ONE + TICKET);
        (,,, uint32 players,) = vault.rooms(ROOM);
        assertEq(players, 2);
        assertTrue(vault.joined(ROOM, alice));
    }

    function test_spend_hostIsFirstEntrantAndCannotPayAgain() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        DuckWekVault.Order memory order = _order(host, 2, 0, ROOM, TICKET, 2);
        vm.expectRevert(DuckWekVault.AlreadyJoined.selector);
        _spend(order);
        assertEq(usdc.balanceOf(host), 99 * 1e6);
    }

    function test_spend_doubleJoinReverts() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        _payFirst(aliceKey, 2, 0, ROOM, TICKET, 1);
        DuckWekVault.Order memory order = _order(alice, 2, 0, ROOM, TICKET, 2);
        vm.expectRevert(DuckWekVault.AlreadyJoined.selector);
        _spend(order);
    }

    function test_permitAndSpend_unknownRoomReverts() public {
        DuckWekVault.Order memory order = _order(alice, 2, 0, ROOM, TICKET, 1);
        DuckWekVault.Permit memory permit = _permit(aliceKey, CAP, block.timestamp + 1 days);
        vm.expectRevert(DuckWekVault.RoomNotFound.selector);
        _permitAndSpend(order, permit);
    }

    function test_spend_createRoomTwiceWithSameKeyReverts() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        DuckWekVault.Order memory order = _order(host, 1, 1, ROOM, ONE, 2);
        vm.expectRevert(DuckWekVault.RoomExists.selector);
        _spend(order);
    }

    function test_permitAndSpend_roomFullAtMaxPlayersReverts() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        for (uint256 index; index < 199; ++index) {
            uint256 privateKey = 1000 + index;
            vm.prank(owner);
            usdc.mint(vm.addr(privateKey), 1e6);
            _payFirst(privateKey, 2, 0, ROOM, TICKET, 1);
        }

        (,,, uint32 players,) = vault.rooms(ROOM);
        assertEq(players, 200);
        vm.prank(owner);
        usdc.mint(vm.addr(5000), 1e6);
        DuckWekVault.Order memory order = _order(vm.addr(5000), 2, 0, ROOM, TICKET, 1);
        DuckWekVault.Permit memory permit = _permit(5000, CAP, block.timestamp + 1 days);
        vm.expectRevert(DuckWekVault.RoomFull.selector);
        _permitAndSpend(order, permit);
    }

    // ─── The session ───

    function test_spend_afterPermitNeedsNoFurtherSignature() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        assertEq(usdc.allowance(host, address(vault)), CAP - ONE);
        _pay(host, 3, 0, bytes32(0), ONE, 1);
        assertEq(usdc.allowance(host, address(vault)), CAP - 2 * ONE);
        assertEq(parts.ownerOf(1), host);
        assertEq(vault.available(treasury), 2 * ONE);
        assertEq(vault.sessionSpent(host), 2 * ONE);
    }

    function test_spend_afterSessionEndReverts() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        vm.warp(block.timestamp + 1 days + 1);
        DuckWekVault.Order memory order = _order(host, 3, 0, bytes32(0), ONE, 1);
        assertGt(usdc.allowance(host, address(vault)), 0);
        vm.expectRevert(DuckWekVault.SessionExpired.selector);
        _spend(order);
    }

    function test_spend_sessionCapLimitsOperatorCharge() public {
        _permitAndSpend(_order(host, 3, 0, bytes32(0), ONE, 1), _permit(hostKey, ONE, block.timestamp + 1 days));
        DuckWekVault.Order memory second = _order(host, 3, 1, bytes32(0), ONE, 2);
        vm.expectRevert(
            abi.encodeWithSelector(DuckWekVault.SessionCapExceeded.selector, uint256(ONE), uint256(2 * ONE))
        );
        _spend(second);
        assertEq(usdc.balanceOf(host), 99 * 1e6);
    }

    function test_permitAndSpend_newPermitResetsSession() public {
        _permitAndSpend(_order(host, 3, 0, bytes32(0), ONE, 1), _permit(hostKey, ONE, block.timestamp + 1 days));
        _permitAndSpend(_order(host, 3, 1, bytes32(0), ONE, 2), _permit(hostKey, ONE, block.timestamp + 2 days));
        assertEq(vault.sessionSpent(host), ONE);
        assertEq(vault.sessionEnd(host), block.timestamp + 2 days);
        assertEq(usdc.balanceOf(host), 98 * 1e6);
    }

    function test_permitAndSpend_expiredPermitWithoutSessionReverts() public {
        DuckWekVault.Order memory order = _order(host, 1, 1, ROOM, ONE, 1);
        DuckWekVault.Permit memory permit = _permit(hostKey, CAP, block.timestamp + 1 hours);
        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert(DuckWekVault.SessionExpired.selector);
        _permitAndSpend(order, permit);
        assertEq(usdc.balanceOf(host), 100 * 1e6);
    }

    function test_permitAndSpend_frontRunPermitDoesNotBlockOrder() public {
        DuckWekVault.Order memory order = _order(host, 1, 1, ROOM, ONE, 1);
        DuckWekVault.Permit memory permit = _permit(hostKey, CAP, block.timestamp + 1 days);
        usdc.permit(host, address(vault), permit.value, permit.deadline, permit.v, permit.r, permit.s);
        _permitAndSpend(order, permit);
        assertEq(vault.available(treasury), ONE);
        assertEq(vault.sessionCap(host), CAP);
    }

    function test_permitAndSpend_consumedPermitSignedBySomeoneElseOpensNoSession() public {
        DuckWekVault.Permit memory permit = _permit(aliceKey, CAP, block.timestamp + 1 days);
        usdc.permit(alice, address(vault), permit.value, permit.deadline, permit.v, permit.r, permit.s);
        DuckWekVault.Order memory order = _order(host, 3, 0, bytes32(0), ONE, 1);
        vm.expectRevert(DuckWekVault.SessionExpired.selector);
        _permitAndSpend(order, permit);
    }

    function test_permitAndSpend_replayedPermitDoesNotResetSession() public {
        DuckWekVault.Permit memory permit = _permit(hostKey, ONE * 2, block.timestamp + 1 days);
        _permitAndSpend(_order(host, 3, 0, bytes32(0), ONE, 1), permit);
        _permitAndSpend(_order(host, 3, 1, bytes32(0), ONE, 1), permit);
        assertEq(vault.sessionSpent(host), 2 * ONE);
        DuckWekVault.Order memory third = _order(host, 3, 2, bytes32(0), ONE, 1);
        vm.expectRevert();
        _permitAndSpend(third, permit);
    }

    function test_spend_payerWithoutSessionIsNeverCharged() public {
        DuckWekVault.Order memory order = _order(alice, 3, 0, bytes32(0), ONE, 1);
        vm.expectRevert(DuckWekVault.SessionExpired.selector);
        _spend(order);
        assertEq(usdc.balanceOf(alice), 100 * 1e6);
    }

    // ─── Price, replay, validation ───

    function test_permitAndSpend_amountMustMatchOnChainPrice() public {
        DuckWekVault.Order memory order = _order(host, 1, 1, ROOM, ONE - 1, 1);
        DuckWekVault.Permit memory permit = _permit(hostKey, CAP, block.timestamp + 1 days);
        vm.expectRevert(abi.encodeWithSelector(DuckWekVault.WrongAmount.selector, uint256(ONE), uint256(ONE - 1)));
        _permitAndSpend(order, permit);
    }

    function test_spend_sameOrderChargedAtMostOnce() public {
        _payFirst(hostKey, 3, 0, bytes32(0), ONE, 7);
        DuckWekVault.Order memory same = _order(host, 3, 0, bytes32(0), ONE, 7);
        vm.expectRevert(DuckWekVault.OrderUsed.selector);
        _spend(same);
    }

    function test_permitAndSpend_badTemplateAndBadKindRevert() public {
        DuckWekVault.Loadout memory loadout = _empty();
        loadout.template = 9;
        DuckWekVault.Order memory order = DuckWekVault.Order(host, 1, 1, ROOM, loadout, ONE, 1);
        DuckWekVault.Permit memory permit = _permit(hostKey, CAP, block.timestamp + 1 days);
        vm.expectRevert(DuckWekVault.BadTemplate.selector);
        _permitAndSpend(order, permit);
        DuckWekVault.Order memory bad = _order(host, 0, 0, ROOM, ONE, 1);
        vm.expectRevert(DuckWekVault.BadKind.selector);
        _spend(bad);
    }

    function test_permitAndSpend_inactiveTrackReverts() public {
        vm.prank(owner);
        tracks.setActive(2, false);
        DuckWekVault.Order memory order = _order(host, 1, 2, ROOM, ONE, 1);
        DuckWekVault.Permit memory permit = _permit(hostKey, CAP, block.timestamp + 1 days);
        vm.expectRevert(DuckWekVault.TrackInactive.selector);
        _permitAndSpend(order, permit);
    }

    function test_operatorFunctions_onlyOperator() public {
        DuckWekVault.Order memory order = _order(host, 1, 1, ROOM, ONE, 1);
        DuckWekVault.Permit memory permit = _permit(hostKey, CAP, block.timestamp + 1 days);
        vm.expectRevert(DuckWekRoles.NotOperator.selector);
        vault.spend(order);
        vm.expectRevert(DuckWekRoles.NotOperator.selector);
        vault.permitAndSpend(order, permit);
        DuckWekVault.Withdrawal memory w = DuckWekVault.Withdrawal(treasury, treasury, 1, 1, block.timestamp + 1);
        vm.expectRevert(DuckWekRoles.NotOperator.selector);
        vault.withdrawWithSig(w, "");
    }

    function test_permitAndSpend_pausedReverts() public {
        vm.prank(owner);
        vault.pause();
        DuckWekVault.Order memory order = _order(host, 1, 1, ROOM, ONE, 1);
        DuckWekVault.Permit memory permit = _permit(hostKey, CAP, block.timestamp + 1 days);
        vm.expectRevert();
        _permitAndSpend(order, permit);
    }

    function test_setJoinPrice_staysInsideBounds() public {
        vm.startPrank(owner);
        vm.expectRevert(DuckWekVault.PriceOutOfRange.selector);
        vault.setJoinPrice(9_999);
        vm.expectRevert(DuckWekVault.PriceOutOfRange.selector);
        vault.setJoinPrice(1_000_001);
        vault.setJoinPrice(10_000);
        vault.setJoinPrice(1_000_000);
        vm.stopPrank();
    }

    // ─── Loadout ───

    function test_permitAndSpend_loadoutPartWithoutLicenceReverts() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        DuckWekVault.Order memory order = DuckWekVault.Order(alice, 2, 0, ROOM, _equip(0, 0), TICKET, 1);
        DuckWekVault.Permit memory permit = _permit(aliceKey, CAP, block.timestamp + 1 days);
        vm.expectRevert(abi.encodeWithSelector(DuckWekVault.NoLicense.selector, uint256(0), uint16(0)));
        _permitAndSpend(order, permit);
    }

    function test_spend_loadoutWithLicenceIsAccepted() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        _payFirst(aliceKey, 3, 0, bytes32(0), ONE, 1);
        _spend(DuckWekVault.Order(alice, 2, 0, ROOM, _equip(0, 0), TICKET, 1));
        assertTrue(vault.joined(ROOM, alice));
    }

    function test_spend_twoEquippedPartsRevert() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        _payFirst(aliceKey, 3, 0, bytes32(0), ONE, 1);
        _pay(alice, 3, 1, bytes32(0), ONE, 2);
        DuckWekVault.Loadout memory loadout = _empty();
        loadout.partBySlot[0] = 0;
        loadout.partBySlot[1] = 1;
        DuckWekVault.Order memory order = DuckWekVault.Order(alice, 2, 0, ROOM, loadout, TICKET, 1);
        vm.expectRevert(DuckWekVault.TooManyParts.selector);
        _spend(order);
    }

    function test_spend_partInWrongSlotReverts() public {
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        _payFirst(aliceKey, 3, 1, bytes32(0), ONE, 1);
        DuckWekVault.Order memory order = DuckWekVault.Order(alice, 2, 0, ROOM, _equip(0, 1), TICKET, 1);
        vm.expectRevert(abi.encodeWithSelector(DuckWekVault.BadPart.selector, uint256(0), uint16(1)));
        _spend(order);
        DuckWekVault.Order memory unknown = DuckWekVault.Order(alice, 2, 0, ROOM, _equip(2, 77), TICKET, 2);
        vm.expectRevert(abi.encodeWithSelector(DuckWekVault.BadPart.selector, uint256(2), uint16(77)));
        _spend(unknown);
    }

    function test_orderHash_includesLoadout() public view {
        DuckWekVault.Order memory orderWithoutPart = _order(alice, 2, 0, ROOM, TICKET, 1);
        DuckWekVault.Order memory orderWithPart = DuckWekVault.Order(alice, 2, 0, ROOM, _equip(0, 0), TICKET, 1);
        assertTrue(vault.orderHash(orderWithoutPart) != vault.orderHash(orderWithPart));
    }

    // ─── One licence per type per wallet ───

    function test_spend_secondLicenceOfTypeReverts() public {
        _payFirst(aliceKey, 3, 0, bytes32(0), ONE, 1);
        DuckWekVault.Order memory order = _order(alice, 3, 0, bytes32(0), ONE, 2);
        vm.expectRevert(abi.encodeWithSelector(PartNFT.AlreadyLicensed.selector, alice, uint256(0)));
        _spend(order);
        assertEq(parts.licenseOf(alice, 0), 1);
    }

    function test_transferFrom_toHolderOfSameTypeReverts() public {
        _payFirst(aliceKey, 3, 0, bytes32(0), ONE, 1);
        _payFirst(hostKey, 3, 0, bytes32(0), ONE, 1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PartNFT.AlreadyLicensed.selector, host, uint256(0)));
        parts.transferFrom(alice, host, 1);
        address carol = address(0xCA);
        vm.prank(alice);
        parts.transferFrom(alice, carol, 1);
        assertEq(parts.licenseOf(alice, 0), 0);
        assertEq(parts.licenseOf(carol, 0), 1);
    }

    // ─── Welcome mint ───

    function test_permitAndSpend_welcomeMintHappensOnceInFirstOrder() public {
        vm.prank(owner);
        vault.setWelcomeEnabled(true);
        address fresh = vm.addr(0xFEED);
        assertEq(usdc.balanceOf(fresh), 0);
        _permitAndSpend(_order(fresh, 3, 0, bytes32(0), ONE, 1), _permit(0xFEED, CAP, block.timestamp + 1 days));
        assertEq(usdc.balanceOf(fresh), usdc.WELCOME_AMOUNT() - ONE);
        assertTrue(usdc.welcomed(fresh));
        _pay(fresh, 3, 1, bytes32(0), ONE, 2);
        assertEq(usdc.balanceOf(fresh), usdc.WELCOME_AMOUNT() - 2 * ONE);
    }

    function test_welcomeMint_onlyVault() public {
        vm.expectRevert(MockUSDC.NotVault.selector);
        usdc.welcomeMint(alice);
    }

    function test_permitAndSpend_welcomeIsOffByDefault() public {
        address fresh = vm.addr(0xFEED);
        DuckWekVault.Order memory order = _order(fresh, 3, 0, bytes32(0), ONE, 1);
        DuckWekVault.Permit memory permit = _permit(0xFEED, CAP, block.timestamp + 1 days);
        vm.expectRevert();
        _permitAndSpend(order, permit);
    }

    // ─── Parts ───

    function test_spend_platformPartGoesFullyToProtocol() public {
        _payFirst(aliceKey, 3, 0, bytes32(0), ONE, 1);
        assertEq(vault.available(treasury), ONE);
        assertEq(parts.ownerOf(1), alice);
        assertEq(parts.typeOf(1), 0);
    }

    function test_spend_creatorPartSplitsEightyFiveFifteenWithRoyalty() public {
        vm.prank(operator);
        uint256 partTypeId = parts.createCreatorPart(creator, "Creator Fin", ONE, 1, 0x4ED1C5, _keys(), _vals(1, 1, 0));
        _payFirst(aliceKey, 3, partTypeId, bytes32(0), ONE, 1);
        assertEq(vault.available(creator), (uint256(ONE) * 8_500) / 10_000);
        assertEq(vault.available(treasury), ONE - (uint256(ONE) * 8_500) / 10_000);
        (address receiver, uint256 amount) = parts.royaltyInfo(1, 1e6);
        assertEq(receiver, creator);
        assertEq(amount, 50_000);
    }

    function test_setActive_discontinuedPartCannotBeSoldButLicencesStay() public {
        _payFirst(aliceKey, 3, 0, bytes32(0), ONE, 1);
        vm.prank(owner);
        parts.setActive(0, false);
        DuckWekVault.Order memory order = _order(host, 3, 0, bytes32(0), ONE, 1);
        DuckWekVault.Permit memory permit = _permit(hostKey, CAP, block.timestamp + 1 days);
        vm.expectRevert(PartNFT.UnknownPart.selector);
        _permitAndSpend(order, permit);
        assertEq(parts.ownerOf(1), alice);
        DuckWekVault.Order memory join = DuckWekVault.Order(alice, 2, 0, ROOM, _equip(0, 0), TICKET, 1);
        _payFirst(hostKey, 1, 1, ROOM, ONE, 1);
        _spend(join);
        assertTrue(vault.joined(ROOM, alice));
    }

    function test_setActive_permissions() public {
        vm.prank(operator);
        uint256 partTypeId = parts.createCreatorPart(creator, "Creator Fin", ONE, 1, 0x4ED1C5, _keys(), _vals(1, 1, 0));
        vm.prank(creator);
        parts.setActive(partTypeId, false);
        vm.prank(creator);
        vm.expectRevert(PartNFT.NotAllowed.selector);
        parts.setActive(0, false);
        vm.prank(alice);
        vm.expectRevert(PartNFT.NotAllowed.selector);
        parts.setActive(partTypeId, true);
        vm.prank(owner);
        parts.setActive(partTypeId, true);
    }

    // ─── The owner cannot rewrite what was sold ───

    function test_ownerCalls_cannotRewritePartOrCreatorRent() public {
        bytes[4] memory calls = [
            abi.encodeWithSignature("setPrice(uint256,uint96)", 0, 1),
            abi.encodeWithSignature("setStats(uint256,int8,int8,int8)", 0, 1, 1, 0),
            abi.encodeWithSignature("setName(uint256,string)", 0, "x"),
            abi.encodeWithSignature("setTrack(uint256,uint96,bool)", 1, 1, true)
        ];
        vm.startPrank(owner);
        for (uint256 index; index < calls.length; ++index) {
            (bool partsCallSucceeded,) = address(parts).call(calls[index]);
            (bool tracksCallSucceeded,) = address(tracks).call(calls[index]);
            assertFalse(partsCallSucceeded);
            assertFalse(tracksCallSucceeded);
        }

        vm.stopPrank();
        uint256 trackId = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        vm.prank(owner);
        vm.expectRevert(TrackNFT.NotHolder.selector);
        tracks.setRent(trackId, 5 * ONE);
    }

    // ─── Circuit income follows the NFT ───

    function test_spend_trackIncomeFollowsHolderAfterTransfer() public {
        uint256 trackId = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        _payFirst(hostKey, 1, trackId, ROOM, ONE, 1);
        address buyer = address(0xB1);
        vm.prank(creator);
        tracks.transferFrom(creator, buyer, trackId);
        _payFirst(aliceKey, 2, 0, ROOM, TICKET, 1);
        assertEq(vault.available(buyer), TICKET / 2);
        assertEq(vault.available(creator), ONE / 2);
    }

    // ─── Rent ───

    function test_setRent_onlyHolderAndOnlyCreatorTracks() public {
        uint256 trackId = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        vm.prank(alice);
        vm.expectRevert(TrackNFT.NotHolder.selector);
        tracks.setRent(trackId, 2 * ONE);
        vm.prank(creator);
        tracks.setRent(trackId, 2 * ONE);
        assertEq(tracks.rentOf(trackId), 2 * ONE);
        vm.prank(treasury);
        vm.expectRevert(TrackNFT.PlatformRentFixed.selector);
        tracks.setRent(1, 5 * ONE);
        assertEq(tracks.rentOf(1), ONE);
    }

    function test_setRent_appliesToNewRoomsOnly() public {
        uint256 trackId = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        _payFirst(hostKey, 1, trackId, ROOM, ONE, 1);
        vm.prank(creator);
        tracks.setRent(trackId, 3 * ONE);
        _payFirst(aliceKey, 2, 0, ROOM, TICKET, 1);
        DuckWekVault.Order memory old = _order(alice, 1, trackId, keccak256("B"), ONE, 2);
        vm.expectRevert(abi.encodeWithSelector(DuckWekVault.WrongAmount.selector, uint256(3 * ONE), uint256(ONE)));
        _spend(old);
    }

    // ─── Layouts ───

    function test_publishLayout_badSignatureReverts() public {
        uint256 trackId = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        uint256 deadline = block.timestamp + 1 days;
        bytes memory signature = _layoutSig(aliceKey, trackId, KALI, 1, 2, deadline);
        vm.prank(operator);
        vm.expectRevert(TrackNFT.BadSignature.selector);
        tracks.publishLayout(trackId, KALI, 1, deadline, signature);
    }

    function test_publishLayout_fourthEditRevertsAndRoomsKeepVersion() public {
        uint256 trackId = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        _payFirst(hostKey, 1, trackId, ROOM, ONE, 1);
        assertEq(_roomVersion(ROOM), 1);
        uint256 deadline = block.timestamp + 1 days;
        for (uint32 version = 2; version <= 4; ++version) {
            bytes memory signature = _layoutSig(creatorKey, trackId, KALI, 1, version, deadline);
            vm.prank(operator);
            tracks.publishLayout(trackId, KALI, 1, deadline, signature);
            assertEq(tracks.versionOf(trackId), version);
        }

        bytes memory fifthSignature = _layoutSig(creatorKey, trackId, KALI, 1, 5, deadline);
        vm.prank(operator);
        vm.expectRevert(TrackNFT.NoMoreEdits.selector);
        tracks.publishLayout(trackId, KALI, 1, deadline, fifthSignature);
        assertEq(_roomVersion(ROOM), 1);
        (bytes memory segments,) = tracks.layoutOf(trackId, 1);
        assertEq(segments, MERAPI);
        _payFirst(aliceKey, 1, trackId, keccak256("B"), ONE, 1);
        assertEq(_roomVersion(keccak256("B")), 4);
    }

    function test_publishLayout_signatureCannotBeReplayed() public {
        uint256 trackId = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        uint256 deadline = block.timestamp + 1 days;
        bytes memory signature = _layoutSig(creatorKey, trackId, KALI, 1, 2, deadline);
        vm.prank(operator);
        tracks.publishLayout(trackId, KALI, 1, deadline, signature);
        vm.prank(operator);
        vm.expectRevert(TrackNFT.BadSignature.selector);
        tracks.publishLayout(trackId, KALI, 1, deadline, signature);
    }

    function test_createPlatformTrack_badSegmentsAndLapsRevert() public {
        vm.startPrank(owner);
        vm.expectRevert();
        tracks.createPlatformTrack(treasury, "Empty", hex"", 1);
        vm.expectRevert();
        tracks.createPlatformTrack(treasury, "Zero", hex"00", 1);
        vm.expectRevert();
        tracks.createPlatformTrack(treasury, "Turn", hex"7f", 1);
        vm.expectRevert(TrackNFT.BadLaps.selector);
        tracks.createPlatformTrack(treasury, "Laps", KALI, 0);
        vm.stopPrank();
    }

    // ─── Zero addresses are refused ───

    function test_constructor_zeroAddressesAreRefused() public {
        vm.startPrank(owner);
        vm.expectRevert(DuckWekVault.ZeroAddress.selector);
        vault.setTreasury(address(0));
        vm.expectRevert(DuckWekVault.ZeroAddress.selector);
        new DuckWekVault(owner, address(usdc), address(tracks), address(parts), address(0));
        vm.expectRevert(DuckWekVault.ZeroAddress.selector);
        new DuckWekVault(owner, address(0), address(tracks), address(parts), treasury);
        PartNFT freshParts = new PartNFT(owner);
        Badge freshBadge = new Badge(owner, address(tracks));
        vm.expectRevert(PartNFT.ZeroAddress.selector);
        freshParts.setMinter(address(0));
        vm.expectRevert(Badge.ZeroAddress.selector);
        freshBadge.setMinter(address(0));
        vm.stopPrank();
    }

    // ─── Set-once minters, one-way renderer lock ───

    function test_setMinter_setOnce() public {
        vm.startPrank(owner);
        vm.expectRevert(PartNFT.MinterAlreadySet.selector);
        parts.setMinter(address(0xBAD));
        vm.expectRevert(Badge.MinterAlreadySet.selector);
        badge.setMinter(address(0xBAD));
        vm.stopPrank();
    }

    function test_lockRenderer_isOneWay() public {
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

    // ─── Creator circuits by signature ───

    function test_createCreatorTrack_needsCreatorSignatureAndFreshNonce() public {
        uint256 trackId = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        assertEq(tracks.ownerOf(trackId), creator);
        uint256 deadline = block.timestamp + 1 days;
        bytes memory forged = _sign(
            aliceKey,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    tracks.domainSeparator(),
                    keccak256(
                        abi.encode(
                            tracks.CREATE_TYPEHASH(),
                            creator,
                            keccak256("X"),
                            keccak256(KALI),
                            uint16(1),
                            ONE,
                            uint256(2),
                            deadline
                        )
                    )
                )
            )
        );
        vm.prank(operator);
        vm.expectRevert(TrackNFT.BadSignature.selector);
        tracks.createCreatorTrack(creator, "X", KALI, 1, ONE, 2, deadline, forged);
        bytes memory again = _sign(
            creatorKey,
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    tracks.domainSeparator(),
                    keccak256(
                        abi.encode(
                            tracks.CREATE_TYPEHASH(),
                            creator,
                            keccak256("Other"),
                            keccak256(KALI),
                            uint16(1),
                            ONE,
                            uint256(1),
                            deadline
                        )
                    )
                )
            )
        );
        vm.prank(operator);
        vm.expectRevert(TrackNFT.NonceUsed.selector);
        tracks.createCreatorTrack(creator, "Other", KALI, 1, ONE, 1, deadline, again);
    }

    // ─── Withdraw ───

    function test_withdraw_pullAndGasless() public {
        vm.prank(operator);
        uint256 partTypeId = parts.createCreatorPart(creator, "Creator Fin", ONE, 1, 0x4ED1C5, _keys(), _vals(1, 1, 0));
        _payFirst(aliceKey, 3, partTypeId, bytes32(0), ONE, 1);
        uint256 earned = vault.available(creator);

        vm.prank(creator);
        vault.withdraw(earned / 2);
        assertEq(usdc.balanceOf(creator), earned / 2);

        DuckWekVault.Withdrawal memory withdrawal =
            DuckWekVault.Withdrawal(creator, creator, earned - earned / 2, 1, block.timestamp + 1 hours);
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                vault.domainSeparator(),
                keccak256(
                    abi.encode(
                        vault.WITHDRAWAL_TYPEHASH(),
                        withdrawal.owner,
                        withdrawal.to,
                        withdrawal.amount,
                        withdrawal.nonce,
                        withdrawal.deadline
                    )
                )
            )
        );
        vm.prank(operator);
        vm.expectRevert(DuckWekVault.BadSignature.selector);
        vault.withdrawWithSig(withdrawal, _sign(aliceKey, digest));
        vm.prank(operator);
        vault.withdrawWithSig(withdrawal, _sign(creatorKey, digest));
        assertEq(usdc.balanceOf(creator), earned);
        assertEq(vault.available(creator), 0);
        vm.prank(operator);
        vm.expectRevert(DuckWekVault.NonceUsed.selector);
        vault.withdrawWithSig(withdrawal, _sign(creatorKey, digest));

        uint256 protocol = vault.available(treasury);
        vm.prank(treasury);
        vault.withdraw(protocol);
        assertEq(usdc.balanceOf(address(vault)), 0);
    }

    function test_withdraw_moreThanAvailableReverts() public {
        vm.prank(alice);
        vm.expectRevert(DuckWekVault.Insufficient.selector);
        vault.withdraw(1);
    }

    // ─── Invariant ───

    function testFuzz_spend_vaultBalanceEqualsSumOfAvailable(uint256 seed) public {
        uint256 trackId = _creatorTrack("Creator Cup", MERAPI, 1, ONE, 1);
        for (uint256 index; index < 12; ++index) {
            seed = uint256(keccak256(abi.encode(seed, index)));
            uint256 action = seed % 5;
            uint256 privateKey = 2000 + (seed >> 8) % 6;
            address wallet = vm.addr(privateKey);
            if (usdc.balanceOf(wallet) == 0) {
                vm.prank(owner);
                usdc.mint(wallet, 50 * 1e6);
            }

            bytes32 room = keccak256(abi.encode("r", seed % 3));
            DuckWekVault.Permit memory permit = _permit(privateKey, CAP, block.timestamp + 1 days);
            vm.startPrank(operator);
            if (action == 0) {
                try vault.permitAndSpend(
                    _order(
                        wallet,
                        1,
                        1 + seed % 2 == 0 ? trackId : 1,
                        room,
                        vault.priceOf(1, 1 + seed % 2 == 0 ? trackId : 1),
                        index
                    ),
                    permit
                ) {} catch {}
            } else if (action == 1) {
                try vault.permitAndSpend(_order(wallet, 2, 0, room, TICKET, index), permit) {} catch {}
            } else if (action == 2) {
                try vault.permitAndSpend(_order(wallet, 3, seed % 3, bytes32(0), ONE, index), permit) {} catch {}
            }

            vm.stopPrank();
            uint256 walletShare = vault.available(wallet) / 2;
            if (action == 3 && walletShare > 0) {
                vm.prank(wallet);
                vault.withdraw(walletShare);
            }

            uint256 treasuryShare = vault.available(treasury) / 3;
            if (action == 4 && treasuryShare > 0) {
                vm.prank(treasury);
                vault.withdraw(treasuryShare);
            }
        }

        uint256 owed =
            vault.available(treasury) + vault.available(creator) + vault.available(host) + vault.available(alice);
        for (uint256 walletIndex; walletIndex < 6; ++walletIndex) {
            owed += vault.available(vm.addr(2000 + walletIndex));
        }

        assertEq(owed, usdc.balanceOf(address(vault)));
    }

    // ─── Fuzz ───

    function testFuzz_createPlatformPart_statBudget(int8 speed, int8 weight, int8 boost) public {
        int8[] memory values = _vals(speed, weight, boost);
        bool withinBudget =
            speed <= 2 && weight <= 2 && boost <= 2 && (int256(speed) + int256(weight) + int256(boost)) <= 2;
        vm.prank(owner);
        if (withinBudget) {
            parts.createPlatformPart(treasury, "Fuzz", ONE, 0, 0, _keys(), values);
            assertEq(parts.statOf(parts.typeCount() - 1, "speed"), speed);
        } else {
            vm.expectRevert(PartNFT.BadStats.selector);
            parts.createPlatformPart(treasury, "Fuzz", ONE, 0, 0, _keys(), values);
        }
    }

    function test_addStat_registryIsAppendOnlyAndUnknownKeysRevert() public {
        bytes32[] memory keys = new bytes32[](1);
        keys[0] = "grip";
        int8[] memory values = new int8[](1);
        values[0] = 1;
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(PartNFT.UnknownStat.selector, bytes32("grip")));
        parts.createPlatformPart(treasury, "Grippy", ONE, 0, 0, keys, values);
        vm.prank(owner);
        parts.addStat("grip");
        vm.prank(owner);
        uint256 partTypeId = parts.createPlatformPart(treasury, "Grippy", ONE, 0, 0, keys, values);
        assertEq(parts.statOf(partTypeId, "grip"), 1);
        assertEq(parts.statOf(0, "grip"), 0);
        assertEq(parts.statCount(), 4);
    }
}
