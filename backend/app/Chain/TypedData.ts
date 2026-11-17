import { env } from '@config/env'
import { addresses } from './Contracts'

export const TEMPLATE_ID: Record<string, number> = { balanced: 0, sprint: 1, tank: 2 }
export const KIND = { create_room: 1, join_room: 2, buy_part: 3 } as const

export const permitTypes = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

export const usdcDomain = () => ({ name: env.usdcName, version: env.usdcVersion, chainId: env.chainId, verifyingContract: addresses.usdc })

export const withdrawalTypes = {
  Withdrawal: [
    { name: 'owner', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

export const vaultDomain = () => ({ name: 'DuckWekVault', version: '1', chainId: env.chainId, verifyingContract: addresses.vault })

export const jsonify = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value, (_key, entry) => (typeof entry === 'bigint' ? entry.toString() : entry)))
