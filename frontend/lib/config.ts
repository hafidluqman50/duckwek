export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 10143)
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz'
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://testnet.monadvision.com'
export const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'duckwek-dev'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''

export const explorerTransactionUrl = (hash?: string | null) => (hash ? `${EXPLORER_URL.replace(/\/$/, '')}/tx/${hash}` : '#')
export const formatUsdc = (value: string | number | bigint | null | undefined) => (Number(value || 0) / 1e6).toFixed(2)
export interface SessionTerms {
  limit: bigint
  duration: number
}

export const USDC_UNIT = BigInt(1_000_000)
export const SESSION_LIMIT_MINIMUM = BigInt(1) * USDC_UNIT
export const SESSION_LIMIT_MAXIMUM = BigInt(100_000) * USDC_UNIT
export const SESSION_DURATION_MINIMUM_SECONDS = 3600
export const SESSION_DURATION_MAXIMUM_SECONDS = 2 * 24 * 3600
export const DEFAULT_SESSION_TERMS: SessionTerms = { limit: BigInt(5) * USDC_UNIT, duration: 24 * 3600 }
export const LIMIT_PRESETS = [5, 10, 25, 50].map((amount) => BigInt(amount) * USDC_UNIT)
export const DURATION_PRESETS: { seconds: number; label: string }[] = [{ seconds: 3600, label: '1 h' }, { seconds: 24 * 3600, label: '24 h' }, { seconds: 2 * 24 * 3600, label: '2 d' }]

export const isValidSessionTerms = (terms: SessionTerms) =>
  terms.limit >= SESSION_LIMIT_MINIMUM && terms.limit <= SESSION_LIMIT_MAXIMUM && terms.duration >= SESSION_DURATION_MINIMUM_SECONDS && terms.duration <= SESSION_DURATION_MAXIMUM_SECONDS

export const parseUsdcAmount = (text: string): bigint | null => {
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(text.trim())

  if (!match) return null

  return BigInt(match[1]) * USDC_UNIT + BigInt((match[2] ?? '').padEnd(6, '0') || '0')
}

export const formatDuration = (seconds: number) => {
  if (seconds >= 2 * 24 * 3600) return `${Math.round(seconds / 86400)} days`

  if (seconds >= 3600) return `${Math.floor(seconds / 3600)} h`

  return `${Math.max(1, Math.floor(seconds / 60))} min`
}

export const shortenAddress = (address?: string | null) => (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '')

export const CONTRACTS: { name: string; address: string }[] = [
  { name: 'DuckWekRace', address: process.env.NEXT_PUBLIC_RACE_ADDRESS || '' },
  { name: 'DuckWekVault', address: process.env.NEXT_PUBLIC_VAULT_ADDRESS || '' },
  { name: 'PartNFT', address: process.env.NEXT_PUBLIC_PART_ADDRESS || '' },
  { name: 'TrackNFT', address: process.env.NEXT_PUBLIC_TRACK_ADDRESS || '' },
  { name: 'Badge', address: process.env.NEXT_PUBLIC_BADGE_ADDRESS || '' },
  { name: 'USDC', address: process.env.NEXT_PUBLIC_USDC_ADDRESS || '' },
].filter((contract) => /^0x[0-9a-fA-F]{40}$/.test(contract.address))

export const CHAIN_LABEL = CHAIN_ID === 143 ? 'MONAD MAINNET · CHAIN 143' : CHAIN_ID === 10143 ? 'MONAD TESTNET · CHAIN 10143' : `CHAIN ${CHAIN_ID}`
export const explorerAddressUrl = (address: string) => `${EXPLORER_URL.replace(/\/$/, '')}/address/${address}`
