// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {DuckWekRoles} from "./DuckWekRoles.sol";
import {TrackNFT} from "./TrackNFT.sol";
import {PartNFT} from "./PartNFT.sol";

interface IWelcomeToken {
    function welcomeMint(address to) external returns (bool);
}

contract DuckWekVault is DuckWekRoles, EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Kind {
        NONE,
        CREATE_ROOM,
        JOIN_ROOM,
        BUY_PART
    }

    struct Loadout {
        uint8 template;
        uint16[3] partBySlot;
    }

    struct Order {
        address payer;
        uint8 kind;
        uint256 ref;
        bytes32 roomKey;
        Loadout loadout;
        uint256 amount;
        uint256 salt;
    }

    struct Permit {
        uint256 value;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct Withdrawal {
        address owner;
        address to;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
    }

    struct Room {
        address host;
        uint64 trackId;
        uint64 createdAt;
        uint32 players;
        uint32 layoutVersion;
    }

    bytes32 public constant LOADOUT_TYPEHASH = keccak256("Loadout(uint8 template,uint16[3] partBySlot)");
    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order(address payer,uint8 kind,uint256 ref,bytes32 roomKey,Loadout loadout,uint256 amount,uint256 salt)Loadout(uint8 template,uint16[3] partBySlot)"
    );
    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 public constant WITHDRAWAL_TYPEHASH =
        keccak256("Withdrawal(address owner,address to,uint256 amount,uint256 nonce,uint256 deadline)");

    uint16 public constant BPS = 10_000;
    uint16 public constant TRACK_CREATOR_BPS = 5_000;
    uint16 public constant JOIN_CREATOR_BPS = 5_000;
    uint16 public constant PART_CREATOR_BPS = 8_500;
    uint32 public constant MAX_PLAYERS = 200;
    uint16 public constant NO_PART = type(uint16).max;
    uint8 public constant MAX_EQUIPPED = 1;
    uint256 public constant MIN_JOIN_PRICE = 10_000;
    uint256 public constant MAX_JOIN_PRICE = 1_000_000;

    IERC20 public immutable usdc;
    TrackNFT public immutable tracks;
    PartNFT public immutable parts;
    address public treasury;
    uint256 public joinPrice = 100_000;
    bool public welcomeEnabled;

    mapping(address => uint256) public available;
    mapping(address => mapping(uint256 => bool)) public usedNonce;
    mapping(bytes32 => bool) public usedOrder;
    mapping(bytes32 => Room) public rooms;
    mapping(bytes32 => mapping(address => bool)) public joined;
    mapping(address => uint64) public sessionEnd;
    mapping(address => uint256) public sessionCap;
    mapping(address => uint256) public sessionSpent;

    event RoomCreated(
        bytes32 indexed roomKey, address indexed host, uint256 indexed trackId, uint256 paid, uint32 layoutVersion
    );
    event SessionOpened(address indexed payer, uint64 end, uint256 cap);
    event RoomJoined(bytes32 indexed roomKey, address indexed player, uint256 paid);
    event PartPurchased(address indexed buyer, uint256 indexed typeId, uint256 tokenId, uint256 paid);
    event Credited(address indexed to, uint256 amount, uint8 indexed kind);
    event Withdrawn(address indexed owner, address indexed to, uint256 amount);
    event TreasurySet(address treasury);
    event JoinPriceSet(uint256 price);
    event WelcomeEnabledSet(bool enabled);

    error Expired();
    error NonceUsed();
    error BadSignature();
    error WrongAmount(uint256 expected, uint256 got);
    error BadKind();
    error BadTemplate();
    error SessionExpired();
    error SessionCapExceeded(uint256 cap, uint256 wouldSpend);
    error TooManyParts();
    error BadPart(uint256 slot, uint16 typeId);
    error NoLicense(uint256 slot, uint16 typeId);
    error PriceOutOfRange();
    error ZeroAddress();
    error TrackInactive();
    error RoomExists();
    error RoomNotFound();
    error RoomFull();
    error AlreadyJoined();
    error OrderUsed();
    error Insufficient();

    constructor(address owner_, address usdc_, address tracks_, address parts_, address treasury_)
        DuckWekRoles(owner_)
        EIP712("DuckWekVault", "1")
    {
        if (usdc_ == address(0) || tracks_ == address(0) || parts_ == address(0) || treasury_ == address(0)) {
            revert ZeroAddress();
        }

        usdc = IERC20(usdc_);
        tracks = TrackNFT(tracks_);
        parts = PartNFT(parts_);
        treasury = treasury_;
    }

    // ─── Admin ───

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();

        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function setJoinPrice(uint256 price) external onlyOwner {
        if (price < MIN_JOIN_PRICE || price > MAX_JOIN_PRICE) revert PriceOutOfRange();

        joinPrice = price;
        emit JoinPriceSet(price);
    }

    function setWelcomeEnabled(bool enabled) external onlyOwner {
        welcomeEnabled = enabled;
        emit WelcomeEnabledSet(enabled);
    }

    // ─── Views ───

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function orderHash(Order calldata order) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                ORDER_TYPEHASH,
                order.payer,
                order.kind,
                order.ref,
                order.roomKey,
                loadoutHash(order.loadout),
                order.amount,
                order.salt
            )
        );
    }

    function loadoutHash(Loadout calldata loadout) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                LOADOUT_TYPEHASH,
                loadout.template,
                keccak256(
                    abi.encodePacked(
                        uint256(loadout.partBySlot[0]), uint256(loadout.partBySlot[1]), uint256(loadout.partBySlot[2])
                    )
                )
            )
        );
    }

    function priceOf(uint8 kind, uint256 referenceId) public view returns (uint256) {
        if (kind == uint8(Kind.CREATE_ROOM)) return tracks.rentOf(referenceId);

        if (kind == uint8(Kind.JOIN_ROOM)) return joinPrice;

        if (kind == uint8(Kind.BUY_PART)) return parts.partType(referenceId).price;

        revert BadKind();
    }

    // ─── Operator ───

    // slither-disable-start reentrancy-no-eth,reentrancy-benign
    function permitAndSpend(Order calldata order, Permit calldata permit)
        external
        onlyOperator
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        try IERC20Permit(address(usdc)).permit(
            order.payer, address(this), permit.value, permit.deadline, permit.v, permit.r, permit.s
        ) {
            sessionEnd[order.payer] = uint64(permit.deadline);
            sessionCap[order.payer] = permit.value;
            sessionSpent[order.payer] = 0;
            emit SessionOpened(order.payer, uint64(permit.deadline), permit.value);
        } catch {
            _adoptConsumedPermit(order.payer, permit);
        }

        return _spend(order);
    }
    // slither-disable-end reentrancy-no-eth,reentrancy-benign

    // slither-disable-start timestamp
    function _adoptConsumedPermit(address payer, Permit calldata permit) internal {
        if (permit.deadline < block.timestamp || permit.deadline > type(uint64).max) return;

        if (sessionEnd[payer] == permit.deadline && sessionCap[payer] == permit.value) return;

        IERC20Permit token = IERC20Permit(address(usdc));
        uint256 currentNonce = token.nonces(payer);
        if (currentNonce == 0) return;

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                token.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(PERMIT_TYPEHASH, payer, address(this), permit.value, currentNonce - 1, permit.deadline)
                )
            )
        );
        // slither-disable-next-line unused-return
        (address signer, ECDSA.RecoverError recoverError,) = ECDSA.tryRecover(digest, permit.v, permit.r, permit.s);
        if (recoverError != ECDSA.RecoverError.NoError || signer != payer) return;

        sessionEnd[payer] = uint64(permit.deadline);
        sessionCap[payer] = permit.value;
        sessionSpent[payer] = 0;
        emit SessionOpened(payer, uint64(permit.deadline), permit.value);
    }
    // slither-disable-end timestamp

    function spend(Order calldata order) external onlyOperator whenNotPaused nonReentrant returns (uint256) {
        return _spend(order);
    }

    // slither-disable-start timestamp
    function withdrawWithSig(Withdrawal calldata withdrawal, bytes calldata signature)
        external
        onlyOperator
        nonReentrant
    {
        if (block.timestamp > withdrawal.deadline) revert Expired();

        if (usedNonce[withdrawal.owner][withdrawal.nonce]) revert NonceUsed();

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    WITHDRAWAL_TYPEHASH,
                    withdrawal.owner,
                    withdrawal.to,
                    withdrawal.amount,
                    withdrawal.nonce,
                    withdrawal.deadline
                )
            )
        );
        if (!SignatureChecker.isValidSignatureNow(withdrawal.owner, digest, signature)) revert BadSignature();

        usedNonce[withdrawal.owner][withdrawal.nonce] = true;
        _withdraw(withdrawal.owner, withdrawal.to, withdrawal.amount);
    }
    // slither-disable-end timestamp

    // ─── User ───

    function withdraw(uint256 amount) external nonReentrant {
        _withdraw(msg.sender, msg.sender, amount);
    }

    // ─── Internal ───

    function _spend(Order calldata order) internal returns (uint256 result) {
        bytes32 orderDigest = orderHash(order);
        if (usedOrder[orderDigest]) revert OrderUsed();

        usedOrder[orderDigest] = true;
        uint256 price = priceOf(order.kind, order.ref);
        if (order.amount != price) revert WrongAmount(price, order.amount);

        _checkSession(order.payer, price);

        if (order.kind == uint8(Kind.CREATE_ROOM)) {
            if (!tracks.track(order.ref).active) revert TrackInactive();

            if (rooms[order.roomKey].host != address(0)) revert RoomExists();

            _checkLoadout(order.payer, order.loadout);
            _split(tracks.ownerOf(order.ref), price, TRACK_CREATOR_BPS, order.kind);
            uint32 layoutVersion = tracks.versionOf(order.ref);
            rooms[order.roomKey] = Room(order.payer, uint64(order.ref), uint64(block.timestamp), 1, layoutVersion);
            joined[order.roomKey][order.payer] = true;
            _collect(order.payer, price);
            emit RoomCreated(order.roomKey, order.payer, order.ref, price, layoutVersion);
        } else if (order.kind == uint8(Kind.JOIN_ROOM)) {
            Room storage room = rooms[order.roomKey];
            if (room.host == address(0)) revert RoomNotFound();

            if (joined[order.roomKey][order.payer]) revert AlreadyJoined();

            if (room.players >= MAX_PLAYERS) revert RoomFull();

            _checkLoadout(order.payer, order.loadout);
            _split(tracks.ownerOf(room.trackId), price, JOIN_CREATOR_BPS, order.kind);
            joined[order.roomKey][order.payer] = true;
            room.players += 1;
            _collect(order.payer, price);
            emit RoomJoined(order.roomKey, order.payer, price);
        } else {
            PartNFT.PartType memory partType = parts.partType(order.ref);
            _split(partType.creator, price, PART_CREATOR_BPS, order.kind);
            _collect(order.payer, price);
            result = parts.mintLicense(order.payer, order.ref);
            emit PartPurchased(order.payer, order.ref, result, price);
        }
    }

    // slither-disable-start timestamp
    function _checkSession(address payer, uint256 price) internal {
        if (block.timestamp > sessionEnd[payer]) revert SessionExpired();

        uint256 spent = sessionSpent[payer] + price;
        if (spent > sessionCap[payer]) revert SessionCapExceeded(sessionCap[payer], spent);

        sessionSpent[payer] = spent;
    }
    // slither-disable-end timestamp

    // slither-disable-start calls-loop
    function _checkLoadout(address payer, Loadout calldata loadout) internal view {
        if (loadout.template > 2) revert BadTemplate();

        uint256 equipped = 0;
        for (uint256 slot; slot < 3; ++slot) {
            uint16 typeId = loadout.partBySlot[slot];
            if (typeId == NO_PART) continue;

            if (++equipped > MAX_EQUIPPED) revert TooManyParts();

            if (typeId >= parts.typeCount() || parts.partType(typeId).slot != slot) revert BadPart(slot, typeId);

            if (parts.licenseOf(payer, typeId) == 0) revert NoLicense(slot, typeId);
        }
    }
    // slither-disable-end calls-loop

    function _collect(address payer, uint256 amount) internal {
        // slither-disable-next-line unused-return
        if (welcomeEnabled) IWelcomeToken(address(usdc)).welcomeMint(payer);

        if (amount == 0) return;

        // slither-disable-next-line arbitrary-send-erc20
        usdc.safeTransferFrom(payer, address(this), amount);
    }

    function _split(address owner_, uint256 price, uint16 ownerBps, uint8 kind) internal {
        if (owner_ == treasury) return _credit(treasury, price, kind);

        uint256 toOwner = (price * ownerBps) / BPS;
        _credit(owner_, toOwner, kind);
        _credit(treasury, price - toOwner, kind);
    }

    function _credit(address to, uint256 amount, uint8 kind) internal {
        if (amount == 0) return;

        available[to] += amount;
        emit Credited(to, amount, kind);
    }

    function _withdraw(address owner_, address to, uint256 amount) internal {
        if (available[owner_] < amount) revert Insufficient();

        available[owner_] -= amount;
        usdc.safeTransfer(to, amount);
        emit Withdrawn(owner_, to, amount);
    }
}
