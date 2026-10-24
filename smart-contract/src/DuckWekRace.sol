// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {DuckWekRoles} from "./DuckWekRoles.sol";
import {DuckWekVault} from "./DuckWekVault.sol";
import {Badge} from "./Badge.sol";

/// @title DuckWek on-chain race: paid entry, the seed, every step, the result, first-time achievements.
/// @notice One signature per player, at connect (the permit the Vault charges under). On-chain here:
///   - `createRoom`: the host's circuit rent (1 USDC) is charged by the Vault, the room is opened and the host is the first
///     entrant (the rent covers the host's entry).
///   - `joinBatch`: every ticket (0.10 USDC) is charged by the Vault in this transaction, `Joined` is emitted for each one
///     that was paid and `JoinFailed` for each one that could not be charged, without blocking the others.
///   - `start`: fixes `startBlock` and the race `seed` (`prevrandao`, the room key and the player count), and commits the
///     participant list.
///   - `tick`: one transaction per race step. The step `n = block.number - startBlock` is derived HERE, at inclusion, so the
///     backend never reads a block, a block hash or a log range. The positions are not written on-chain: they are a pure
///     function of (seed, participant list, n) and anyone recomputes them.
///   - `finalize`: standing root and podium. Podium finishers must be paid entrants of the room (checked against the Vault);
///     each gets a soulbound achievement the first time they reach each rank.
/// @dev This contract must be an operator of the Vault, and the minter of the Badge. Trust model: the contract RECORDS
///      the race; the operator posts the standing root and the podium. The seed is `prevrandao` at `start`, so the operator
///      chooses the moment of `start` (and therefore which `prevrandao` becomes the seed): the contract records who did it,
///      it does not prove who picked the moment.
contract DuckWekRace is DuckWekRoles {
    enum Status {
        None,
        Open,
        Started,
        Finished
    }

    /// @dev Slot 0 packs the fields read on the hot `tick` path. `standingRoot` and `seed` use their own slots.
    struct Room {
        Status status;
        uint8 trackId; // off-chain track id (1 = Kali Code Sprint, 2 = Alpine Ring)
        uint32 startBlock;
        uint32 endBlock;
        uint16 players;
        bytes32 standingRoot;
        bytes32 seed;
    }

    uint256 public constant MAX_BATCH = 100; // each join is a USDC payment, so a batch is heavier than a plain event

    DuckWekVault public immutable vault;
    Badge public immutable badge;

    uint256 public nextRoomId;
    mapping(uint256 => Room) public rooms;
    mapping(bytes32 => uint256) public roomIdOf; // roomKey (keccak of the room code) => room id
    mapping(uint256 => bytes32) public keyOf; // room id => roomKey
    /// @notice Achievements already earned by a player. bit0 winner, bit1 runner-up, bit2 third.
    mapping(address => uint8) public achieved;

    event RoomCreated(uint256 indexed roomId, bytes32 indexed roomKey, address indexed host, uint8 trackId, uint256 paid);
    event Joined(uint256 indexed roomId, address indexed player, uint8 template);
    event JoinFailed(uint256 indexed roomId, address indexed player, bytes reason);
    event Started(uint256 indexed roomId, uint32 startBlock, uint16 players, bytes32 participantsRoot, bytes32 seed);
    /// @dev `n` = block.number - startBlock at inclusion. May land several per block: the step is what counts.
    event Tick(uint256 indexed roomId, uint32 n);
    event Finalized(uint256 indexed roomId, bytes32 standingRoot, uint32 endBlock, address[3] podium);
    event AchievementAwarded(uint256 indexed roomId, address indexed player, uint8 kind);

    error WrongStatus(Status current);
    error BadKind();
    error TrackOutOfRange();
    error RoomKeyUsed();
    error WrongOrder();
    error LengthMismatch();
    error BatchTooLarge();
    error NotInRoom(address player);
    error DuplicatePodium();

    string private constant TITLE_WINNER = "First Time Winner";
    string private constant TITLE_RUNNER_UP = "First Time Runner-up";
    string private constant TITLE_THIRD = "First Time Third";

    constructor(address owner_, address vault_, address badge_) DuckWekRoles(owner_) {
        vault = DuckWekVault(vault_);
        badge = Badge(badge_);
    }

    // ---------------------------------------------------------------- lifecycle

    /// @notice Open a room. The order is the host's circuit rent (kind CREATE_ROOM, ref = track id). `p.deadline == 0`
    ///         means the allowance from the host's session already exists.
    function createRoom(DuckWekVault.Order calldata o, DuckWekVault.Permit calldata p)
        external
        onlyOperator
        whenNotPaused
        returns (uint256 id)
    {
        if (o.kind != uint8(DuckWekVault.Kind.CREATE_ROOM)) revert BadKind();
        if (o.ref > type(uint8).max) revert TrackOutOfRange();
        if (roomIdOf[o.roomKey] != 0) revert RoomKeyUsed();

        _charge(o, p); // charges the rent, registers the host as the first entrant

        id = ++nextRoomId;
        roomIdOf[o.roomKey] = id;
        keyOf[id] = o.roomKey;
        rooms[id] = Room({status: Status.Open, trackId: uint8(o.ref), startBlock: 0, endBlock: 0, players: 1, standingRoot: bytes32(0), seed: bytes32(0)});
        emit RoomCreated(id, o.roomKey, o.payer, uint8(o.ref), o.amount);
        emit Joined(id, o.payer, o.template);
    }

    /// @notice Record paid joins. Each order is a player's ticket (kind JOIN_ROOM), charged by the Vault under that player's
    ///         session. A ticket that cannot be charged (no allowance, no USDC, already joined, room full) emits `JoinFailed`
    ///         and does not block the others.
    function joinBatch(uint256 roomId, DuckWekVault.Order[] calldata os, DuckWekVault.Permit[] calldata ps)
        external
        onlyOperator
        whenNotPaused
    {
        Room storage r = rooms[roomId];
        if (r.status != Status.Open) revert WrongStatus(r.status);
        uint256 n = os.length;
        if (n != ps.length) revert LengthMismatch();
        if (n > MAX_BATCH) revert BatchTooLarge();

        bytes32 key = keyOf[roomId];
        uint16 paid;
        for (uint256 i; i < n; ++i) {
            DuckWekVault.Order calldata o = os[i];
            if (o.kind != uint8(DuckWekVault.Kind.JOIN_ROOM) || o.roomKey != key) revert WrongOrder();
            try this.chargeSelf(o, ps[i]) {
                ++paid;
                emit Joined(roomId, o.payer, o.template);
            } catch (bytes memory reason) {
                emit JoinFailed(roomId, o.payer, reason);
            }
        }
        r.players += paid;
    }

    /// @dev External only so that `joinBatch` can try/catch one charge; callable by this contract alone.
    function chargeSelf(DuckWekVault.Order calldata o, DuckWekVault.Permit calldata p) external {
        require(msg.sender == address(this), "only self");
        _charge(o, p);
    }

    /// @notice Close joins, fix `startBlock` and the seed. `players` and `participantsRoot` are the operator's final
    ///         participant list (humans plus bots; root over the ordered list; the order defines the duck index).
    function start(uint256 roomId, uint16 players, bytes32 participantsRoot) external onlyOperator whenNotPaused {
        Room storage r = rooms[roomId];
        if (r.status != Status.Open) revert WrongStatus(r.status);
        bytes32 seed = keccak256(abi.encode(block.prevrandao, keyOf[roomId], players));
        r.status = Status.Started;
        r.startBlock = uint32(block.number);
        r.players = players;
        r.seed = seed;
        emit Started(roomId, uint32(block.number), players, participantsRoot, seed);
    }

    /// @notice Record one race step. `n` is computed here from the block that includes this transaction.
    function tick(uint256 roomId) external onlyOperator whenNotPaused {
        Room storage r = rooms[roomId];
        if (r.status != Status.Started) revert WrongStatus(r.status);
        emit Tick(roomId, uint32(block.number) - r.startBlock);
    }

    /// @notice Close the race: record the standing root and podium, award first-time achievements.
    /// @param podium ranks 1..3; address(0) where a bot finished (bots receive nothing). Every other entry must have paid
    ///        its entry into this room (checked against the Vault).
    function finalize(uint256 roomId, bytes32 standingRoot, address[3] calldata podium)
        external
        onlyOperator
        whenNotPaused
    {
        Room storage r = rooms[roomId];
        if (r.status != Status.Started) revert WrongStatus(r.status);
        if (
            (podium[0] != address(0) && (podium[0] == podium[1] || podium[0] == podium[2]))
                || (podium[1] != address(0) && podium[1] == podium[2])
        ) revert DuplicatePodium();

        r.status = Status.Finished;
        r.endBlock = uint32(block.number);
        r.standingRoot = standingRoot;

        bytes32 key = keyOf[roomId];
        for (uint8 i; i < 3; ++i) {
            address p = podium[i];
            if (p == address(0)) continue;
            if (!vault.joined(key, p)) revert NotInRoom(p);
            uint8 bit = uint8(1) << i;
            uint8 have = achieved[p];
            if (have & bit != 0) continue; // already earned this kind: event only
            achieved[p] = have | bit;
            badge.award(p, bytes32(roomId), uint64(roomId), uint16(i + 1), _title(i));
            emit AchievementAwarded(roomId, p, i);
        }
        emit Finalized(roomId, standingRoot, uint32(block.number), podium);
    }

    function _charge(DuckWekVault.Order calldata o, DuckWekVault.Permit calldata p) internal {
        if (p.deadline != 0) vault.permitAndSpend(o, p);
        else vault.spend(o);
    }

    function _title(uint8 kind) private pure returns (string memory) {
        if (kind == 0) return TITLE_WINNER;
        if (kind == 1) return TITLE_RUNNER_UP;
        return TITLE_THIRD;
    }
}
