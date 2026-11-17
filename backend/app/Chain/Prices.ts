import { addresses, publicClient } from './Contracts'
import { vaultAbi } from './abis'

const TTL_MS = 60_000
const cache = new Map<string, { at: number; price: bigint }>()

export async function chainPrice(kind: number, ref: bigint): Promise<bigint> {
  const key = `${kind}:${ref}`
  const cached = cache.get(key)

  if (cached && Date.now() - cached.at < TTL_MS) return cached.price

  const price = (await publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: 'priceOf', args: [kind, ref] })) as bigint
  cache.set(key, { at: Date.now(), price })

  return price
}
