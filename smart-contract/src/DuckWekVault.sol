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

/// @dev Mock token only: mints the welcome USDC once per wallet. Disabled (`welcomeEnabled = false`) with real USDC.
interface IWelcomeToken {
    function welcomeMint(address to) external returns (bool);
}

/// @title DuckWek Vault: every USDC payment, every split, every payout.
/// @notice FINANCE.md rules enforced here:
///   - Money comes in only as payment for an asset or service (room = circuit rent, join = ticket, part = license).
///   - Nothing flows from losers to winners. There is no prize pool and no stake.
///   - Every receiver is credited to `available` and withdraws it themselves (pull payout).
///   - ONE signature, at connect: the player signs an EIP-2612 permit (spender = this Vault, a cap, an expiry). The
///     operator (the relayer, or DuckWekRace acting as operator) submits it with the first order and pays gas; after that
///     every order is charged with `transferFrom` under that allowance. The operator can only charge the on-chain price,
///     only to the fixed receivers below, up to the cap and until the expiry; nothing leaves the Vault except by the
///     receivers' own `withdraw`.
///   - One rule for every circuit and every part: it has an owner, and a payment is split owner / protocol.
///     The platform circuits and parts are owned by the protocol address, so the same rule credits the protocol alone.
///     Circuit income goes to `ownerOf(trackId)` at the moment of each order (plan 0013, F7).
///   - v2 session (plan 0013 §4.2): a permit opens a session with an end time and a cap. After the end, or past the cap, the
///     operator cannot charge that payer, so leftover allowance is dead.
///   - v2 loadout (plan 0013 §4.3): JOIN and CREATE orders carry the loadout; every equipped part needs a licence in the
///     payer's wallet, in the right slot, and at most `MAX_EQUIPPED` parts are equipped.
contract DuckWekVault is DuckWekRoles, EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Kind {
        NONE,
        CREATE_ROOM,
        JOIN_ROOM,
        BUY_PART
    }

    /// @dev The duck a player races with: the template (0 balanced, 1 sprint, 2 tank) and the part per slot
    ///      (slot 0 Wings, 1 Tail, 2 Bill; `NO_PART` = empty).
    struct Loadout {
        uint8 template;
        uint16[3] partBySlot;
    }

    /// @dev What the player agrees to. `salt` separates otherwise identical orders (replay guard).
    struct Order {
        address payer;
        uint8 kind;
        uint256 ref; // CREATE_ROOM: trackId · JOIN_ROOM: 0 · BUY_PART: partTypeId
        bytes32 roomKey; // keccak256(roomCode) for CREATE/JOIN, 0 for parts
        Loadout loadout; // ignored for BUY_PART
        uint256 amount; // must equal the on-chain price
        uint256 salt;
    }

    /// @dev The player's EIP-2612 permit (owner = payer, spender = this Vault). `deadline == 0` means "no permit".
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

    /// @dev `layoutVersion` is the circuit layout the room was created on; the race always uses that version.
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
    uint16 public constant TRACK_CREATOR_BPS = 5_000; // circuit rent: 50 / 50 circuit owner / protocol
    uint16 public constant JOIN_CREATOR_BPS = 5_000; // ticket: 50 / 50 circuit owner / protocol
    uint16 public constant PART_CREATOR_BPS = 8_500; // part primary sale: 85 / 15 creator / protocol
    uint32 public constant MAX_PLAYERS = 200;
    uint16 public constant NO_PART = type(uint16).max;
    uint8 public constant MAX_EQUIPPED = 1; // D6: one part at a time. Stacking later = a Vault redeploy (plan 0013 Q2).
    uint256 public constant MIN_JOIN_PRICE = 10_000; // 0.01 USDC
    uint256 public constant MAX_JOIN_PRICE = 1_000_000; // 1 USDC

    IERC20 public immutable usdc;
    TrackNFT public immutable tracks;
    PartNFT public immutable parts;
    address public treasury;
    uint256 public joinPrice = 100_000; // 0.1 USDC
    bool public welcomeEnabled; // mock USDC only

    mapping(address => uint256) public available;
    mapping(address => mapping(uint256 => bool)) public usedNonce; // withdrawals only
    mapping(bytes32 => bool) public usedOrder; // an order is charged at most once
    mapping(bytes32 => Room) public rooms;
    mapping(bytes32 => mapping(address => bool)) public joined;
    /// @notice Session of each payer, opened by the permit: charges are valid until `sessionEnd` and up to `sessionCap`.
    mapping(address => uint64) public sessionEnd;
    mapping(address => uint256) public sessionCap;
    mapping(address => uint256) public sessionSpent;

    event RoomCreated(bytes32 indexed roomKey, address indexed host, uint256 indexed trackId, uint256 paid, uint32 layoutVersion);
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
        if (usdc_ == address(0) || tracks_ == address(0) || parts_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
        tracks = TrackNFT(tracks_);
        parts = PartNFT(parts_);
        treasury = treasury_;
    }

    // ---------------------------------------------------------------- admin

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

    /// @notice Mock USDC only. Turn it off with real USDC (it has no `welcomeMint`).
    function setWelcomeEnabled(bool enabled) external onlyOwner {
        welcomeEnabled = enabled;
        emit WelcomeEnabledSet(enabled);
    }

    // ---------------------------------------------------------------- views

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /// @notice The hash that makes an order single-use.
    function orderHash(Order calldata o) public pure returns (bytes32) {
        return keccak256(abi.encode(ORDER_TYPEHASH, o.payer, o.kind, o.ref, o.roomKey, loadoutHash(o.loadout), o.amount, o.salt));
    }

    /// @notice EIP-712 `hashStruct(Loadout)`: a fixed array hashes as keccak256 of its 32-byte padded elements.
    function loadoutHash(Loadout calldata l) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                LOADOUT_TYPEHASH, l.template, keccak256(abi.encodePacked(uint256(l.partBySlot[0]), uint256(l.partBySlot[1]), uint256(l.partBySlot[2])))
            )
        );
    }

    /// @notice What `payer` must pay for this kind/ref right now.
    function priceOf(uint8 kind, uint256 ref) public view returns (uint256) {
        if (kind == uint8(Kind.CREATE_ROOM)) return tracks.rentOf(ref);
        if (kind == uint8(Kind.JOIN_ROOM)) return joinPrice;
        if (kind == uint8(Kind.BUY_PART)) return parts.partType(ref).price;
        revert BadKind();
    }

    // ---------------------------------------------------------------- operator

    // slither-disable-start reentrancy-no-eth,reentrancy-benign -- guarded by nonReentrant, operator only; the only external call is the payment token permit
    /// @notice First order of a session: apply the player's permit, then charge. A permit that cannot be applied (already
    ///         used by someone else, expired) does not block the order: the allowance may already be there, and if it is
    ///         not, the transfer reverts.
    function permitAndSpend(Order calldata o, Permit calldata p)
        external
        onlyOperator
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        try IERC20Permit(address(usdc)).permit(o.payer, address(this), p.value, p.deadline, p.v, p.r, p.s) {
            // A permit that was applied opens a fresh session. A permit that could not be applied (already used, expired)
            // leaves the current session as it is: replaying an old permit cannot extend or reset anything.
            sessionEnd[o.payer] = uint64(p.deadline);
            sessionCap[o.payer] = p.value;
            sessionSpent[o.payer] = 0;
            emit SessionOpened(o.payer, uint64(p.deadline), p.value);
        } catch {
            _adoptConsumedPermit(o.payer, p);
        }
        return _spend(o);
    }
    // slither-disable-end reentrancy-no-eth,reentrancy-benign

    // slither-disable-start timestamp -- deadlines and the session end are compared with block.timestamp on purpose
    /// @dev Someone submitted the player's permit first (front-run), so applying it here reverted. If the permit really was
    ///      signed by the payer for this Vault and is the one that was just consumed (nonce - 1), it opened the allowance,
    ///      so it opens the session. A session already opened with the same value and deadline is never reset.
    function _adoptConsumedPermit(address payer, Permit calldata p) internal {
        if (p.deadline < block.timestamp || p.deadline > type(uint64).max) return;
        if (sessionEnd[payer] == p.deadline && sessionCap[payer] == p.value) return;
        IERC20Permit token = IERC20Permit(address(usdc));
        uint256 nonce = token.nonces(payer);
        if (nonce == 0) return;
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01", token.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(PERMIT_TYPEHASH, payer, address(this), p.value, nonce - 1, p.deadline))
            )
        );
        // slither-disable-next-line unused-return
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, p.v, p.r, p.s); // the third value is the error argument
        if (err != ECDSA.RecoverError.NoError || signer != payer) return;
        sessionEnd[payer] = uint64(p.deadline);
        sessionCap[payer] = p.value;
        sessionSpent[payer] = 0;
        emit SessionOpened(payer, uint64(p.deadline), p.value);
    }
    // slither-disable-end timestamp

    /// @notice Later orders of a session: charged with `transferFrom` under the allowance the permit created.
    function spend(Order calldata o) external onlyOperator whenNotPaused nonReentrant returns (uint256) {
        return _spend(o);
    }

    // slither-disable-start timestamp -- deadlines and the session end are compared with block.timestamp on purpose
    /// @notice Gasless withdraw: the owner signs, the operator submits. Funds only ever go to `w.to`
    ///         chosen by the owner, so the operator cannot redirect them.
    function withdrawWithSig(Withdrawal calldata w, bytes calldata sig) external onlyOperator nonReentrant {
        if (block.timestamp > w.deadline) revert Expired();
        if (usedNonce[w.owner][w.nonce]) revert NonceUsed();
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(WITHDRAWAL_TYPEHASH, w.owner, w.to, w.amount, w.nonce, w.deadline))
        );
        if (!SignatureChecker.isValidSignatureNow(w.owner, digest, sig)) revert BadSignature();
        usedNonce[w.owner][w.nonce] = true;
        _withdraw(w.owner, w.to, w.amount);
    }
    // slither-disable-end timestamp

    // ---------------------------------------------------------------- user

    function withdraw(uint256 amount) external nonReentrant {
        _withdraw(msg.sender, msg.sender, amount);
    }

    // ---------------------------------------------------------------- internal

    function _spend(Order calldata o) internal returns (uint256 result) {
        bytes32 h = orderHash(o);
        if (usedOrder[h]) revert OrderUsed();
        usedOrder[h] = true;
        uint256 price = priceOf(o.kind, o.ref);
        if (o.amount != price) revert WrongAmount(price, o.amount);
        _checkSession(o.payer, price);

        // Checks, then effects, then the token transfer last (the order reverts as a whole if the transfer fails).
        if (o.kind == uint8(Kind.CREATE_ROOM)) {
            if (!tracks.track(o.ref).active) revert TrackInactive();
            if (rooms[o.roomKey].host != address(0)) revert RoomExists();
            _checkLoadout(o.payer, o.loadout);
            _split(tracks.ownerOf(o.ref), price, TRACK_CREATOR_BPS, o.kind);
            // The host rents the circuit and races: the rent covers the host's own entry.
            uint32 lv = tracks.versionOf(o.ref);
            rooms[o.roomKey] = Room(o.payer, uint64(o.ref), uint64(block.timestamp), 1, lv);
            joined[o.roomKey][o.payer] = true;
            _collect(o.payer, price);
            emit RoomCreated(o.roomKey, o.payer, o.ref, price, lv);
        } else if (o.kind == uint8(Kind.JOIN_ROOM)) {
            Room storage r = rooms[o.roomKey];
            if (r.host == address(0)) revert RoomNotFound();
            if (joined[o.roomKey][o.payer]) revert AlreadyJoined();
            if (r.players >= MAX_PLAYERS) revert RoomFull();
            _checkLoadout(o.payer, o.loadout);
            _split(tracks.ownerOf(r.trackId), price, JOIN_CREATOR_BPS, o.kind);
            joined[o.roomKey][o.payer] = true;
            r.players += 1;
            _collect(o.payer, price);
            emit RoomJoined(o.roomKey, o.payer, price);
        } else {
            PartNFT.PartType memory pt = parts.partType(o.ref);
            _split(pt.creator, price, PART_CREATOR_BPS, o.kind);
            _collect(o.payer, price);
            result = parts.mintLicense(o.payer, o.ref);
            emit PartPurchased(o.payer, o.ref, result, price);
        }
    }

    // slither-disable-start timestamp -- deadlines and the session end are compared with block.timestamp on purpose
    /// @dev The charge must fall inside the payer's session: not after its end, not above its cap.
    function _checkSession(address payer, uint256 price) internal {
        if (block.timestamp > sessionEnd[payer]) revert SessionExpired();
        uint256 spent = sessionSpent[payer] + price;
        if (spent > sessionCap[payer]) revert SessionCapExceeded(sessionCap[payer], spent);
        sessionSpent[payer] = spent;
    }
    // slither-disable-end timestamp

    // slither-disable-start calls-loop -- at most 3 slots, one part allowed (MAX_EQUIPPED), trusted PartNFT
    /// @dev Template is 0..2, at most MAX_EQUIPPED slots are filled, each filled slot holds a part of that slot that the
    ///      payer has a licence for. `NO_PART` marks an empty slot.
    function _checkLoadout(address payer, Loadout calldata l) internal view {
        if (l.template > 2) revert BadTemplate();
        uint256 equipped = 0;
        for (uint256 slot; slot < 3; ++slot) {
            uint16 typeId = l.partBySlot[slot];
            if (typeId == NO_PART) continue;
            if (++equipped > MAX_EQUIPPED) revert TooManyParts();
            if (typeId >= parts.typeCount() || parts.partType(typeId).slot != slot) revert BadPart(slot, typeId);
            if (parts.licenseOf(payer, typeId) == 0) revert NoLicense(slot, typeId);
        }
    }
    // slither-disable-end calls-loop

    /// @dev Pulls exactly `amount` from the payer under the allowance of their permit. On the mock token the first order of a
    ///      wallet also mints the welcome USDC, so a brand-new player can pay it.
    function _collect(address payer, uint256 amount) internal {
        // slither-disable-next-line unused-return
        if (welcomeEnabled) IWelcomeToken(address(usdc)).welcomeMint(payer); // false when already welcomed: not an error
        if (amount == 0) return;
        // `payer` is the order's payer, chosen by the operator by design (one signature at connect, plan 0013 D7). What the operator can
        // charge is bounded by the payer's own permit (allowance), and by the session end and cap enforced in `_checkSession`.
        // slither-disable-next-line arbitrary-send-erc20
        usdc.safeTransferFrom(payer, address(this), amount);
    }

    /// @dev One rule: `owner_` gets `ownerBps` of the price, the protocol the rest. When the owner is the protocol
    ///      address (the platform circuits and parts) it is one credit.
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
