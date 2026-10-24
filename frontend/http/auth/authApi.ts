import { api } from '@/http/client'

/** The session the player signs once: an EIP-2612 `Permit` (spender = Vault, cap and expiry fixed by the server) on the USDC domain. Big numbers are decimal strings. */
export interface SessionTypedData {
  domain: { name: string; version: string; chainId: number; verifyingContract: `0x${string}` }
  types: { Permit: { name: string; type: string }[] }
  primaryType: 'Permit'
  message: { owner: `0x${string}`; spender: `0x${string}`; value: string; nonce: string; deadline: string }
}
export const fetchNonce = (address: string) => api<{ session: SessionTypedData }>('/api/auth/nonce', { method: 'POST', body: { address }, auth: false })
export const verifySignature = (address: string, signature: string) =>
  api<{ token: string; address: string; isNew: boolean }>('/api/auth/verify', { method: 'POST', body: { address, signature }, auth: false })
