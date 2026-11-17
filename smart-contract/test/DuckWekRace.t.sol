// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {DuckWekBase} from "./DuckWekBase.sol";
import {Badge} from "../src/Badge.sol";
import {DuckWekVault} from "../src/DuckWekVault.sol";
import {DuckWekRace} from "../src/DuckWekRace.sol";
import {DuckWekRoles} from "../src/DuckWekRoles.sol";

/// Race lifecycle: paid create and join under the session, seed, step, finalize, achievements.
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
    event RoomCreated(uint256 indexed roomId, bytes32 indexed roomKey, address indexed host, uint64 trackId, uint32 layoutVersion, uint256 paid);
    event Started(uint256 indexed roomId, uint32 startBlock, uint16 players, bytes32 participantsRoot, bytes32 seed, bytes32 engineVersion);

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

    // ---------- helpers ----------
    function _permit(uint256 key) internal view returns (DuckWekVault.Permit memory p) {
        p = _permit(key, CAP, block.timestamp + 1 days);
    }

    function _tmpl(uint8 template) internal pure returns (DuckWekVault.Loadout memory l) {
        l = _empty();
        l.template = template;
    }

    function _createOrder(address payer, bytes32 key, uint256 trackId, uint8 template)
        internal
        pure
        returns (DuckWekVault.Order memory)
    {
        return DuckWekVault.Order(payer, 1, trackId, key, _tmpl(template), ONE, 1);
    }

    function _joinOrder(address payer, bytes32 key, uint8 template) internal pure returns (DuckWekVault.Order memory) {
        return DuckWekVault.Order(payer, 2, 0, key, _tmpl(template), TICKET, 1);
    }

    function _open(uint256 key, bytes32 roomKey) internal returns (uint256 id) {
        DuckWekVault.Order memory o = _createOrder(vm.addr(key), roomKey, 2, 1);
        DuckWekVault.Permit memory p = _permit(key); // built before the prank: a prank applies to the next call
        vm.prank(operator);
        id = race.createRoom(o, p);
    }

    function _join(uint256 id, bytes32 roomKey, uint256[] memory keys) internal {
        DuckWekVault.Order[] memory os = new DuckWekVault.Order[](keys.length);
        DuckWekVault.Permit[] memory ps = new DuckWekVault.Permit[](keys.length);
        for (uint256 i; i < keys.length; ++i) {
            os[i] = _joinOrder(vm.addr(keys[i]), roomKey, uint8(i % 3));
            ps[i] = _permit(keys[i]); // the first order of each player's session carries the permit
        }
        vm.prank(operator);
        race.joinBatch(id, os, ps);
    }

    function _two(uint256 a, uint256 b) internal pure returns (uint256[] memory k) {
        k = new uint256[](2);
        k[0] = a;
        k[1] = b;
    }

    function _start(uint256 id) internal {
        vm.prank(operator);
        race.start(id, 4, keccak256("participants"), keccak256("engine-1"));
    }

    function _podium(address a, address b, address c) internal pure returns (address[3] memory p) {
        p[0] = a;
        p[1] = b;
        p[2] = c;
    }

    function _status(uint256 id) internal view returns (DuckWekRace.Status s) {
        (s,,,,,,) = race.rooms(id);
    }

    // ---------- createRoom ----------
    function test_createRoom_chargesRent_opensRoom_hostIsFirstEntrant() public {
        DuckWekVault.Order memory o = _createOrder(host, ROOM, 2, 1);
        DuckWekVault.Permit memory p = _permit(hostKey);
        vm.expectEmit(true, true, true, true);
        emit RoomCreated(1, ROOM, host, 2, 1, ONE);
        vm.expectEmit(true, true, false, true);
        emit Joined(1, host, _tmpl(1));
        vm.prank(operator);
        uint256 id = race.createRoom(o, p);
        assertEq(id, 1);
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

    function test_createRoom_twice_in_one_session_second_needs_no_permit() public {
        _open(hostKey, ROOM);
        DuckWekVault.Order memory o = _createOrder(host, ROOM2, 1, 0);
        DuckWekVault.Permit memory none = _noPermit();
        vm.prank(operator);
        uint256 id = race.createRoom(o, none); // the allowance from the first permit is still there
        assertEq(id, 2);
        assertEq(usdc.balanceOf(host), 98 * 1e6);
    }

    function test_createRoom_onlyOperator() public {
        DuckWekVault.Order memory o = _createOrder(host, ROOM, 2, 1);
        DuckWekVault.Permit memory p = _permit(hostKey);
        vm.prank(stranger);
        vm.expectRevert(DuckWekRoles.NotOperator.selector);
        race.createRoom(o, p);
    }

    function test_createRoom_wrongKind_reverts() public {
        DuckWekVault.Order memory o = _joinOrder(host, ROOM, 1);
        DuckWekVault.Permit memory p = _permit(hostKey);
        vm.prank(operator);
        vm.expectRevert(DuckWekRace.BadKind.selector);
        race.createRoom(o, p);
    }

    function test_createRoom_duplicateRoomKey_reverts() public {
        _open(hostKey, ROOM);
        DuckWekVault.Order memory o = _createOrder(alice, ROOM, 2, 1);
        DuckWekVault.Permit memory p = _permit(aliceKey);
        vm.prank(operator);
        vm.expectRevert(DuckWekRace.RoomKeyUsed.selector);
        race.createRoom(o, p);
    }

    function test_createRoom_unknownTrack_reverts() public {
        DuckWekVault.Order memory o = _createOrder(host, ROOM, 99, 1);
        DuckWekVault.Permit memory p = _permit(hostKey);
        vm.prank(operator);
        vm.expectRevert();
        race.createRoom(o, p);
    }

    /// Track ids are no longer capped at 255: creator circuits share the id space of platform circuits.
    function test_createRoom_trackIdAbove255_isAccepted() public {
        vm.startPrank(owner);
        for (uint256 i; i < 256; ++i) tracks.createPlatformTrack(treasury, "Filler", KALI, 1);
        vm.stopPrank();
        uint256 id = tracks.nextId() - 1; // 258
        assertGt(id, 255);
        DuckWekVault.Order memory o = _createOrder(host, ROOM, id, 1);
        DuckWekVault.Permit memory p = _permit(hostKey);
        vm.prank(operator);
        race.createRoom(o, p);
        (, uint64 trackId,,,,,) = race.rooms(1);
        assertEq(trackId, id);
    }

    function test_joined_event_carries_the_full_loadout() public {
        uint256 id = _open(hostKey, ROOM);
        _payFirst(aliceKey, 3, 0, bytes32(0), ONE, 1); // alice buys Layangan Wings
        DuckWekVault.Loadout memory l = _equip(0, 0);
        l.template = 2;
        DuckWekVault.Order[] memory os = new DuckWekVault.Order[](1);
        DuckWekVault.Permit[] memory ps = new DuckWekVault.Permit[](1);
        os[0] = DuckWekVault.Order(alice, 2, 0, ROOM, l, TICKET, 1);
        ps[0] = _noPermit();
        vm.expectEmit(true, true, false, true);
        emit Joined(id, alice, l);
        vm.prank(operator);
        race.joinBatch(id, os, ps);
    }

    function test_joinBatch_unlicensedPart_isReportedNotCharged() public {
        uint256 id = _open(hostKey, ROOM);
        DuckWekVault.Order[] memory os = new DuckWekVault.Order[](1);
        DuckWekVault.Permit[] memory ps = new DuckWekVault.Permit[](1);
        os[0] = DuckWekVault.Order(alice, 2, 0, ROOM, _equip(1, 1), TICKET, 1); // no Turbo Tail licence
        ps[0] = _permit(aliceKey);
        vm.prank(operator);
        race.joinBatch(id, os, ps);
        assertFalse(vault.joined(ROOM, alice));
        assertEq(usdc.balanceOf(alice), 100 * 1e6);
    }

    function test_createRoom_withoutUSDC_reverts() public {
        address broke = vm.addr(0xB20CE);
        DuckWekVault.Order memory o = _createOrder(broke, ROOM, 2, 1);
        DuckWekVault.Permit memory p = _permit(0xB20CE);
        vm.prank(operator);
        vm.expectRevert();
        race.createRoom(o, p);
        assertEq(race.roomIdOf(ROOM), 0); // nothing was opened
    }

    function test_createRoom_withoutSession_reverts() public {
        DuckWekVault.Order memory o = _createOrder(host, ROOM, 2, 1);
        DuckWekVault.Permit memory none = _noPermit();
        vm.prank(operator);
        vm.expectRevert(); // no permit, no allowance: the operator cannot take the rent
        race.createRoom(o, none);
        assertEq(usdc.balanceOf(host), 100 * 1e6);
    }

    // ---------- joinBatch ----------
    function test_joinBatch_chargesTickets_emitsJoined() public {
        uint256 id = _open(hostKey, ROOM);
        vm.expectEmit(true, true, false, true);
        emit Joined(id, alice, _tmpl(0));
        vm.expectEmit(true, true, false, true);
        emit Joined(id, bob, _tmpl(1));
        _join(id, ROOM, _two(aliceKey, bobKey));
        (,,,, uint16 players,,) = race.rooms(id);
        assertEq(players, 3);
        assertEq(vault.available(treasury), ONE + 2 * TICKET);
        assertEq(usdc.balanceOf(alice), 100 * 1e6 - TICKET);
        assertTrue(vault.joined(ROOM, alice));
    }

    function test_joinBatch_badItem_emitsJoinFailed_othersPass() public {
        uint256 id = _open(hostKey, ROOM);
        address broke = vm.addr(0xB20CE);
        DuckWekVault.Order[] memory os = new DuckWekVault.Order[](2);
        DuckWekVault.Permit[] memory ps = new DuckWekVault.Permit[](2);
        os[0] = _joinOrder(broke, ROOM, 0); // no USDC
        ps[0] = _permit(0xB20CE);
        os[1] = _joinOrder(alice, ROOM, 1);
        ps[1] = _permit(aliceKey);
        vm.prank(operator);
        race.joinBatch(id, os, ps);
        assertFalse(vault.joined(ROOM, broke));
        assertTrue(vault.joined(ROOM, alice));
        (,,,, uint16 players,,) = race.rooms(id);
        assertEq(players, 2); // host + alice
    }

    function test_joinBatch_withoutSession_isNotCharged_andReported() public {
        uint256 id = _open(hostKey, ROOM);
        DuckWekVault.Order[] memory os = new DuckWekVault.Order[](1);
        DuckWekVault.Permit[] memory ps = new DuckWekVault.Permit[](1);
        os[0] = _joinOrder(alice, ROOM, 1);
        ps[0] = _noPermit(); // alice has never signed: the operator has no allowance to use
        vm.recordLogs();
        vm.prank(operator);
        race.joinBatch(id, os, ps);
        assertEq(usdc.balanceOf(alice), 100 * 1e6);
        assertFalse(vault.joined(ROOM, alice));
        assertEq(vm.getRecordedLogs().length, 1); // exactly one event: JoinFailed
    }

    function test_joinBatch_alreadyPaid_isNotChargedTwice() public {
        uint256 id = _open(hostKey, ROOM);
        _join(id, ROOM, _two(aliceKey, bobKey));
        uint256[] memory again = new uint256[](1);
        again[0] = aliceKey;
        DuckWekVault.Order[] memory os = new DuckWekVault.Order[](1);
        DuckWekVault.Permit[] memory ps = new DuckWekVault.Permit[](1);
        os[0] = DuckWekVault.Order(alice, 2, 0, ROOM, _tmpl(0), TICKET, 2);
        ps[0] = _noPermit();
        vm.prank(operator);
        race.joinBatch(id, os, ps); // JoinFailed(AlreadyJoined), nothing charged
        assertEq(usdc.balanceOf(alice), 100 * 1e6 - TICKET);
        (,,,, uint16 players,,) = race.rooms(id);
        assertEq(players, 3);
    }

    function test_joinBatch_wrongRoomKey_reverts() public {
        uint256 id = _open(hostKey, ROOM);
        DuckWekVault.Order[] memory os = new DuckWekVault.Order[](1);
        DuckWekVault.Permit[] memory ps = new DuckWekVault.Permit[](1);
        os[0] = _joinOrder(alice, ROOM2, 0);
        ps[0] = _permit(aliceKey);
        vm.prank(operator);
        vm.expectRevert(DuckWekRace.WrongOrder.selector);
        race.joinBatch(id, os, ps);
    }

    function test_joinBatch_wrongKind_reverts() public {
        uint256 id = _open(hostKey, ROOM);
        DuckWekVault.Order[] memory os = new DuckWekVault.Order[](1);
        DuckWekVault.Permit[] memory ps = new DuckWekVault.Permit[](1);
        os[0] = _createOrder(alice, ROOM, 2, 0);
        ps[0] = _permit(aliceKey);
        vm.prank(operator);
        vm.expectRevert(DuckWekRace.WrongOrder.selector);
        race.joinBatch(id, os, ps);
    }

    function test_joinBatch_lengthMismatch_and_tooLarge_reverts() public {
        uint256 id = _open(hostKey, ROOM);
        DuckWekVault.Order[] memory os = new DuckWekVault.Order[](1);
        DuckWekVault.Permit[] memory ps = new DuckWekVault.Permit[](2);
        vm.prank(operator);
        vm.expectRevert(DuckWekRace.LengthMismatch.selector);
        race.joinBatch(id, os, ps);
        os = new DuckWekVault.Order[](101);
        ps = new DuckWekVault.Permit[](101);
        vm.prank(operator);
        vm.expectRevert(DuckWekRace.BatchTooLarge.selector);
        race.joinBatch(id, os, ps);
    }

    function test_joinBatch_afterStart_reverts() public {
        uint256 id = _open(hostKey, ROOM);
        _start(id);
        DuckWekVault.Order[] memory os = new DuckWekVault.Order[](0);
        DuckWekVault.Permit[] memory ps = new DuckWekVault.Permit[](0);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(DuckWekRace.WrongStatus.selector, DuckWekRace.Status.Started));
        race.joinBatch(id, os, ps);
    }

    function test_joinBatch_onlyOperator() public {
        uint256 id = _open(hostKey, ROOM);
        DuckWekVault.Order[] memory os = new DuckWekVault.Order[](0);
        DuckWekVault.Permit[] memory ps = new DuckWekVault.Permit[](0);
        vm.prank(stranger);
        vm.expectRevert(DuckWekRoles.NotOperator.selector);
        race.joinBatch(id, os, ps);
    }

    function test_chargeSelf_is_not_callable_from_outside() public {
        DuckWekVault.Order memory o = _joinOrder(alice, ROOM, 0);
        DuckWekVault.Permit memory p = _permit(aliceKey);
        vm.prank(operator);
        vm.expectRevert("only self");
        race.chargeSelf(o, p);
    }

    // ---------- start: the seed ----------
    function test_start_fixesStartBlock_seed_commitsParticipants() public {
        uint256 id = _open(hostKey, ROOM);
        _join(id, ROOM, _two(aliceKey, bobKey));
        vm.roll(1_000);
        vm.prevrandao(bytes32(uint256(0xBEEF)));
        bytes32 expectedSeed = keccak256(abi.encode(bytes32(uint256(0xBEEF)), ROOM, uint16(4)));
        vm.expectEmit(true, false, false, true);
        emit Started(id, 1_000, 4, keccak256("participants"), expectedSeed, keccak256("engine-1"));
        _start(id);
        (DuckWekRace.Status status,, uint32 startBlock,, uint16 players,, bytes32 seed) = race.rooms(id);
        assertEq(uint8(status), uint8(DuckWekRace.Status.Started));
        assertEq(startBlock, 1_000);
        assertEq(players, 4);
        assertEq(seed, expectedSeed);
    }

    function test_start_seed_depends_on_prevrandao_and_room() public {
        uint256 a = _open(hostKey, ROOM);
        uint256 b = _open(aliceKey, ROOM2);
        vm.prevrandao(bytes32(uint256(1)));
        _start(a);
        _start(b);
        (,,,,, , bytes32 seedA) = race.rooms(a);
        (,,,,, , bytes32 seedB) = race.rooms(b);
        assertTrue(seedA != seedB); // same block, same prevrandao: the room key still separates the seeds
    }

    function test_start_twice_reverts_unknownRoom_reverts_onlyOperator() public {
        uint256 id = _open(hostKey, ROOM);
        _start(id);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(DuckWekRace.WrongStatus.selector, DuckWekRace.Status.Started));
        race.start(id, 4, bytes32(0), bytes32(0));
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(DuckWekRace.WrongStatus.selector, DuckWekRace.Status.None));
        race.start(99, 4, bytes32(0), bytes32(0));
        uint256 id2 = _open(aliceKey, ROOM2);
        vm.prank(stranger);
        vm.expectRevert(DuckWekRoles.NotOperator.selector);
        race.start(id2, 4, bytes32(0), bytes32(0));
    }

    // ---------- tick: the step comes from the chain ----------
    function test_tick_stepIsBlockNumberMinusStartBlock() public {
        uint256 id = _open(hostKey, ROOM);
        vm.roll(500);
        _start(id);
        vm.roll(503);
        vm.expectEmit(true, false, false, true);
        emit Tick(id, 3);
        vm.prank(operator);
        race.tick(id);
        vm.roll(510);
        vm.expectEmit(true, false, false, true);
        emit Tick(id, 10);
        vm.prank(operator);
        race.tick(id);
    }

    function test_tick_several_in_one_block_report_the_same_step() public {
        uint256 id = _open(hostKey, ROOM);
        vm.roll(500);
        _start(id);
        vm.roll(505);
        vm.expectEmit(true, false, false, true);
        emit Tick(id, 5);
        vm.prank(operator);
        race.tick(id);
        vm.expectEmit(true, false, false, true);
        emit Tick(id, 5); // two transactions in block 505: the backend ignores the duplicate step
        vm.prank(operator);
        race.tick(id);
    }

    function test_tick_beforeStart_afterFinalize_onlyOperator() public {
        uint256 id = _open(hostKey, ROOM);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(DuckWekRace.WrongStatus.selector, DuckWekRace.Status.Open));
        race.tick(id);
        _start(id);
        vm.prank(stranger);
        vm.expectRevert(DuckWekRoles.NotOperator.selector);
        race.tick(id);
        vm.prank(operator);
        race.finalize(id, bytes32(0), _podium(address(0), address(0), address(0)));
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(DuckWekRace.WrongStatus.selector, DuckWekRace.Status.Finished));
        race.tick(id);
    }

    // ---------- finalize: standing, podium, first-time achievements ----------
    function test_finalize_awardsFirstTimeAchievements_toPaidEntrants() public {
        uint256 id = _open(hostKey, ROOM);
        _join(id, ROOM, _two(aliceKey, bobKey));
        _start(id);
        vm.prank(operator);
        race.finalize(id, keccak256("standing"), _podium(alice, bob, host));
        assertEq(badge.ownerOf(1), alice);
        assertEq(badge.ownerOf(2), bob);
        assertEq(badge.ownerOf(3), host);
        assertEq(race.achieved(alice), 1);
        assertEq(race.achieved(bob), 2);
        assertEq(race.achieved(host), 4);
        (,,,,, bytes32 root,) = race.rooms(id);
        assertEq(root, keccak256("standing"));
        assertEq(uint8(_status(id)), uint8(DuckWekRace.Status.Finished));
    }

    function test_finalize_podiumMustHavePaidTheEntry() public {
        uint256 id = _open(hostKey, ROOM);
        _start(id);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(DuckWekRace.NotInRoom.selector, stranger));
        race.finalize(id, bytes32(0), _podium(stranger, address(0), address(0)));
    }

    function test_finalize_secondRace_noDuplicateBadge() public {
        uint256 id = _open(hostKey, ROOM);
        _join(id, ROOM, _two(aliceKey, bobKey));
        _start(id);
        vm.prank(operator);
        race.finalize(id, bytes32(0), _podium(alice, bob, address(0)));
        uint256 id2 = _open(carolKey, ROOM2);
        uint256[] memory k = new uint256[](1);
        k[0] = aliceKey;
        DuckWekVault.Order[] memory os = new DuckWekVault.Order[](1);
        DuckWekVault.Permit[] memory ps = new DuckWekVault.Permit[](1);
        os[0] = DuckWekVault.Order(alice, 2, 0, ROOM2, _tmpl(0), TICKET, 1);
        ps[0] = _noPermit(); // alice's session from the first race is still valid
        vm.prank(operator);
        race.joinBatch(id2, os, ps);
        _start(id2);
        vm.prank(operator);
        race.finalize(id2, bytes32(0), _podium(alice, address(0), address(0)));
        assertEq(badge.nextId(), 3); // alice already had "winner": no second badge
    }

    function test_finalize_duplicatePodium_skipsZero_notStartedTwice() public {
        uint256 id = _open(hostKey, ROOM);
        _join(id, ROOM, _two(aliceKey, bobKey));
        _start(id);
        vm.prank(operator);
        vm.expectRevert(DuckWekRace.DuplicatePodium.selector);
        race.finalize(id, bytes32(0), _podium(alice, alice, host));
        vm.prank(operator);
        race.finalize(id, bytes32(0), _podium(address(0), alice, address(0))); // a bot won, bots get nothing
        assertEq(badge.nextId(), 2);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(DuckWekRace.WrongStatus.selector, DuckWekRace.Status.Finished));
        race.finalize(id, bytes32(0), _podium(address(0), address(0), address(0)));
    }

    function test_badge_isSoulbound() public {
        uint256 id = _open(hostKey, ROOM);
        _start(id);
        vm.prank(operator);
        race.finalize(id, bytes32(0), _podium(host, address(0), address(0)));
        vm.prank(host);
        vm.expectRevert(Badge.Soulbound.selector);
        badge.transferFrom(host, alice, 1);
    }

    function test_badge_remembers_the_track_and_renders() public {
        uint256 id = _open(hostKey, ROOM); // track 2 = Merapi Ring
        _start(id);
        vm.prank(operator);
        race.finalize(id, bytes32(0), _podium(host, address(0), address(0)));
        (,, uint16 rank, uint64 trackId,) = badge.titles(1);
        assertEq(rank, 1);
        assertEq(trackId, 2);
        string memory uri = badge.tokenURI(1);
        assertGt(bytes(uri).length, 1000);
    }

    function test_paused_blocksAllMutations() public {
        uint256 id = _open(hostKey, ROOM);
        vm.prank(owner);
        race.pause();
        DuckWekVault.Order memory o = _createOrder(alice, ROOM2, 1, 0);
        DuckWekVault.Permit memory p = _permit(aliceKey);
        vm.startPrank(operator);
        vm.expectRevert();
        race.createRoom(o, p);
        vm.expectRevert();
        race.start(id, 4, bytes32(0), bytes32(0));
        vm.stopPrank();
        vm.prank(owner);
        race.unpause();
        _start(id);
    }

    // ---------- gas (warm local EVM, NOT Monad numbers: the real figures come from the testnet run, plan T-2 / T-3) ----------
    function test_gas_joinBatch_99_with_permit_and_welcome() public {
        vm.prank(owner);
        vault.setWelcomeEnabled(true);
        uint256 id = _open(hostKey, ROOM);
        uint256 n = 99;
        DuckWekVault.Order[] memory os = new DuckWekVault.Order[](n);
        DuckWekVault.Permit[] memory ps = new DuckWekVault.Permit[](n);
        for (uint256 i; i < n; ++i) {
            uint256 k = 1000 + i; // brand-new wallets: no USDC, the welcome mint covers the ticket
            os[i] = _joinOrder(vm.addr(k), ROOM, uint8(i % 3));
            ps[i] = _permit(k);
        }
        vm.prank(operator);
        uint256 g = gasleft();
        race.joinBatch(id, os, ps);
        uint256 used = g - gasleft();
        emit log_named_uint("gas joinBatch 99 new players: permit + welcome mint + transferFrom (local EVM)", used);
        (,,,, uint16 players,,) = race.rooms(id);
        assertEq(players, 100);
        assertLt(used, 30_000_000); // must fit the 30M per-transaction limit
    }

    function test_gas_tick() public {
        uint256 id = _open(hostKey, ROOM);
        _start(id);
        vm.roll(block.number + 1);
        vm.prank(operator);
        uint256 g = gasleft();
        race.tick(id);
        emit log_named_uint("gas tick (local EVM, warm after the first call)", g - gasleft());
    }
}
