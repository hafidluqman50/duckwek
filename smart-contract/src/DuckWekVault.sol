// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
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
contract DuckWekVault is DuckWekRoles, EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Kind {
        NONE,
        CREATE_ROOM,
        JOIN_ROOM,
        BUY_PART
    }

    /// @dev What the player agrees to. `template` (0 balanced, 1 sprint, 2 tank) is the duck template raced with.
    ///      `salt` lets the same order be made twice (for example two copies of one part).
    struct Order {
        address payer;
        uint8 kind;
        uint256 ref; // CREATE_ROOM: trackId · JOIN_ROOM: 0 · BUY_PART: partTypeId
        bytes32 roomKey; // keccak256(roomCode) for CREATE/JOIN, 0 for parts
        uint8 template;
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

    /// @dev `circuitOwner` is copied from the track at creation so a join does not read the track NFT again.
    struct Room {
        address host;
        uint64 trackId;
        uint64 createdAt;
        uint32 players;
        address circuitOwner;
    }

    bytes32 public constant ORDER_TYPEHASH =
        keccak256("Order(address payer,uint8 kind,uint256 ref,bytes32 roomKey,uint8 template,uint256 amount,uint256 salt)");
    bytes32 public constant WITHDRAWAL_TYPEHASH =
        keccak256("Withdrawal(address owner,address to,uint256 amount,uint256 nonce,uint256 deadline)");

    uint16 public constant BPS = 10_000;
    uint16 public constant TRACK_CREATOR_BPS = 5_000; // circuit rent: 50 / 50 circuit owner / protocol
    uint16 public constant JOIN_CREATOR_BPS = 5_000; // ticket: 50 / 50 circuit owner / protocol
    uint16 public constant PART_CREATOR_BPS = 8_500; // part primary sale: 85 / 15 creator / protocol
    uint32 public constant MAX_PLAYERS = 200;

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

    event RoomCreated(bytes32 indexed roomKey, address indexed host, uint256 indexed trackId, uint256 paid);
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
        usdc = IERC20(usdc_);
        tracks = TrackNFT(tracks_);
        parts = PartNFT(parts_);
        treasury = treasury_;
    }

    // ---------------------------------------------------------------- admin

    function setTreasury(address treasury_) external onlyOwner {
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function setJoinPrice(uint256 price) external onlyOwner {
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
        return keccak256(abi.encode(ORDER_TYPEHASH, o.payer, o.kind, o.ref, o.roomKey, o.template, o.amount, o.salt));
    }

    /// @notice What `payer` must pay for this kind/ref right now.
    function priceOf(uint8 kind, uint256 ref) public view returns (uint256) {
        if (kind == uint8(Kind.CREATE_ROOM)) return tracks.track(ref).rentPrice;
        if (kind == uint8(Kind.JOIN_ROOM)) return joinPrice;
        if (kind == uint8(Kind.BUY_PART)) return parts.partType(ref).price;
        revert BadKind();
    }

    // ---------------------------------------------------------------- operator

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
        try IERC20Permit(address(usdc)).permit(o.payer, address(this), p.value, p.deadline, p.v, p.r, p.s) {} catch {}
        return _spend(o);
    }

    /// @notice Later orders of a session: charged with `transferFrom` under the allowance the permit created.
    function spend(Order calldata o) external onlyOperator whenNotPaused nonReentrant returns (uint256) {
        return _spend(o);
    }

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
        if (o.template > 2) revert BadTemplate();

        if (o.kind == uint8(Kind.CREATE_ROOM)) {
            TrackNFT.Track memory t = tracks.track(o.ref);
            if (!t.active) revert TrackInactive();
            if (rooms[o.roomKey].host != address(0)) revert RoomExists();
            _collect(o.payer, price);
            _split(t.creator, price, TRACK_CREATOR_BPS, o.kind);
            // The host rents the circuit and races: the rent covers the host's own entry.
            rooms[o.roomKey] = Room(o.payer, uint64(o.ref), uint64(block.timestamp), 1, t.creator);
            joined[o.roomKey][o.payer] = true;
            emit RoomCreated(o.roomKey, o.payer, o.ref, price);
        } else if (o.kind == uint8(Kind.JOIN_ROOM)) {
            Room storage r = rooms[o.roomKey];
            if (r.host == address(0)) revert RoomNotFound();
            if (joined[o.roomKey][o.payer]) revert AlreadyJoined();
            if (r.players >= MAX_PLAYERS) revert RoomFull();
            _collect(o.payer, price);
            _split(r.circuitOwner, price, JOIN_CREATOR_BPS, o.kind);
            joined[o.roomKey][o.payer] = true;
            r.players += 1;
            emit RoomJoined(o.roomKey, o.payer, price);
        } else {
            PartNFT.PartType memory pt = parts.partType(o.ref);
            _collect(o.payer, price);
            _split(pt.creator, price, PART_CREATOR_BPS, o.kind);
            result = parts.mintLicense(o.payer, o.ref);
            emit PartPurchased(o.payer, o.ref, result, price);
        }
    }

    /// @dev Pulls exactly `amount` from the payer under the allowance of their permit. On the mock token the first order of a
    ///      wallet also mints the welcome USDC, so a brand-new player can pay it.
    function _collect(address payer, uint256 amount) internal {
        if (welcomeEnabled) IWelcomeToken(address(usdc)).welcomeMint(payer);
        if (amount == 0) return;
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
