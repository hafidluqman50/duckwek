export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 10143)
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz'
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://testnet.monadvision.com'
export const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'duckwek-dev'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''

export const txUrl = (hash?: string | null) => (hash ? `${EXPLORER_URL.replace(/\/$/, '')}/tx/${hash}` : '#')
export const usdc = (v: string | number | bigint | null | undefined) => (Number(v || 0) / 1e6).toFixed(2)
export const short = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
