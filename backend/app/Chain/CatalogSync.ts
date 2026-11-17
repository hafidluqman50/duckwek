import { encodeAbiParameters, keccak256, type Address, type Hex } from 'viem'
import { env } from '@config/env'
import { Track } from '@Models/Track'
import { PartType, type PartSlot } from '@Models/PartType'
import { bytesOf, layoutPath, profileOf, sectorsOf, turnsAndLength } from '@Engine/Segments'
import { addresses, publicClient } from './Contracts'
import { partNftAbi, trackNftAbi } from './abis'

const SLOTS: PartSlot[] = ['wings', 'tail', 'bill']
const keyName = (statKey: Hex): string => Buffer.from(statKey.slice(2), 'hex').toString('utf8').replace(/\0+$/, '')
const slugOf = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

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

  for (let keyIndex = 0; keyIndex < statCount; keyIndex++) keys.push(await read<Hex>('statKeys', [BigInt(keyIndex)]))

  for (let id = 0; id < count; id++) {
    const part = await read<{ name: string; creator: Address; price: bigint; slot: number; color: number; platform: boolean; active: boolean }>('partType', [BigInt(id)])
    const stats: Record<string, number> = {}

    for (const key of keys) stats[keyName(key)] = Number(await read<number>('statOf', [BigInt(id), key]))

    const row = {
      type_id: id,
      name: part.name,
      slot: SLOTS[part.slot] ?? 'wings',
      speed: stats.speed ?? 0,
      weight: stats.weight ?? 0,
      boost: stats.boost ?? 0,
      color: Number(part.color),
      stats,
      price: part.price.toString(),
      creator: part.creator.toLowerCase(),
      platform: part.platform,
      status: (part.active ? 'active' : 'discontinued') as 'active' | 'discontinued',
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
  let synced = 0

  for (let id = 1; id < next; id++) {
    const track = await read<{ name: string; creator: Address; rent: bigint; platform: boolean; active: boolean; version: number; editsUsed: number }>('track', [BigInt(id)])
    const [segments, laps] = await read<[Hex, number]>('layoutOf', [BigInt(id), track.version])
    const holder = (await read<Address>('ownerOf', [BigInt(id)])).toLowerCase()
    const rent = await read<bigint>('rentOf', [BigInt(id)])
    const segmentBytes = bytesOf(segments)
    const { turns, lengthM } = turnsAndLength(segmentBytes)
    const { path, closed } = layoutPath(segmentBytes)
    const row = {
      token_id: id,
      name: track.name,
      description: `${turns} turns · ${lengthM} m · ${laps} ${laps === 1 ? 'lap' : 'laps'}`,
      creator: track.creator.toLowerCase(),
      platform: track.platform,
      rent_price: rent.toString(),
      laps: Number(laps),
      turns,
      length_m: lengthM,
      closed,
      path,
      sectors: sectorsOf(path.length),
      profile: profileOf(turns, lengthM),
      segments,
      layout_version: Number(track.version),
      layout_hash: keccak256(encodeAbiParameters([{ type: 'bytes' }, { type: 'uint16' }], [segments, laps])),
      holder,
      status: (track.active ? 'active' : 'coming_soon') as 'active' | 'coming_soon',
    }
    const existing = await Track.findOne({ where: { token_id: id } })

    if (existing) await existing.update({ ...row, slug: existing.slug === slugOf(track.name) ? existing.slug : await freeSlug(slugOf(track.name), existing.id) })
    else await Track.create({ ...row, slug: await freeSlug(slugOf(track.name), null) } as any)
    synced++
  }

  return synced
}

async function freeSlug(base: string, selfId: number | null): Promise<string> {
  let slug = base

  for (let suffix = 2; ; suffix++) {
    const clash = await Track.findOne({ where: { slug } })

    if (!clash || clash.id === selfId) return slug

    slug = `${base}-${suffix}`
  }
}

let timer: NodeJS.Timeout | null = null

export async function startCatalogSync(everyMs = 5 * 60_000): Promise<void> {
  const run = async () => {
    try {
      const synced = await syncCatalog()
      console.log(`[catalog] synced from chain: ${synced.parts} parts, ${synced.tracks} tracks (parts ${env.contracts.parts}, tracks ${env.contracts.tracks})`)
    } catch (error) {
      console.error('[catalog] sync failed, serving the last copy:', (error as any)?.shortMessage || (error as Error).message)
    }
  }
  await run()

  timer = setInterval(run, everyMs)
  timer.unref()
}
