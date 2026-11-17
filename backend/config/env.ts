const required = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback

  if (value === undefined || value === '') throw new Error(`Missing env ${key}`)

  return value
}
export const env = {
  port: Number(process.env.PORT || 8080),
  engineVersion: process.env.ENGINE_VERSION || 'duckwek-engine-2',
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(',').map((origin) => origin.trim()),
  jwtSecret: required('JWT_SECRET'),
  chainId: Number(process.env.CHAIN_ID || 10143),
  rpcUrl: required('RPC_URL'),
  explorerUrl: process.env.EXPLORER_URL || 'https://testnet.monadvision.com',
  operatorKey: required('OPERATOR_PRIVATE_KEY'),
  contracts: {
    race: required('RACE'),
    vault: required('VAULT'),
    usdc: required('MOCK_USDC'),
    badge: required('BADGE'),
    parts: required('PART_NFT'),
    tracks: required('TRACK_NFT'),
  },
  usdcName: process.env.USDC_NAME || 'Mock USDC',
  usdcVersion: process.env.USDC_VERSION || '1',
  sessionCap: BigInt(process.env.SESSION_CAP || 5_000_000),
  sessionTtlSec: Number(process.env.SESSION_TTL_SEC || 24 * 3600),
  tickGas: BigInt(process.env.TICK_GAS || 53_100),
  tickIntervalMs: Number(process.env.TICK_INTERVAL_MS || 300),
  joinBatchWindowMs: Number(process.env.JOIN_BATCH_WINDOW_MS || 400),
  joinBatchMax: Number(process.env.JOIN_BATCH_MAX || 100),
  welcomeUsdc: BigInt(process.env.WELCOME_USDC || 5_000_000),
  fillBots: process.env.FILL_BOTS !== 'false',
  countdownSec: Number(process.env.COUNTDOWN_SEC || 3),
}
