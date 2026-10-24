import { createPublicClient, createWalletClient, defineChain, http, type Address, type PublicClient, type WalletClient, type Chain } from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { env } from '@config/env'
import { onFetchRequest } from './RpcStats'

export const chain: Chain = defineChain({
  id: env.chainId,
  name: env.chainId === 10143 ? 'Monad Testnet' : `chain-${env.chainId}`,
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [env.rpcUrl] } },
  blockTime: 300,
})

export const addresses = env.contracts as Record<keyof typeof env.contracts, Address>

// Reads only: state calls before a write and balances for the profile. The race path itself sends transactions and nothing else.
export const publicClient: PublicClient = createPublicClient({ chain, transport: http(env.rpcUrl, { batch: false, retryCount: 3, onFetchRequest }) })

// Nonces are allocated by the Relayer (one counter, many concurrent rooms), so the account has no viem nonceManager.
export const operator: PrivateKeyAccount = privateKeyToAccount(env.operatorKey as `0x${string}`)

// Used only to send signed transactions: no retries (a retry of a timed-out call must not double-send) and a long timeout.
export const sendClient: PublicClient = createPublicClient({ chain, transport: http(env.rpcUrl, { batch: false, retryCount: 0, timeout: 30_000, onFetchRequest }) })

export const walletClient: WalletClient = createWalletClient({ chain, account: operator, transport: http(env.rpcUrl, { retryCount: 3, onFetchRequest }) })

export const txUrl = (hash: string): string => `${env.explorerUrl.replace(/\/$/, '')}/tx/${hash}`
