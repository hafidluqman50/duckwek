import { api } from '@/http/client'

export interface SessionTypedData {
  domain: { name: string; version: string; chainId: number; verifyingContract: `0x${string}` }
  types: { Permit: { name: string; type: string }[] }
  primaryType: 'Permit'
  message: { owner: `0x${string}`; spender: `0x${string}`; value: string; nonce: string; deadline: string }
}
export const fetchNonce = (address: string, limit: bigint, duration: number) =>
  api<{ session: SessionTypedData }>('/api/auth/nonce', { method: 'POST', body: { address, limit: limit.toString(), duration }, auth: false })
export const verifySignature = (address: string, signature: string) =>
  api<{ token: string; address: string; isNew: boolean }>('/api/auth/verify', { method: 'POST', body: { address, signature }, auth: false })
