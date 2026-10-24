import { concatHex, encodeAbiParameters, keccak256, toHex, zeroAddress, type Address, type Hex } from 'viem'
import { env } from '@config/env'
import { CHEER, Race as Engine, statsFor, botName, titleFor, PALETTE, type Entrant, type Profile, type Taps, type Template } from '@Engine/Race'
import { cheersRoot, standingRoot, type CheerLog } from '@Engine/Cheers'
import { relayer, type TickResult } from '@Chain/Relayer'
import { joinBatcher } from '@Chain/JoinBatcher'
import { RoomRepository } from '@Repositories/Room/RoomRepository'
import { RaceRepository } from '@Repositories/Race/RaceRepository'
import { DuckRepository } from '@Repositories/Duck/DuckRepository'
import { CatalogRepository } from '@Repositories/Catalog/CatalogRepository'
import { RoomService } from '@Services/Room/RoomService'
import { roomEvents } from '@Services/Room/RoomEvents'
import { BadRequestException } from '@Exceptions/BadRequestException'
import { ForbiddenException } from '@Exceptions/ForbiddenException'
import type { Race as RaceRow, RankRow } from '@Models/Race'

type LiveStatus = 'lobby' | 'countdown' | 'race' | 'results' | 'closed'

interface Look {
  template: Template
  bodyColor: string
  billColor: string
  cosmetics: { hat: boolean; shades: boolean; scarf: boolean }
  partTypeId: number | null
}

interface Live {
  code: string
  roomId: number
  roomKey: Hex
  chainRoomId: number
  status: LiveStatus
  entrants: Entrant[]
  looks: Look[]
  profile: Profile
  laps: number
  engine: Engine | null
  startBlock: number | null
  row: RaceRow | null
  raceId: number
  last: unknown
  ticks: Promise<void>[]
  timer: NodeJS.Timeout | null
  inflight: number
  sent: number
  startedAt: number
  startTx: string | null
  // cheer (plan §3.10): taps waiting for the next step, the frozen log, who is which duck, the rate limit
  pending: Taps
  log: CheerLog
  idxOf: Map<string, number>
  rate: Map<string, number[]>
}

const broadcast = (code: string, event: string, payload: unknown) => roomEvents.emit('broadcast', code, event, payload)
// Must match the titles awarded by DuckWekRace.finalize (kind 0 = winner, 1 = runner-up, 2 = third).
const ACHIEVEMENT = ['First Time Winner', 'First Time Runner-up', 'First Time Third']
// DuckNFT.hatch encoding helpers (template id, #RRGGBB to uint24, cosmetics to a 3-bit mask).
const TEMPLATE_ID: Record<string, number> = { balanced: 0, sprint: 1, tank: 2 }
const colorToUint24 = (c: string): number => parseInt(c.replace('#', ''), 16) || 0
const cosmeticsBits = (c: { hat?: boolean; shades?: boolean; scarf?: boolean }): number => (c.hat ? 1 : 0) | (c.shades ? 2 : 0) | (c.scarf ? 4 : 0)
const MAX_INFLIGHT = 8 // ticks sent but not yet in a receipt: a slow RPC must not pile up transactions
const MAX_TAPS_PER_SECOND = 5 // accepted CHEER taps per player

/**
 * Drives every live room: join batch confirmed on-chain, countdown, `start` on-chain (the contract fixes the seed and
 * the start block), then one `tick` transaction every ~300 ms. The engine advances to the step `n` that each inline
 * receipt reports (steps no receipt reported are filled by the pure function, so nothing freezes). Results, `finalize`
 * on-chain. Nothing here reads blocks, block hashes or log ranges (plan §3.4).
 */
export class RaceService {
  private live = new Map<string, Live>()

  constructor(
    public roomRepository: RoomRepository,
    public raceRepository: RaceRepository,
    public duckRepository: DuckRepository,
    public catalogRepository: CatalogRepository,
    public roomService: RoomService,
  ) {}

  status(code: string): LiveStatus | undefined {
    return this.live.get(code)?.status
  }

  lastResult(code: string): unknown {
    return this.live.get(code)?.last ?? null
  }

  snapshot(code: string) {
    const l = this.live.get(code)
    if (!l || !l.engine || l.startBlock === null || l.status !== 'race') return null
    return { raceId: l.raceId, b: l.startBlock + l.engine.step, n: l.engine.step, t: l.engine.step, p: l.engine.positions(), en: l.engine.boost() }
  }

  grid(code: string) {
    const l = this.live.get(code)
    if (!l || (l.status !== 'race' && l.status !== 'countdown')) return null
    return this.gridPayload(l, 0)
  }

  private gridPayload(l: Live, countdown: number) {
    return {
      raceId: l.raceId,
      laps: l.laps,
      countdown,
      cheerPct: CHEER.cheerMax / 10_000, // the most a full meter adds to the speed, in percent (for the phone's BOOST label)
      entrants: l.entrants.map((d, i) => ({ i, name: d.name, address: d.address, human: d.human, color: d.color, ...l.looks[i] })),
    }
  }

  async start(code: string, address: string): Promise<{ raceId: number; field: number }> {
    const room = await this.roomService.mustGet(code)
    if (room.host !== address) throw new ForbiddenException('Only the host can start the race')
    const current = this.live.get(room.code)
    if (current && (current.status === 'countdown' || current.status === 'race')) throw new BadRequestException('A race is already running')
    if (!room.chain_room_id) throw new BadRequestException('This room has no on-chain id')
    const chainRoomId = Number(room.chain_room_id)
    // One race per on-chain room: DuckWekRace closes a room at finalize.
    if ((await this.raceRepository.nextRaceId(room.id)) > 1) throw new BadRequestException('This room already raced. Create a new room for another race.')

    await joinBatcher.idle(chainRoomId) // every join must be on-chain before the race starts
    const players = await this.roomRepository.players(room.id)
    const entrants: Entrant[] = []
    const looks: Look[] = []
    for (const p of players) {
      // The loadout part (owned, checked when it was set) changes the stats the engine races with.
      const part = p.part_type_id === null ? null : await this.catalogRepository.partByTypeId(p.part_type_id)
      const template = p.template as Template
      entrants.push({ id: p.address, name: p.duck_name, color: p.body_color, human: true, address: p.address, stats: statsFor(template, part), build: `${template}:${part?.name ?? '-'}` })
      looks.push({ template, bodyColor: p.body_color, billColor: p.bill_color, cosmetics: p.cosmetics, partTypeId: part ? part.type_id : null })
    }
    const total = room.fill_bots ? room.max_ducks : Math.max(entrants.length, 2)
    const templates: Template[] = ['balanced', 'sprint', 'tank']
    for (let i = entrants.length; i < total; i++) {
      const t = templates[i % 3]
      const color = PALETTE[(i * 7) % PALETTE.length]
      entrants.push({ id: `bot:${i}`, name: botName(i) + (i % 9), color, human: false, address: null, stats: statsFor(t, null), build: `${t}:bot` })
      looks.push({ template: t, bodyColor: color, billColor: '#FF9F1C', cosmetics: { hat: i % 5 === 0, shades: i % 7 === 1, scarf: false }, partTypeId: null })
    }

    const raceId = await this.raceRepository.nextRaceId(room.id)
    const track = room.track!
    const l: Live = {
      code: room.code, roomId: room.id, roomKey: room.room_key as Hex, chainRoomId, status: 'countdown', entrants, looks,
      profile: track.profile, laps: track.laps, engine: null, startBlock: null, row: null, raceId, last: null, ticks: [], timer: null,
      inflight: 0, sent: 0, startedAt: 0, startTx: null,
      pending: {}, log: {}, rate: new Map(),
      idxOf: new Map(entrants.flatMap((e, i) => (e.address ? [[e.address.toLowerCase(), i] as [string, number]] : []))),
    }
    this.live.set(room.code, l)
    await room.update({ status: 'grid' })

    let n = env.countdownSec
    broadcast(room.code, 'race:grid', this.gridPayload(l, n))
    const timer = setInterval(() => {
      n -= 1
      if (n > 0) return broadcast(room.code, 'race:countdown', { raceId, n })
      clearInterval(timer)
      this.go(l).catch((err) => this.abort(l, err))
    }, 1000)
    return { raceId, field: entrants.length }
  }

  /**
   * Countdown is over: `start` on-chain. The contract fixes the seed (from prevrandao) and `startBlock`; both come from the
   * Started event of this receipt. The participant list (humans by address, bots by id) is committed before the first tick.
   */
  private async go(l: Live): Promise<void> {
    const participantsRoot = keccak256(concatHex(l.entrants.map((e) => (e.address ? (e.address as Hex) : keccak256(toHex(e.id))))))
    const started = await relayer.start(l.chainRoomId, l.entrants.length, participantsRoot)
    l.startTx = started.tx.hash
    l.startBlock = started.startBlock
    l.engine = new Engine({ raceId: l.raceId, seed: started.seed, entrants: l.entrants, profile: l.profile, laps: l.laps })
    l.row = await this.raceRepository.create({ room_id: l.roomId, race_id: String(l.raceId), seed: started.seed, start_block: String(started.startBlock), start_tx: started.tx.hash })
    l.status = 'race'
    l.startedAt = Date.now()
    const room = await this.roomService.mustGet(l.code)
    await room.update({ status: 'race' })
    broadcast(l.code, 'race:go', { raceId: l.raceId, tx: started.tx.hash, startBlock: started.startBlock })
    l.timer = setInterval(() => this.sendTick(l), env.tickIntervalMs)
  }

  /** The race could not start (or broke): back to the lobby, the room is still open on-chain. */
  private async abort(l: Live, err: unknown): Promise<void> {
    console.error(`[race] room ${l.code} aborted:`, (err as any)?.shortMessage || (err as Error)?.message || err)
    if (l.timer) clearInterval(l.timer)
    l.timer = null
    this.live.delete(l.code)
    try {
      const room = await this.roomService.mustGet(l.code)
      await room.update({ status: 'lobby' })
    } catch (e) {
      console.error(`[race] room ${l.code}: could not reopen the lobby:`, (e as Error).message)
    }
    broadcast(l.code, 'race:aborted', { raceId: l.raceId })
    roomEvents.emit('room:changed', l.code)
  }

  /**
   * One CHEER tap. It counts only if the sender is a human entrant of this room, the race is running and the sender is under
   * MAX_TAPS_PER_SECOND. Counted taps wait in `pending` and are assigned to the next step that is computed. Returns the duck's name
   * when the tap counted (the projector shows it), otherwise null.
   */
  cheer(code: string, address: string): { name: string } | null {
    const l = this.live.get(code)
    if (!l || l.status !== 'race' || !l.engine) return null
    const idx = l.idxOf.get(address.toLowerCase())
    if (idx === undefined) return null
    const now = Date.now()
    const recent = (l.rate.get(address) ?? []).filter((t) => now - t < 1000)
    if (recent.length >= MAX_TAPS_PER_SECOND) {
      l.rate.set(address, recent)
      return null
    }
    recent.push(now)
    l.rate.set(address, recent)
    l.pending[idx] = (l.pending[idx] ?? 0) + 1
    return { name: l.entrants[idx].name }
  }

  /** Every ~300 ms: one tick transaction, not awaited. Steps are taken from the receipts as they come back. */
  private sendTick(l: Live): void {
    if (l.status !== 'race' || !l.engine) return
    const maxMs = l.engine.expectedSteps * 4 * env.tickIntervalMs + 60_000
    if (Date.now() - l.startedAt > maxMs) {
      console.error(`[race] room ${l.code}: no finish after ${maxMs} ms, closing with the current standing`)
      if (l.timer) clearInterval(l.timer)
      l.timer = null
      this.finish(l).catch((err) => console.error('[race] finish', err))
      return
    }
    if (l.inflight >= MAX_INFLIGHT) return
    l.inflight++
    l.sent++
    const p = relayer.tick(l.chainRoomId).then((r) => {
      l.inflight--
      if (r) this.onTick(l, r)
    })
    l.ticks.push(p)
  }

  private onTick(l: Live, r: TickResult): void {
    const e = l.engine
    if (l.status !== 'race' || !e || l.startBlock === null) return
    const before = e.step
    if (r.n <= before) return // a tick that landed late: the step is already computed
    // The taps that arrived since the last step belong to the first step computed now; later steps of a jump get none. Frozen into the log.
    let first = true
    const events = e.advanceTo(r.n, (step) => {
      const taps = first ? l.pending : {}
      if (first) l.pending = {}
      first = false
      if (Object.keys(taps).length) l.log[step] = { ...taps }
      return taps
    })
    const positions = e.positions()
    broadcast(l.code, 'race:tick', { raceId: l.raceId, b: l.startBlock + e.step, n: e.step, t: e.step, p: positions, en: e.boost(), ev: events, tx: r.hash })
    this.recordTick(l, r, positions)
    if (e.done) {
      if (l.timer) clearInterval(l.timer)
      l.timer = null
      this.finish(l).catch((err) => console.error('[race] finish', err))
    }
  }

  /** The tick is already on-chain (its receipt came back); the database row follows. */
  private recordTick(l: Live, r: TickResult, positions: number[]): void {
    const hex = concatHex(positions.map((v) => toHex(v, { size: 2 })))
    this.raceRepository
      .addTick({ room_id: l.roomId, race_id: String(l.raceId), seq: l.engine!.step - 1, step: r.n, blk: String(l.startBlock! + r.n), positions: hex, tx_hash: r.hash, included_block: String(r.includedBlock), status: 'success', gas_limit: r.gasLimit, submit_to_receipt_ms: r.ms })
      .catch((err) => console.warn(`[race] room ${l.code} tick row ${r.n}:`, err.message))
  }

  private async finish(l: Live): Promise<void> {
    if (l.status !== 'race') return
    const e = l.engine!
    l.status = 'results'
    const ranking = e.ranking()
    const rows: RankRow[] = ranking.map((d, i) => ({ rank: i + 1, name: d.name, address: d.address, human: d.human, progress: Math.round(Math.min(d.p, 1_060_000) / 100) }))
    const podium = rows.slice(0, 3).map((r) => (r.address || zeroAddress) as Address) as [Address, Address, Address]
    const endBlock = (l.startBlock ?? 0) + e.step
    const raceRoot = keccak256(
      encodeAbiParameters(
        [{ type: 'uint64' }, { type: 'uint64' }, { type: 'uint64' }, { type: 'address[]' }],
        [BigInt(l.raceId), BigInt(l.startBlock ?? 0), BigInt(endBlock), rows.map((r) => (r.address || zeroAddress) as Address)],
      ),
    )
    // What goes on chain commits to the standings AND to the cheer log, so the race can be recomputed from the seed, the steps and the log.
    const cRoot = cheersRoot(l.log)
    const resultsRoot = standingRoot(raceRoot, cRoot)
    const result = {
      raceId: l.raceId,
      startBlock: l.startBlock,
      endBlock,
      resultsRoot,
      cheersRoot: cRoot,
      cheers: l.log, // public: anyone can recompute the race from the seed, the steps and this log
      field: rows.length,
      ranking: rows.map((r, i) => ({ ...r, title: titleFor(r.rank), color: ranking[i].color, i: ranking[i].idx })),
    }
    l.last = result
    broadcast(l.code, 'race:result', result)

    // Close the race on-chain first (after every tick transaction has finished); the database follows.
    await Promise.allSettled(l.ticks)
    let minted: { address: string; kind: number }[] = []
    let finalizeTx: { hash: string; url: string | null } | null = null
    try {
      const tx = await relayer.finalize(l.chainRoomId, resultsRoot, podium)
      finalizeTx = { hash: tx.hash, url: tx.url }
      minted = relayer.achievements(tx)
    } catch (err) {
      console.warn(`[race] room ${l.code} finalize failed:`, (err as any)?.shortMessage || (err as Error).message)
    }

    const room = await this.roomService.mustGet(l.code)
    // The chain closes a room at finalize: this lobby cannot race again (the phone offers Home or a new room).
    await room.update({ status: finalizeTx ? 'closed' : 'lobby' })
    l.status = finalizeTx ? 'closed' : 'lobby'
    if (l.row) {
      await this.raceRepository.finish(l.row, { end_block: String(endBlock), ranking: rows, podium, results_root: resultsRoot, cheers: l.log, cheers_root: cRoot, status: finalizeTx ? 'settled' : 'failed' })
      if (finalizeTx) await l.row.update({ settle_tx: finalizeTx.hash })
    }

    // Duck stats; `titles` counts the achievements that were actually minted.
    for (const r of rows) {
      if (!r.human || !r.address) continue
      const duck = await this.duckRepository.byAddress(r.address)
      if (!duck) continue
      const got = minted.filter((m) => m.address.toLowerCase() === r.address!.toLowerCase()).length
      await duck.update({ races: duck.races + 1, titles: duck.titles + got, best_rank: duck.best_rank === null ? r.rank : Math.min(duck.best_rank, r.rank) })
    }
    const titles = minted.map((m) => ({ address: m.address, rank: m.kind + 1, title: ACHIEVEMENT[m.kind] }))
    for (const t of titles) await this.duckRepository.addTitle({ address: t.address, room_code: l.code, race_id: String(l.raceId), rank: t.rank, title: t.title, tx_hash: finalizeTx?.hash ?? null })
    broadcast(l.code, 'race:settled', { raceId: l.raceId, tx: finalizeTx?.hash ?? null, url: finalizeTx?.url ?? null, titles, ok: !!finalizeTx })

    // First paid race done: hatch the egg into a Duck NFT in the player's own wallet (never blocks the result above).
    if (finalizeTx) void this.hatchFirstTimers(l)
  }

  /** Each egg is minted once, by the operator, into the player's own wallet. One failure never stops the others. */
  private async hatchFirstTimers(l: Live): Promise<void> {
    const ranking = (l.last as { ranking?: { address: string | null; human: boolean }[] } | null)?.ranking ?? []
    for (const r of ranking) {
      if (!r.human || !r.address) continue
      const duck = await this.duckRepository.byAddress(r.address)
      if (!duck || duck.status !== 'egg') continue
      try {
        await duck.update({ status: 'hatching' })
        const { tx, tokenId } = await relayer.hatch(r.address as Address, {
          name: duck.name,
          template: TEMPLATE_ID[duck.template] ?? 0,
          bodyColor: colorToUint24(duck.body_color),
          billColor: colorToUint24(duck.bill_color),
          cosmetics: cosmeticsBits(duck.cosmetics),
        })
        await duck.update({ status: 'hatched', token_id: tokenId, tx_hash: tx.hash })
        broadcast(l.code, 'duck:hatched', { address: r.address, tokenId, tx: tx.hash, url: tx.url })
        console.log(`[hatch] room ${l.code} ${r.address} duck #${tokenId} ${tx.hash}`)
      } catch (err) {
        await duck.update({ status: 'failed' })
        console.error(`[hatch] room ${l.code} player ${r.address}:`, (err as any)?.shortMessage || (err as Error).message)
      }
    }
  }
}
