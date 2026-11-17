import { createPublicClient, formatEther, http, type Hex } from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'

export const API = process.env.API_URL || 'http://localhost:8080'
export const RPC = process.env.RPC_URL || ''

export const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error('ASSERT: ' + message)
}

export const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export async function call(path: string, method = 'GET', body?: unknown, token?: string): Promise<any> {
  const response = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json: any = await response.json()

  if (!response.ok || !json.status) {
    throw Object.assign(new Error(`${method} ${path} → ${response.status} ${json.message} ${JSON.stringify(json.data)}`), { status: response.status })
  }

  return json.data
}

export const revive = (typedData: any) =>
  JSON.parse(JSON.stringify(typedData), (key, value) =>
    ['value', 'nonce', 'deadline', 'amount'].includes(key) && typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : value,
  )

export async function signIn(account: PrivateKeyAccount): Promise<string> {
  const { session } = await call('/api/auth/nonce', 'POST', { address: account.address })
  const typedData = revive(session)
  const signature = await account.signTypedData({ domain: typedData.domain, types: typedData.types, primaryType: typedData.primaryType, message: typedData.message })

  return (await call('/api/auth/verify', 'POST', { address: account.address, signature })).token as string
}

export const order = (token: string, body: Record<string, unknown>) => call('/api/orders', 'POST', body, token)

export const publicClient = () => createPublicClient({ transport: http(RPC) })

export async function chargedMon(hashes: string[]): Promise<{ total: bigint; each: Map<string, bigint> }> {
  const client = publicClient()
  const each = new Map<string, bigint>()
  let total = 0n
  for (const hash of hashes) {
    const receipt = await client.getTransactionReceipt({ hash: hash as Hex })
    const wei = receipt.gasUsed * receipt.effectiveGasPrice
    each.set(hash, wei)
    total += wei
  }

  return { total, each }
}

export const mon = (wei: bigint): string => Number(formatEther(wei)).toFixed(6)

export const wallet = (key: Hex): PrivateKeyAccount => privateKeyToAccount(key)
