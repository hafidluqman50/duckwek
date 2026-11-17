// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {DuckWekRoles} from "./DuckWekRoles.sol";
import {DuckWekVault} from "./DuckWekVault.sol";
import {Badge} from "./Badge.sol";

contract DuckWekRace is DuckWekRoles, ReentrancyGuard {
    enum Status {
        None,
        Open,
        Started,
        Finished
    }

    struct Room {
        Status status;
        uint64 trackId;
        uint32 startBlock;
        uint32 endBlock;
        uint16 players;
        bytes32 standingRoot;
        bytes32 seed;
    }

    uint256 public constant MAX_BATCH = 100;

    DuckWekVault public immutable vault;
    Badge public immutable badge;

    uint256 public nextRoomId;
    mapping(uint256 => Room) public rooms;
    mapping(bytes32 => uint256) public roomIdOf;
    mapping(uint256 => bytes32) public keyOf;
    mapping(address => uint8) public achieved;

    event RoomCreated(
        uint256 indexed roomId,
        bytes32 indexed roomKey,
        address indexed host,
        uint64 trackId,
        uint32 layoutVersion,
        uint256 paid
    );
    event Joined(uint256 indexed roomId, address indexed player, DuckWekVault.Loadout loadout);
    event JoinFailed(uint256 indexed roomId, address indexed player, bytes reason);
    event Started(
        uint256 indexed roomId,
        uint32 startBlock,
        uint16 players,
        bytes32 participantsRoot,
        bytes32 seed,
        bytes32 engineVersion
    );
    event Tick(uint256 indexed roomId, uint32 n);
    event Finalized(uint256 indexed roomId, bytes32 standingRoot, uint32 endBlock, address[3] podium);
    event AchievementAwarded(uint256 indexed roomId, address indexed player, uint8 kind);

    error WrongStatus(Status current);
    error BadKind();
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

    // ─── Lifecycle ───

    // slither-disable-start reentrancy-no-eth,reentrancy-benign
    function createRoom(DuckWekVault.Order calldata order, DuckWekVault.Permit calldata permit)
        external
        onlyOperator
        whenNotPaused
        nonReentrant
        returns (uint256 roomId)
    {
        if (order.kind != uint8(DuckWekVault.Kind.CREATE_ROOM)) revert BadKind();

        if (roomIdOf[order.roomKey] != 0) revert RoomKeyUsed();

        _charge(order, permit);

        roomId = ++nextRoomId;
        roomIdOf[order.roomKey] = roomId;
        keyOf[roomId] = order.roomKey;
        // slither-disable-next-line unused-return
        (, uint64 trackId,,, uint32 layoutVersion) = vault.rooms(order.roomKey);
        rooms[roomId] = Room({
            status: Status.Open,
            trackId: trackId,
            startBlock: 0,
            endBlock: 0,
            players: 1,
            standingRoot: bytes32(0),
            seed: bytes32(0)
        });
        emit RoomCreated(roomId, order.roomKey, order.payer, trackId, layoutVersion, order.amount);
        emit Joined(roomId, order.payer, order.loadout);
    }
    // slither-disable-end reentrancy-no-eth,reentrancy-benign

    // slither-disable-start reentrancy-no-eth,reentrancy-benign
    // slither-disable-start calls-loop
    function joinBatch(uint256 roomId, DuckWekVault.Order[] calldata orders, DuckWekVault.Permit[] calldata permits)
        external
        onlyOperator
        whenNotPaused
        nonReentrant
    {
        Room storage room = rooms[roomId];
        if (room.status != Status.Open) revert WrongStatus(room.status);

        uint256 orderCount = orders.length;
        if (orderCount != permits.length) revert LengthMismatch();

        if (orderCount > MAX_BATCH) revert BatchTooLarge();

        bytes32 roomKey = keyOf[roomId];
        uint16 paid = 0;
        for (uint256 orderIndex; orderIndex < orderCount; ++orderIndex) {
            DuckWekVault.Order calldata order = orders[orderIndex];
            if (order.kind != uint8(DuckWekVault.Kind.JOIN_ROOM) || order.roomKey != roomKey) revert WrongOrder();

            try this.chargeSelf(order, permits[orderIndex]) {
                ++paid;
                emit Joined(roomId, order.payer, order.loadout);
            } catch (bytes memory reason) {
                emit JoinFailed(roomId, order.payer, reason);
            }
        }

        room.players += paid;
    }
    // slither-disable-end reentrancy-no-eth,reentrancy-benign
    // slither-disable-end calls-loop

    function chargeSelf(DuckWekVault.Order calldata order, DuckWekVault.Permit calldata permit) external {
        require(msg.sender == address(this), "only self");
        _charge(order, permit);
    }

    function start(uint256 roomId, uint16 players, bytes32 participantsRoot, bytes32 engineVersion)
        external
        onlyOperator
        whenNotPaused
    {
        Room storage room = rooms[roomId];
        if (room.status != Status.Open) revert WrongStatus(room.status);

        bytes32 seed = keccak256(abi.encode(block.prevrandao, keyOf[roomId], players));
        room.status = Status.Started;
        room.startBlock = uint32(block.number);
        room.players = players;
        room.seed = seed;
        emit Started(roomId, uint32(block.number), players, participantsRoot, seed, engineVersion);
    }

    function tick(uint256 roomId) external onlyOperator whenNotPaused {
        Room storage room = rooms[roomId];
        if (room.status != Status.Started) revert WrongStatus(room.status);

        emit Tick(roomId, uint32(block.number) - room.startBlock);
    }

    // slither-disable-start reentrancy-no-eth,reentrancy-benign
    // slither-disable-start calls-loop
    function finalize(uint256 roomId, bytes32 standingRoot, address[3] calldata podium)
        external
        onlyOperator
        whenNotPaused
        nonReentrant
    {
        Room storage room = rooms[roomId];
        if (room.status != Status.Started) revert WrongStatus(room.status);

        if (
            (podium[0] != address(0) && (podium[0] == podium[1] || podium[0] == podium[2]))
                || (podium[1] != address(0) && podium[1] == podium[2])
        ) revert DuplicatePodium();

        room.status = Status.Finished;
        room.endBlock = uint32(block.number);
        room.standingRoot = standingRoot;

        bytes32 roomKey = keyOf[roomId];
        for (uint8 place; place < 3; ++place) {
            address podiumPlayer = podium[place];
            if (podiumPlayer == address(0)) continue;

            if (!vault.joined(roomKey, podiumPlayer)) revert NotInRoom(podiumPlayer);

            uint8 achievementBit = uint8(1) << place;
            uint8 earnedBits = achieved[podiumPlayer];
            if (earnedBits & achievementBit != 0) continue;

            achieved[podiumPlayer] = earnedBits | achievementBit;
            // slither-disable-next-line unused-return
            badge.award(podiumPlayer, bytes32(roomId), uint64(roomId), uint16(place + 1), room.trackId, _title(place));
            emit AchievementAwarded(roomId, podiumPlayer, place);
        }

        emit Finalized(roomId, standingRoot, uint32(block.number), podium);
    }
    // slither-disable-end reentrancy-no-eth,reentrancy-benign
    // slither-disable-end calls-loop

    function _charge(DuckWekVault.Order calldata order, DuckWekVault.Permit calldata permit) internal {
        // slither-disable-start unused-return
        if (permit.deadline != 0) vault.permitAndSpend(order, permit);
        else vault.spend(order);
        // slither-disable-end unused-return
    }

    function _title(uint8 kind) private pure returns (string memory) {
        if (kind == 0) return TITLE_WINNER;

        if (kind == 1) return TITLE_RUNNER_UP;

        return TITLE_THIRD;
    }
}
