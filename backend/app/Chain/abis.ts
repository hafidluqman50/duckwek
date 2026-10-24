import { parseAbi } from 'viem'

// The exact function and event signatures the backend uses. The source of truth is smart-contract/src (plan §5.1);
// test/e2e/abi.check.ts compares these with the exported ABI after every contract change.

const STRUCTS = [
  'struct Order { address payer; uint8 kind; uint256 ref; bytes32 roomKey; uint8 template; uint256 amount; uint256 salt; }',
  'struct Permit { uint256 value; uint256 deadline; uint8 v; bytes32 r; bytes32 s; }',
  'struct Withdrawal { address owner; address to; uint256 amount; uint256 nonce; uint256 deadline; }',
] as const

export const raceAbi = parseAbi([
  ...STRUCTS,
  'function createRoom(Order o, Permit p) returns (uint256 id)',
  'function joinBatch(uint256 roomId, Order[] os, Permit[] ps)',
  'function start(uint256 roomId, uint16 players, bytes32 participantsRoot)',
  'function tick(uint256 roomId)',
  'function finalize(uint256 roomId, bytes32 standingRoot, address[3] podium)',
  'function isOperator(address) view returns (bool)',
  'function achieved(address) view returns (uint8)',
  'event RoomCreated(uint256 indexed roomId, bytes32 indexed roomKey, address indexed host, uint8 trackId, uint256 paid)',
  'event Joined(uint256 indexed roomId, address indexed player, uint8 template)',
  'event JoinFailed(uint256 indexed roomId, address indexed player, bytes reason)',
  'event Started(uint256 indexed roomId, uint32 startBlock, uint16 players, bytes32 participantsRoot, bytes32 seed)',
  'event Tick(uint256 indexed roomId, uint32 n)',
  'event Finalized(uint256 indexed roomId, bytes32 standingRoot, uint32 endBlock, address[3] podium)',
  'event AchievementAwarded(uint256 indexed roomId, address indexed player, uint8 kind)',
])

export const vaultAbi = parseAbi([
  ...STRUCTS,
  'function permitAndSpend(Order o, Permit p) returns (uint256)',
  'function spend(Order o) returns (uint256)',
  'function withdrawWithSig(Withdrawal w, bytes sig)',
  'function available(address) view returns (uint256)',
  'function welcomeEnabled() view returns (bool)',
  'function priceOf(uint8 kind, uint256 ref) view returns (uint256)',
  'event PartPurchased(address indexed buyer, uint256 indexed typeId, uint256 tokenId, uint256 paid)',
  'event Withdrawn(address indexed owner, address indexed to, uint256 amount)',
  'error Expired()',
  'error NonceUsed()',
  'error BadSignature()',
  'error WrongAmount(uint256 expected, uint256 got)',
  'error BadKind()',
  'error BadTemplate()',
  'error TrackInactive()',
  'error RoomExists()',
  'error RoomNotFound()',
  'error RoomFull()',
  'error AlreadyJoined()',
  'error OrderUsed()',
  'error Insufficient()',
])

export const usdcAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function nonces(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function welcomed(address) view returns (bool)',
])

export const badgeAbi = parseAbi(['function ownerOf(uint256) view returns (address)'])

export const duckAbi = parseAbi([
  'struct Duck { string name; uint8 template; uint24 bodyColor; uint24 billColor; uint8 cosmetics; }',
  'function hatch(address to, Duck d) returns (uint256 id)',
  'event DuckHatched(address indexed builder, uint256 indexed tokenId)',
])
