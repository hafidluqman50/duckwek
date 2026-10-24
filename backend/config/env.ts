const required = (key: string, fallback?: string): string => {
  const v = process.env[key] ?? fallback
  if (v === undefined || v === '') throw new Error(`Missing env ${key}`)
  return v
}

// The public Monad RPC is intentionally NOT a default: it is slow and clumps transactions. Set RPC_URL to a dedicated
// endpoint (Alchemy). There is no mock mode: a missing key or contract address stops the server at boot.
export const env = {
  port: Number(process.env.PORT || 8080),
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(',').map((s) => s.trim()),
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
    duck: process.env.DUCK_NFT || '',
  },
  // EIP-712 domain of the payment token (ERC20Permit). Circle USDC: name "USD Coin", version "2".
  usdcName: process.env.USDC_NAME || 'Mock USDC',
  usdcVersion: process.env.USDC_VERSION || '1',
  // The one signature at connect (plan §3.2): spending cap and lifetime of the session.
  sessionCap: BigInt(process.env.SESSION_CAP || 5_000_000), // 5 USDC
  sessionTtlSec: Number(process.env.SESSION_TTL_SEC || 24 * 3600),
  // Fixed gas limit of a tick (plan Q-11). Monad charges the limit, so it is the highest measured tick gas plus 10 % (test T-3).
  tickGas: BigInt(process.env.TICK_GAS || 53_100),
  tickIntervalMs: Number(process.env.TICK_INTERVAL_MS || 300),
  joinBatchWindowMs: Number(process.env.JOIN_BATCH_WINDOW_MS || 400),
  joinBatchMax: Number(process.env.JOIN_BATCH_MAX || 100), // DuckWekRace.MAX_BATCH
  // Minted by the Vault inside a wallet's first paid order (mock token only; equals MockUSDC.WELCOME_AMOUNT).
  welcomeUsdc: BigInt(process.env.WELCOME_USDC || 5_000_000),
  fillBots: process.env.FILL_BOTS !== 'false',
  countdownSec: Number(process.env.COUNTDOWN_SEC || 3),
}
