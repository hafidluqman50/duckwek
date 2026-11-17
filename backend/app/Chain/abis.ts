import { parseAbi } from 'viem'

// The exact function and event signatures the backend uses. The source of truth is smart-contract/src (plan §5.1);
// test/e2e/abi.check.ts compares these with the exported ABI after every contract change.

const STRUCTS = [
  'struct Loadout { uint8 template; uint16[3] partBySlot; }',
  'struct Order { address payer; uint8 kind; uint256 ref; bytes32 roomKey; Loadout loadout; uint256 amount; uint256 salt; }',
  'struct Permit { uint256 value; uint256 deadline; uint8 v; bytes32 r; bytes32 s; }',
  'struct Withdrawal { address owner; address to; uint256 amount; uint256 nonce; uint256 deadline; }',
] as const

export const raceAbi = parseAbi([
  ...STRUCTS,
  'function createRoom(Order o, Permit p) returns (uint256 id)',
  'function joinBatch(uint256 roomId, Order[] os, Permit[] ps)',
  'function start(uint256 roomId, uint16 players, bytes32 participantsRoot, bytes32 engineVersion)',
  'function tick(uint256 roomId)',
  'function finalize(uint256 roomId, bytes32 standingRoot, address[3] podium)',
  'function isOperator(address) view returns (bool)',
  'function achieved(address) view returns (uint8)',
  'event RoomCreated(uint256 indexed roomId, bytes32 indexed roomKey, address indexed host, uint64 trackId, uint32 layoutVersion, uint256 paid)',
  'event Joined(uint256 indexed roomId, address indexed player, Loadout loadout)',
  'event JoinFailed(uint256 indexed roomId, address indexed player, bytes reason)',
  'event Started(uint256 indexed roomId, uint32 startBlock, uint16 players, bytes32 participantsRoot, bytes32 seed, bytes32 engineVersion)',
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
  'function sessionEnd(address) view returns (uint64)',
  'function sessionCap(address) view returns (uint256)',
  'function sessionSpent(address) view returns (uint256)',
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
  'error SessionExpired()',
  'error SessionCapExceeded(uint256 cap, uint256 wouldSpend)',
  'error TooManyParts()',
  'error BadPart(uint256 slot, uint16 typeId)',
  'error NoLicense(uint256 slot, uint16 typeId)',
  'error PriceOutOfRange()',
])

export const usdcAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function nonces(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function welcomed(address) view returns (bool)',
])

export const badgeAbi = parseAbi(['function ownerOf(uint256) view returns (address)'])

// Catalog reads (plan 0013 DoD 6): part types, stats and circuit layouts come from the chain, never from hardcoded seeds.
export const partNftAbi = parseAbi([
  'struct PartType { string name; address creator; uint96 price; uint8 slot; uint24 color; bool platform; bool active; }',
  'function typeCount() view returns (uint256)',
  'function statCount() view returns (uint256)',
  'function statKeys(uint256) view returns (bytes32)',
  'function partType(uint256 typeId) view returns (PartType)',
  'function statOf(uint256 typeId, bytes32 key) view returns (int8)',
])

export const trackNftAbi = parseAbi([
  'struct Track { string name; address creator; uint96 rent; bool platform; bool active; uint32 version; uint8 editsUsed; }',
  'function nextId() view returns (uint256)',
  'function track(uint256 id) view returns (Track)',
  'function rentOf(uint256 id) view returns (uint96)',
  'function ownerOf(uint256 id) view returns (address)',
  'function layoutOf(uint256 id, uint32 v) view returns (bytes segments, uint16 laps)',
])
