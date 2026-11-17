import { encodeAbiParameters, keccak256, type Address, type Hex } from 'viem'
import { env } from '@config/env'
import { Track } from '@Models/Track'
import { PartType, type PartSlot } from '@Models/PartType'
import { bytesOf, layoutPath, profileOf, sectorsOf, turnsAndLength } from '@Engine/Segments'
import { addresses, publicClient } from './Contracts'
import { partNftAbi, trackNftAbi } from './abis'

const SLOTS: PartSlot[] = ['wings', 'tail', 'bill']
const keyName = (k: Hex): string => Buffer.from(k.slice(2), 'hex').toString('utf8').replace(/\0+$/, '')
const slugOf = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/**
 * Reads the catalog from the chain (plan 0013 DoD 6) and upserts it into the database: part types with every stat of the registry,
 * circuits with their layout, holder and rent. The database is a cache of the chain here: nothing in it is hardcoded, and the
 * circuit path, sectors and engine profile are derived from the on-chain segment bytes.
 */
export async function syncCatalog(): Promise<{ parts: number; tracks: number }> {
  const parts = await syncParts()
  const tracks = await syncTracks()
  return { parts, tracks }
}

async function syncParts(): Promise<number> {
  const read = <T>(functionName: string, args: unknown[] = []) =>
    publicClient.readContract({ address: addresses.parts as Address, abi: partNftAbi, functionName, args } as any) as Promise<T>
  const count = Number(await read<bigint>('typeCount'))
  const statCount = Number(await read<bigint>('statCount'))
  const keys: Hex[] = []
  for (let i = 0; i < statCount; i++) keys.push(await read<Hex>('statKeys', [BigInt(i)]))
  for (let id = 0; id < count; id++) {
    const p = await read<{ name: string; creator: Address; price: bigint; slot: number; color: number; platform: boolean; active: boolean }>('partType', [BigInt(id)])
    const stats: Record<string, number> = {}
    for (const k of keys) stats[keyName(k)] = Number(await read<number>('statOf', [BigInt(id), k]))
    const row = {
      type_id: id,
      name: p.name,
      slot: SLOTS[p.slot] ?? 'wings',
      speed: stats.speed ?? 0,
      weight: stats.weight ?? 0,
      boost: stats.boost ?? 0,
      color: Number(p.color),
      stats,
      price: p.price.toString(),
      creator: p.creator.toLowerCase(),
      platform: p.platform,
      status: (p.active ? 'active' : 'discontinued') as 'active' | 'discontinued',
    }
    const existing = await PartType.findOne({ where: { type_id: id } })
    if (existing) await existing.update({ ...row, fit: {} })
    else await PartType.create({ ...row, fit: {} } as any)
  }
  return count
}

async function syncTracks(): Promise<number> {
  const read = <T>(functionName: string, args: unknown[] = []) =>
    publicClient.readContract({ address: addresses.tracks as Address, abi: trackNftAbi, functionName, args } as any) as Promise<T>
  const next = Number(await read<bigint>('nextId'))
  let n = 0
  for (let id = 1; id < next; id++) {
    const t = await read<{ name: string; creator: Address; rent: bigint; platform: boolean; active: boolean; version: number; editsUsed: number }>('track', [BigInt(id)])
    const [segments, laps] = await read<[Hex, number]>('layoutOf', [BigInt(id), t.version])
    const holder = (await read<Address>('ownerOf', [BigInt(id)])).toLowerCase()
    const rent = await read<bigint>('rentOf', [BigInt(id)])
    const seg = bytesOf(segments)
    const { turns, lengthM } = turnsAndLength(seg)
    const { path, closed } = layoutPath(seg)
    const row = {
      token_id: id,
      name: t.name,
      description: `${turns} turns · ${lengthM} m · ${laps} ${laps === 1 ? 'lap' : 'laps'}`,
      creator: t.creator.toLowerCase(),
      platform: t.platform,
      rent_price: rent.toString(),
      laps: Number(laps),
      turns,
      length_m: lengthM,
      closed,
      path,
      sectors: sectorsOf(path.length),
      profile: profileOf(turns, lengthM),
      segments,
      layout_version: Number(t.version),
      layout_hash: keccak256(encodeAbiParameters([{ type: 'bytes' }, { type: 'uint16' }], [segments, laps])), // same as the contract's layout hash
      holder,
      status: (t.active ? 'active' : 'coming_soon') as 'active' | 'coming_soon',
    }
    const existing = await Track.findOne({ where: { token_id: id } })
    if (existing) await existing.update({ ...row, slug: existing.slug === slugOf(t.name) ? existing.slug : await freeSlug(slugOf(t.name), existing.id) })
    else await Track.create({ ...row, slug: await freeSlug(slugOf(t.name), null) } as any)
    n++
  }
  return n
}

async function freeSlug(base: string, selfId: number | null): Promise<string> {
  let slug = base
  for (let i = 2; ; i++) {
    const clash = await Track.findOne({ where: { slug } })
    if (!clash || clash.id === selfId) return slug
    slug = `${base}-${i}`
  }
}

let timer: NodeJS.Timeout | null = null

/** Sync once at boot, then every `everyMs`. A failed sync is logged and the database keeps serving the last good copy. */
export async function startCatalogSync(everyMs = 5 * 60_000): Promise<void> {
  const run = async () => {
    try {
      const r = await syncCatalog()
      console.log(`[catalog] synced from chain: ${r.parts} parts, ${r.tracks} tracks (parts ${env.contracts.parts}, tracks ${env.contracts.tracks})`)
    } catch (e) {
      console.error('[catalog] sync failed, serving the last copy:', (e as any)?.shortMessage || (e as Error).message)
    }
  }
  await run()
  timer = setInterval(run, everyMs)
  timer.unref()
}
