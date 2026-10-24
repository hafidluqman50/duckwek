import { addresses, publicClient } from './Contracts'
import { vaultAbi } from './abis'

const TTL_MS = 60_000
const cache = new Map<string, { at: number; price: bigint }>()

/** What the Vault charges for this kind/ref right now. The chain is the one source of truth: an order is built with exactly this amount. */
export async function chainPrice(kind: number, ref: bigint): Promise<bigint> {
  const key = `${kind}:${ref}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.price
  const price = (await publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: 'priceOf', args: [kind, ref] })) as bigint
  cache.set(key, { at: Date.now(), price })
  return price
}
