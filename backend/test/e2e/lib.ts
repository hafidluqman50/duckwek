// Shared helpers of the end-to-end and load tests. Tests only: nothing in app/ imports this.
import { createPublicClient, formatEther, http, type Hex } from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'

export const API = process.env.API_URL || 'http://localhost:8080'
export const RPC = process.env.RPC_URL || ''

export const assert = (c: unknown, m: string): void => {
  if (!c) throw new Error('ASSERT: ' + m)
}
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function call(path: string, method = 'GET', body?: unknown, token?: string): Promise<any> {
  const res = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const json: any = await res.json()
  if (!res.ok || !json.status) throw Object.assign(new Error(`${method} ${path} → ${res.status} ${json.message} ${JSON.stringify(json.data)}`), { status: res.status })
  return json.data
}

/** Decimal strings of the numeric EIP-712 fields back to bigint (the API sends bigints as strings). */
export const revive = (td: any) => JSON.parse(JSON.stringify(td), (k, v) => (['value', 'nonce', 'deadline', 'amount'].includes(k) && typeof v === 'string' && /^\d+$/.test(v) ? BigInt(v) : v))

/** The ONE signature: the session permit (login proof and spending cap). Everything after this needs no signature. */
export async function signIn(acc: PrivateKeyAccount): Promise<string> {
  const { session } = await call('/api/auth/nonce', 'POST', { address: acc.address })
  const td = revive(session)
  const signature = await acc.signTypedData({ domain: td.domain, types: td.types, primaryType: td.primaryType, message: td.message })
  return (await call('/api/auth/verify', 'POST', { address: acc.address, signature })).token as string
}

export const order = (token: string, body: Record<string, unknown>) => call('/api/orders', 'POST', body, token)

export const publicClient = () => createPublicClient({ transport: http(RPC) })

/** MON charged for a transaction: Monad charges the gas LIMIT, and the receipt's gasUsed equals it. */
export async function chargedMon(hashes: string[]): Promise<{ total: bigint; each: Map<string, bigint> }> {
  const pc = publicClient()
  const each = new Map<string, bigint>()
  let total = 0n
  for (const h of hashes) {
    const rc = await pc.getTransactionReceipt({ hash: h as Hex })
    const wei = rc.gasUsed * rc.effectiveGasPrice
    each.set(h, wei)
    total += wei
  }
  return { total, each }
}
export const mon = (wei: bigint): string => Number(formatEther(wei)).toFixed(6)

export const wallet = (key: Hex): PrivateKeyAccount => privateKeyToAccount(key)
