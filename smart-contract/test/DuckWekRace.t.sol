// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {DuckWekBase} from "./DuckWekBase.sol";
import {Badge} from "../src/Badge.sol";
import {DuckWekVault} from "../src/DuckWekVault.sol";
import {DuckWekRace} from "../src/DuckWekRace.sol";
import {DuckWekRoles} from "../src/DuckWekRoles.sol";

contract DuckWekRaceTest is DuckWekBase {
    uint96 constant TICKET_ = 100_000;
    address stranger = address(0xBAD);

    uint256 bobKey = 0xB0B2;
    uint256 carolKey = 0xCA201;
    uint256 daveKey = 0xDA7E;
    address bob;
    address carol;
    address dave;

    bytes32 constant ROOM2 = keccak256("WEK-BBB");

    event Tick(uint256 indexed roomId, uint32 n);
    event Joined(uint256 indexed roomId, address indexed player, DuckWekVault.Loadout loadout);
    event JoinFailed(uint256 indexed roomId, address indexed player, bytes reason);
    event RoomCreated(
        uint256 indexed roomId,
        bytes32 indexed roomKey,
        address indexed host,
        uint64 trackId,
        uint32 layoutVersion,
        uint256 paid
    );
    event Started(
        uint256 indexed roomId,
        uint32 startBlock,
        uint16 players,
        bytes32 participantsRoot,
        bytes32 seed,
        bytes32 engineVersion
    );

    function setUp() public override {
        super.setUp();
        bob = vm.addr(bobKey);
        carol = vm.addr(carolKey);
        dave = vm.addr(daveKey);
        vm.startPrank(owner);
        usdc.mint(bob, 100 * 1e6);
        usdc.mint(carol, 100 * 1e6);
        usdc.mint(dave, 100 * 1e6);
        vm.stopPrank();
    }

    // ─── Helpers ───

    function _permit(uint256 key) internal view returns (DuckWekVault.Permit memory permit) {
        permit = _permit(key, CAP, block.timestamp + 1 days);
    }

    function _loadoutWithTemplate(uint8 template) internal pure returns (DuckWekVault.Loadout memory loadout) {
        loadout = _empty();
        loadout.template = template;
    }

    function _createOrder(address payer, bytes32 key, uint256 trackId, uint8 template)
        internal
        pure
        returns (DuckWekVault.Order memory)
    {
        return DuckWekVault.Order(payer, 1, trackId, key, _loadoutWithTemplate(template), ONE, 1);
    }

    function _joinOrder(address payer, bytes32 key, uint8 template) internal pure returns (DuckWekVault.Order memory) {
        return DuckWekVault.Order(payer, 2, 0, key, _loadoutWithTemplate(template), TICKET, 1);
    }

    function _open(uint256 key, bytes32 roomKey) internal returns (uint256 roomId) {
        DuckWekVault.Order memory order = _createOrder(vm.addr(key), roomKey, 2, 1);
        DuckWekVault.Permit memory permit = _permit(key);
        vm.prank(operator);
        roomId = race.createRoom(order, permit);
    }

    function _join(uint256 roomId, bytes32 roomKey, uint256[] memory keys) internal {
        DuckWekVault.Order[] memory orders = new DuckWekVault.Order[](keys.length);
        DuckWekVault.Permit[] memory permits = new DuckWekVault.Permit[](keys.length);
        for (uint256 index; index < keys.length; ++index) {
            orders[index] = _joinOrder(vm.addr(keys[index]), roomKey, uint8(index % 3));
            permits[index] = _permit(keys[index]);
        }

        vm.prank(operator);
        race.joinBatch(roomId, orders, permits);
    }

    function _two(uint256 first, uint256 second) internal pure returns (uint256[] memory keys) {
        keys = new uint256[](2);
        keys[0] = first;
        keys[1] = second;
    }

    function _start(uint256 roomId) internal {
        vm.prank(operator);
        race.start(roomId, 4, keccak256("participants"), keccak256("engine-1"));
    }

    function _podium(address first, address second, address third) internal pure returns (address[3] memory podium) {
        podium[0] = first;
        podium[1] = second;
        podium[2] = third;
    }

    function _status(uint256 roomId) internal view returns (DuckWekRace.Status status) {
        (status,,,,,,) = race.rooms(roomId);
    }

    // ─── CreateRoom ───

    function test_createRoom_chargesRent_opensRoom_hostIsFirstEntrant() public {
        DuckWekVault.Order memory order = _createOrder(host, ROOM, 2, 1);
        DuckWekVault.Permit memory permit = _permit(hostKey);
        vm.expectEmit(true, true, true, true);
        emit RoomCreated(1, ROOM, host, 2, 1, ONE);
        vm.expectEmit(true, true, false, true);
        emit Joined(1, host, _loadoutWithTemplate(1));
        vm.prank(operator);
        uint256 roomId = race.createRoom(order, permit);
        assertEq(roomId, 1);
        assertEq(race.roomIdOf(ROOM), 1);
        assertEq(race.keyOf(1), ROOM);
        (DuckWekRace.Status status, uint64 trackId,,, uint16 players,,) = race.rooms(1);
        assertEq(uint8(status), uint8(DuckWekRace.Status.Open));
        assertEq(trackId, 2);
        assertEq(players, 1);
        assertTrue(vault.joined(ROOM, host));
        assertEq(vault.available(treasury), ONE);
        assertEq(usdc.balanceOf(host), 99 * 1e6);
    }

    function test_createRoom_twiceInOneSessionNeedsNoSecondPermit() public {
        _open(hostKey, ROOM);
        DuckWekVault.Order memory order = _createOrder(host, ROOM2, 1, 0);
        DuckWekVault.Permit memory none = _noPermit();
        vm.prank(operator);
        uint256 roomId = race.createRoom(order, none);
        assertEq(roomId, 2);
        assertEq(usdc.balanceOf(host), 98 * 1e6);
    }

    function test_createRoom_onlyOperator() public {
        DuckWekVault.Order memory order = _createOrder(host, ROOM, 2, 1);
        DuckWekVault.Permit memory permit = _permit(hostKey);
        vm.prank(stranger);
        vm.expectRevert(DuckWekRoles.NotOperator.selector);
        race.createRoom(order, permit);
    }

    function test_createRoom_wrongKind_reverts() public {
        DuckWekVault.Order memory order = _joinOrder(host, ROOM, 1);
        DuckWekVault.Permit memory permit = _permit(hostKey);
        vm.prank(operator);
        vm.expectRevert(DuckWekRace.BadKind.selector);
        race.createRoom(order, permit);
    }

    function test_createRoom_duplicateRoomKey_reverts() public {
        _open(hostKey, ROOM);
        DuckWekVault.Order memory order = _createOrder(alice, ROOM, 2, 1);
        DuckWekVault.Permit memory permit = _permit(aliceKey);
        vm.prank(operator);
        vm.expectRevert(DuckWekRace.RoomKeyUsed.selector);
        race.createRoom(order, permit);
    }

    function test_createRoom_unknownTrack_reverts() public {
        DuckWekVault.Order memory order = _createOrder(host, ROOM, 99, 1);
        DuckWekVault.Permit memory permit = _permit(hostKey);
        vm.prank(operator);
        vm.expectRevert();
        race.createRoom(order, permit);
    }

    function test_createRoom_trackIdAbove255_isAccepted() public {
        vm.startPrank(owner);
        for (uint256 index; index < 256; ++index) {
            tracks.createPlatformTrack(treasury, "Filler", KALI, 1);
        }

        vm.stopPrank();
        uint256 newestTrackId = tracks.nextId() - 1;
        assertGt(newestTrackId, 255);
        DuckWekVault.Order memory order = _createOrder(host, ROOM, newestTrackId, 1);
        DuckWekVault.Permit memory permit = _permit(hostKey);
        vm.prank(operator);
        race.createRoom(order, permit);
        (, uint64 trackId,,,,,) = race.rooms(1);
        assertEq(trackId, newestTrackId);
    }

    function test_joinBatch_joinedEventCarriesFullLoadout() public {
        uint256 roomId = _open(hostKey, ROOM);
        _payFirst(aliceKey, 3, 0, bytes32(0), ONE, 1);
        DuckWekVault.Loadout memory loadout = _equip(0, 0);
        loadout.template = 2;
        DuckWekVault.Order[] memory orders = new DuckWekVault.Order[](1);
        DuckWekVault.Permit[] memory permits = new DuckWekVault.Permit[](1);
        orders[0] = DuckWekVault.Order(alice, 2, 0, ROOM, loadout, TICKET, 1);
        permits[0] = _noPermit();
        vm.expectEmit(true, true, false, true);
        emit Joined(roomId, alice, loadout);
        vm.prank(operator);
        race.joinBatch(roomId, orders, permits);
    }

    function test_joinBatch_unlicensedPart_isReportedNotCharged() public {
        uint256 roomId = _open(hostKey, ROOM);
        DuckWekVault.Order[] memory orders = new DuckWekVault.Order[](1);
        DuckWekVault.Permit[] memory permits = new DuckWekVault.Permit[](1);
        orders[0] = DuckWekVault.Order(alice, 2, 0, ROOM, _equip(1, 1), TICKET, 1);
        permits[0] = _permit(aliceKey);
        vm.prank(operator);
        race.joinBatch(roomId, orders, permits);
        assertFalse(vault.joined(ROOM, alice));
        assertEq(usdc.balanceOf(alice), 100 * 1e6);
    }

    function test_createRoom_withoutUSDC_reverts() public {
        address broke = vm.addr(0xB20CE);
        DuckWekVault.Order memory order = _createOrder(broke, ROOM, 2, 1);
        DuckWekVault.Permit memory permit = _permit(0xB20CE);
        vm.prank(operator);
        vm.expectRevert();
        race.createRoom(order, permit);
        assertEq(race.roomIdOf(ROOM), 0);
    }

    function test_createRoom_withoutSession_reverts() public {
        DuckWekVault.Order memory order = _createOrder(host, ROOM, 2, 1);
        DuckWekVault.Permit memory none = _noPermit();
        vm.prank(operator);
        vm.expectRevert();
        race.createRoom(order, none);
        assertEq(usdc.balanceOf(host), 100 * 1e6);
    }

    // ─── JoinBatch ───

    function test_joinBatch_chargesTickets_emitsJoined() public {
        uint256 roomId = _open(hostKey, ROOM);
        vm.expectEmit(true, true, false, true);
        emit Joined(roomId, alice, _loadoutWithTemplate(0));
        vm.expectEmit(true, true, false, true);
        emit Joined(roomId, bob, _loadoutWithTemplate(1));
        _join(roomId, ROOM, _two(aliceKey, bobKey));
        (,,,, uint16 players,,) = race.rooms(roomId);
        assertEq(players, 3);
        assertEq(vault.available(treasury), ONE + 2 * TICKET);
        assertEq(usdc.balanceOf(alice), 100 * 1e6 - TICKET);
        assertTrue(vault.joined(ROOM, alice));
    }

    function test_joinBatch_badItem_emitsJoinFailed_othersPass() public {
        uint256 roomId = _open(hostKey, ROOM);
        address broke = vm.addr(0xB20CE);
        DuckWekVault.Order[] memory orders = new DuckWekVault.Order[](2);
        DuckWekVault.Permit[] memory permits = new DuckWekVault.Permit[](2);
        orders[0] = _joinOrder(broke, ROOM, 0);
        permits[0] = _permit(0xB20CE);
        orders[1] = _joinOrder(alice, ROOM, 1);
        permits[1] = _permit(aliceKey);
        vm.prank(operator);
        race.joinBatch(roomId, orders, permits);
        assertFalse(vault.joined(ROOM, broke));
        assertTrue(vault.joined(ROOM, alice));
        (,,,, uint16 players,,) = race.rooms(roomId);
        assertEq(players, 2);
    }

    function test_joinBatch_withoutSession_isNotCharged_andReported() public {
        uint256 roomId = _open(hostKey, ROOM);
        DuckWekVault.Order[] memory orders = new DuckWekVault.Order[](1);
        DuckWekVault.Permit[] memory permits = new DuckWekVault.Permit[](1);
        orders[0] = _joinOrder(alice, ROOM, 1);
        permits[0] = _noPermit();
        vm.recordLogs();
        vm.prank(operator);
        race.joinBatch(roomId, orders, permits);
        assertEq(usdc.balanceOf(alice), 100 * 1e6);
        assertFalse(vault.joined(ROOM, alice));
        assertEq(vm.getRecordedLogs().length, 1);
    }

    function test_joinBatch_alreadyPaid_isNotChargedTwice() public {
        uint256 roomId = _open(hostKey, ROOM);
        _join(roomId, ROOM, _two(aliceKey, bobKey));
        uint256[] memory again = new uint256[](1);
        again[0] = aliceKey;
        DuckWekVault.Order[] memory orders = new DuckWekVault.Order[](1);
        DuckWekVault.Permit[] memory permits = new DuckWekVault.Permit[](1);
        orders[0] = DuckWekVault.Order(alice, 2, 0, ROOM, _loadoutWithTemplate(0), TICKET, 2);
        permits[0] = _noPermit();
        vm.prank(operator);
        race.joinBatch(roomId, orders, permits);
        assertEq(usdc.balanceOf(alice), 100 * 1e6 - TICKET);
        (,,,, uint16 players,,) = race.rooms(roomId);
        assertEq(players, 3);
    }

    function test_joinBatch_wrongRoomKey_reverts() public {
        uint256 roomId = _open(hostKey, ROOM);
        DuckWekVault.Order[] memory orders = new DuckWekVault.Order[](1);
        DuckWekVault.Permit[] memory permits = new DuckWekVault.Permit[](1);
        orders[0] = _joinOrder(alice, ROOM2, 0);
        permits[0] = _permit(aliceKey);
        vm.prank(operator);
        vm.expectRevert(DuckWekRace.WrongOrder.selector);
        race.joinBatch(roomId, orders, permits);
    }

    function test_joinBatch_wrongKind_reverts() public {
        uint256 roomId = _open(hostKey, ROOM);
        DuckWekVault.Order[] memory orders = new DuckWekVault.Order[](1);
        DuckWekVault.Permit[] memory permits = new DuckWekVault.Permit[](1);
        orders[0] = _createOrder(alice, ROOM, 2, 0);
        permits[0] = _permit(aliceKey);
        vm.prank(operator);
        vm.expectRevert(DuckWekRace.WrongOrder.selector);
        race.joinBatch(roomId, orders, permits);
    }

    function test_joinBatch_lengthMismatch_and_tooLarge_reverts() public {
        uint256 roomId = _open(hostKey, ROOM);
        DuckWekVault.Order[] memory orders = new DuckWekVault.Order[](1);
        DuckWekVault.Permit[] memory permits = new DuckWekVault.Permit[](2);
        vm.prank(operator);
        vm.expectRevert(DuckWekRace.LengthMismatch.selector);
        race.joinBatch(roomId, orders, permits);
        orders = new DuckWekVault.Order[](101);
        permits = new DuckWekVault.Permit[](101);
        vm.prank(operator);
        vm.expectRevert(DuckWekRace.BatchTooLarge.selector);
        race.joinBatch(roomId, orders, permits);
    }

    function test_joinBatch_afterStart_reverts() public {
        uint256 roomId = _open(hostKey, ROOM);
        _start(roomId);
        DuckWekVault.Order[] memory orders = new DuckWekVault.Order[](0);
        DuckWekVault.Permit[] memory permits = new DuckWekVault.Permit[](0);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(DuckWekRace.WrongStatus.selector, DuckWekRace.Status.Started));
        race.joinBatch(roomId, orders, permits);
    }

    function test_joinBatch_onlyOperator() public {
        uint256 roomId = _open(hostKey, ROOM);
        DuckWekVault.Order[] memory orders = new DuckWekVault.Order[](0);
        DuckWekVault.Permit[] memory permits = new DuckWekVault.Permit[](0);
        vm.prank(stranger);
        vm.expectRevert(DuckWekRoles.NotOperator.selector);
        race.joinBatch(roomId, orders, permits);
    }

    function test_chargeSelf_notCallableFromOutside() public {
        DuckWekVault.Order memory order = _joinOrder(alice, ROOM, 0);
        DuckWekVault.Permit memory permit = _permit(aliceKey);
        vm.prank(operator);
        vm.expectRevert("only self");
        race.chargeSelf(order, permit);
    }

    // ─── Start ───

    function test_start_fixesStartBlock_seed_commitsParticipants() public {
        uint256 roomId = _open(hostKey, ROOM);
        _join(roomId, ROOM, _two(aliceKey, bobKey));
        vm.roll(1_000);
        vm.prevrandao(bytes32(uint256(0xBEEF)));
        bytes32 expectedSeed = keccak256(abi.encode(bytes32(uint256(0xBEEF)), ROOM, uint16(4)));
        vm.expectEmit(true, false, false, true);
        emit Started(roomId, 1_000, 4, keccak256("participants"), expectedSeed, keccak256("engine-1"));
        _start(roomId);
        (DuckWekRace.Status status,, uint32 startBlock,, uint16 players,, bytes32 seed) = race.rooms(roomId);
        assertEq(uint8(status), uint8(DuckWekRace.Status.Started));
        assertEq(startBlock, 1_000);
        assertEq(players, 4);
        assertEq(seed, expectedSeed);
    }

    function test_start_seedDependsOnPrevrandaoAndRoom() public {
        uint256 firstRoomId = _open(hostKey, ROOM);
        uint256 secondRoomId = _open(aliceKey, ROOM2);
        vm.prevrandao(bytes32(uint256(1)));
        _start(firstRoomId);
        _start(secondRoomId);
        (,,,,,, bytes32 seedA) = race.rooms(firstRoomId);
        (,,,,,, bytes32 seedB) = race.rooms(secondRoomId);
        assertTrue(seedA != seedB);
    }

    function test_start_twice_reverts_unknownRoom_reverts_onlyOperator() public {
        uint256 roomId = _open(hostKey, ROOM);
        _start(roomId);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(DuckWekRace.WrongStatus.selector, DuckWekRace.Status.Started));
        race.start(roomId, 4, bytes32(0), bytes32(0));
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(DuckWekRace.WrongStatus.selector, DuckWekRace.Status.None));
        race.start(99, 4, bytes32(0), bytes32(0));
        uint256 secondRoomId = _open(aliceKey, ROOM2);
        vm.prank(stranger);
        vm.expectRevert(DuckWekRoles.NotOperator.selector);
        race.start(secondRoomId, 4, bytes32(0), bytes32(0));
    }

    // ─── Tick ───

    function test_tick_stepIsBlockNumberMinusStartBlock() public {
        uint256 roomId = _open(hostKey, ROOM);
        vm.roll(500);
        _start(roomId);
        vm.roll(503);
        vm.expectEmit(true, false, false, true);
        emit Tick(roomId, 3);
        vm.prank(operator);
        race.tick(roomId);
        vm.roll(510);
        vm.expectEmit(true, false, false, true);
        emit Tick(roomId, 10);
        vm.prank(operator);
        race.tick(roomId);
    }

    function test_tick_severalInOneBlockReportSameStep() public {
        uint256 roomId = _open(hostKey, ROOM);
        vm.roll(500);
        _start(roomId);
        vm.roll(505);
        vm.expectEmit(true, false, false, true);
        emit Tick(roomId, 5);
        vm.prank(operator);
        race.tick(roomId);
        vm.expectEmit(true, false, false, true);
        emit Tick(roomId, 5);
        vm.prank(operator);
        race.tick(roomId);
    }

    function test_tick_beforeStart_afterFinalize_onlyOperator() public {
        uint256 roomId = _open(hostKey, ROOM);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(DuckWekRace.WrongStatus.selector, DuckWekRace.Status.Open));
        race.tick(roomId);
        _start(roomId);
        vm.prank(stranger);
        vm.expectRevert(DuckWekRoles.NotOperator.selector);
        race.tick(roomId);
        vm.prank(operator);
        race.finalize(roomId, bytes32(0), _podium(address(0), address(0), address(0)));
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(DuckWekRace.WrongStatus.selector, DuckWekRace.Status.Finished));
        race.tick(roomId);
    }

    // ─── Finalize ───

    function test_finalize_awardsFirstTimeAchievements_toPaidEntrants() public {
        uint256 roomId = _open(hostKey, ROOM);
        _join(roomId, ROOM, _two(aliceKey, bobKey));
        _start(roomId);
        vm.prank(operator);
        race.finalize(roomId, keccak256("standing"), _podium(alice, bob, host));
        assertEq(badge.ownerOf(1), alice);
        assertEq(badge.ownerOf(2), bob);
        assertEq(badge.ownerOf(3), host);
        assertEq(race.achieved(alice), 1);
        assertEq(race.achieved(bob), 2);
        assertEq(race.achieved(host), 4);
        (,,,,, bytes32 root,) = race.rooms(roomId);
        assertEq(root, keccak256("standing"));
        assertEq(uint8(_status(roomId)), uint8(DuckWekRace.Status.Finished));
    }

    function test_finalize_podiumMustHavePaidTheEntry() public {
        uint256 roomId = _open(hostKey, ROOM);
        _start(roomId);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(DuckWekRace.NotInRoom.selector, stranger));
        race.finalize(roomId, bytes32(0), _podium(stranger, address(0), address(0)));
    }

    function test_finalize_secondRace_noDuplicateBadge() public {
        uint256 roomId = _open(hostKey, ROOM);
        _join(roomId, ROOM, _two(aliceKey, bobKey));
        _start(roomId);
        vm.prank(operator);
        race.finalize(roomId, bytes32(0), _podium(alice, bob, address(0)));
        uint256 secondRoomId = _open(carolKey, ROOM2);
        uint256[] memory keys = new uint256[](1);
        keys[0] = aliceKey;
        DuckWekVault.Order[] memory orders = new DuckWekVault.Order[](1);
        DuckWekVault.Permit[] memory permits = new DuckWekVault.Permit[](1);
        orders[0] = DuckWekVault.Order(alice, 2, 0, ROOM2, _loadoutWithTemplate(0), TICKET, 1);
        permits[0] = _noPermit();
        vm.prank(operator);
        race.joinBatch(secondRoomId, orders, permits);
        _start(secondRoomId);
        vm.prank(operator);
        race.finalize(secondRoomId, bytes32(0), _podium(alice, address(0), address(0)));
        assertEq(badge.nextId(), 3);
    }

    function test_finalize_duplicatePodium_skipsZero_notStartedTwice() public {
        uint256 roomId = _open(hostKey, ROOM);
        _join(roomId, ROOM, _two(aliceKey, bobKey));
        _start(roomId);
        vm.prank(operator);
        vm.expectRevert(DuckWekRace.DuplicatePodium.selector);
        race.finalize(roomId, bytes32(0), _podium(alice, alice, host));
        vm.prank(operator);
        race.finalize(roomId, bytes32(0), _podium(address(0), alice, address(0)));
        assertEq(badge.nextId(), 2);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(DuckWekRace.WrongStatus.selector, DuckWekRace.Status.Finished));
        race.finalize(roomId, bytes32(0), _podium(address(0), address(0), address(0)));
    }

    function test_transferFrom_badgeIsSoulbound() public {
        uint256 roomId = _open(hostKey, ROOM);
        _start(roomId);
        vm.prank(operator);
        race.finalize(roomId, bytes32(0), _podium(host, address(0), address(0)));
        vm.prank(host);
        vm.expectRevert(Badge.Soulbound.selector);
        badge.transferFrom(host, alice, 1);
    }

    function test_tokenURI_badgeRemembersTrackAndRenders() public {
        uint256 roomId = _open(hostKey, ROOM);
        _start(roomId);
        vm.prank(operator);
        race.finalize(roomId, bytes32(0), _podium(host, address(0), address(0)));
        (,, uint16 rank, uint64 trackId,) = badge.titles(1);
        assertEq(rank, 1);
        assertEq(trackId, 2);
        string memory uri = badge.tokenURI(1);
        assertGt(bytes(uri).length, 1000);
    }

    function test_pause_blocksAllMutations() public {
        uint256 roomId = _open(hostKey, ROOM);
        vm.prank(owner);
        race.pause();
        DuckWekVault.Order memory order = _createOrder(alice, ROOM2, 1, 0);
        DuckWekVault.Permit memory permit = _permit(aliceKey);
        vm.startPrank(operator);
        vm.expectRevert();
        race.createRoom(order, permit);
        vm.expectRevert();
        race.start(roomId, 4, bytes32(0), bytes32(0));
        vm.stopPrank();
        vm.prank(owner);
        race.unpause();
        _start(roomId);
    }

    // ─── Gas ───

    function test_gas_joinBatch_99_with_permit_and_welcome() public {
        vm.prank(owner);
        vault.setWelcomeEnabled(true);
        uint256 roomId = _open(hostKey, ROOM);
        uint256 playerCount = 99;
        DuckWekVault.Order[] memory orders = new DuckWekVault.Order[](playerCount);
        DuckWekVault.Permit[] memory permits = new DuckWekVault.Permit[](playerCount);
        for (uint256 index; index < playerCount; ++index) {
            uint256 privateKey = 1000 + index;
            orders[index] = _joinOrder(vm.addr(privateKey), ROOM, uint8(index % 3));
            permits[index] = _permit(privateKey);
        }

        vm.prank(operator);
        uint256 gasBefore = gasleft();
        race.joinBatch(roomId, orders, permits);
        uint256 used = gasBefore - gasleft();
        emit log_named_uint("gas joinBatch 99 new players: permit + welcome mint + transferFrom (local EVM)", used);
        (,,,, uint16 players,,) = race.rooms(roomId);
        assertEq(players, 100);
        assertLt(used, 30_000_000);
    }

    function test_gas_tick() public {
        uint256 roomId = _open(hostKey, ROOM);
        _start(roomId);
        vm.roll(block.number + 1);
        vm.prank(operator);
        uint256 gasBefore = gasleft();
        race.tick(roomId);
        emit log_named_uint("gas tick (local EVM, warm after the first call)", gasBefore - gasleft());
    }
}
