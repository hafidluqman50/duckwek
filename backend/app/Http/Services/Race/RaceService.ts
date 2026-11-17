import { concatHex, encodeAbiParameters, keccak256, pad, toHex, zeroAddress, type Address, type Hex } from 'viem'
import { env } from '@config/env'
import { CHEER, Race as Engine, statsFor, botName, titleFor, PALETTE, type Entrant, type Profile, type Taps, type Template } from '@Engine/Race'
import { cheersRoot, standingRoot, type CheerLog } from '@Engine/Cheers'
import { NO_PART, relayer, type TickResult } from '@Chain/Relayer'
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
  partBySlot: [number, number, number]
  partSlot: string | null
  partColor: string | null
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
  layoutVersion: number
  engine: Engine | null
  startBlock: number | null
  row: RaceRow | null
  raceId: number
  last: unknown
  ticks: Promise<void>[]
  timer: NodeJS.Timeout | null
  inflightTicks: number
  sentTicks: number
  startedAt: number
  startTransactionHash: string | null
  pending: Taps
  log: CheerLog
  duckIndexByAddress: Map<string, number>
  tapTimestamps: Map<string, number[]>
}

const broadcast = (code: string, event: string, payload: unknown) => roomEvents.emit('broadcast', code, event, payload)
const ACHIEVEMENT_TITLE_BY_KIND = ['First Time Winner', 'First Time Runner-up', 'First Time Third']
const TEMPLATE_ID: Record<string, number> = { balanced: 0, sprint: 1, tank: 2 }
const SLOT_INDEX: Record<string, number> = { wings: 0, tail: 1, bill: 2 }
const MAX_INFLIGHT = 8
const MAX_TAPS_PER_SECOND = 5
const BOT_BILL_COLOR = '#FF9F1C'
const BOT_TEMPLATES: Template[] = ['balanced', 'sprint', 'tank']
const FULL_METER_PERCENT_DIVISOR = 10_000
const PROGRESS_CAP_PPM = 1_060_000

const errorMessageOf = (error: unknown): unknown => (error as any)?.shortMessage || (error as Error)?.message || error

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
    const liveRace = this.live.get(code)

    if (!liveRace || !liveRace.engine || liveRace.startBlock === null || liveRace.status !== 'race') return null

    return {
      raceId: liveRace.raceId,
      b: liveRace.startBlock + liveRace.engine.step,
      n: liveRace.engine.step,
      t: liveRace.engine.step,
      p: liveRace.engine.positions(),
      en: liveRace.engine.boost(),
    }
  }

  grid(code: string) {
    const liveRace = this.live.get(code)

    if (!liveRace || (liveRace.status !== 'race' && liveRace.status !== 'countdown')) return null

    return this.gridPayload(liveRace, 0)
  }

  private gridPayload(liveRace: Live, countdown: number) {
    return {
      raceId: liveRace.raceId,
      laps: liveRace.laps,
      countdown,
      cheerPct: CHEER.cheerMax / FULL_METER_PERCENT_DIVISOR,
      entrants: liveRace.entrants.map((entrant, index) => ({
        i: index,
        name: entrant.name,
        address: entrant.address,
        human: entrant.human,
        color: entrant.color,
        ...liveRace.looks[index],
      })),
    }
  }

  async start(code: string, address: string): Promise<{ raceId: number; field: number }> {
    const room = await this.roomService.mustGet(code)

    if (room.host !== address) throw new ForbiddenException('Only the host can start the race')

    const current = this.live.get(room.code)

    if (current && (current.status === 'countdown' || current.status === 'race')) throw new BadRequestException('A race is already running')

    if (!room.chain_room_id) throw new BadRequestException('This room has no on-chain id')

    const chainRoomId = Number(room.chain_room_id)

    if ((await this.raceRepository.nextRaceId(room.id)) > 1) throw new BadRequestException('This room already raced. Create a new room for another race.')

    await joinBatcher.idle(chainRoomId)

    const players = await this.roomRepository.players(room.id)
    const entrants: Entrant[] = []
    const looks: Look[] = []

    for (const player of players) {
      const part = player.part_type_id === null ? null : await this.catalogRepository.partByTypeId(player.part_type_id)
      const template = player.template as Template
      const partBySlot: [number, number, number] = [NO_PART, NO_PART, NO_PART]

      if (part) partBySlot[SLOT_INDEX[part.slot]] = part.type_id

      entrants.push({
        id: player.address,
        name: player.duck_name,
        color: player.body_color,
        human: true,
        address: player.address,
        stats: statsFor(template, part),
        build: `${template}:${part?.name ?? '-'}`,
      })
      looks.push({
        template,
        partBySlot,
        partSlot: part ? part.slot : null,
        partColor: part ? '#' + part.color.toString(16).padStart(6, '0').toUpperCase() : null,
        bodyColor: player.body_color,
        billColor: player.bill_color,
        cosmetics: player.cosmetics,
        partTypeId: part ? part.type_id : null,
      })
    }

    const fieldSize = room.fill_bots ? room.max_ducks : Math.max(entrants.length, 2)

    for (let botIndex = entrants.length; botIndex < fieldSize; botIndex++) {
      const template = BOT_TEMPLATES[botIndex % 3]
      const color = PALETTE[(botIndex * 7) % PALETTE.length]
      entrants.push({ id: `bot:${botIndex}`, name: botName(botIndex) + (botIndex % 9), color, human: false, address: null, stats: statsFor(template, null), build: `${template}:bot` })
      looks.push({
        template,
        partBySlot: [NO_PART, NO_PART, NO_PART],
        partSlot: null,
        partColor: null,
        bodyColor: color,
        billColor: BOT_BILL_COLOR,
        cosmetics: { hat: botIndex % 5 === 0, shades: botIndex % 7 === 1, scarf: false },
        partTypeId: null,
      })
    }

    const raceId = await this.raceRepository.nextRaceId(room.id)
    const track = room.track!
    const liveRace: Live = {
      code: room.code,
      roomId: room.id,
      roomKey: room.room_key as Hex,
      chainRoomId,
      status: 'countdown',
      entrants,
      looks,
      profile: track.profile,
      laps: track.laps,
      layoutVersion: track.layout_version,
      engine: null,
      startBlock: null,
      row: null,
      raceId,
      last: null,
      ticks: [],
      timer: null,
      inflightTicks: 0,
      sentTicks: 0,
      startedAt: 0,
      startTransactionHash: null,
      pending: {},
      log: {},
      tapTimestamps: new Map(),
      duckIndexByAddress: new Map(entrants.flatMap((entrant, index) => (entrant.address ? [[entrant.address.toLowerCase(), index] as [string, number]] : []))),
    }
    this.live.set(room.code, liveRace)
    await room.update({ status: 'grid' })

    let secondsLeft = env.countdownSec
    broadcast(room.code, 'race:grid', this.gridPayload(liveRace, secondsLeft))
    const countdownTimer = setInterval(() => {
      secondsLeft -= 1

      if (secondsLeft > 0) return broadcast(room.code, 'race:countdown', { raceId, n: secondsLeft })

      clearInterval(countdownTimer)
      this.go(liveRace).catch((error) => this.abort(liveRace, error))
    }, 1000)

    return { raceId, field: entrants.length }
  }

  private async go(liveRace: Live): Promise<void> {
    const participantLeaves = liveRace.entrants.map((entrant, index) =>
      keccak256(
        encodeAbiParameters(
          [{ type: 'bytes32' }, { type: 'uint8' }, { type: 'uint16[3]' }],
          [
            entrant.address ? (pad(entrant.address as Hex, { size: 32 }) as Hex) : keccak256(toHex(entrant.id)),
            TEMPLATE_ID[liveRace.looks[index].template] ?? 0,
            liveRace.looks[index].partBySlot,
          ],
        ),
      ),
    )
    const participantsRoot = keccak256(concatHex(participantLeaves))
    const engineVersion = keccak256(toHex(env.engineVersion))
    const started = await relayer.start(liveRace.chainRoomId, liveRace.entrants.length, participantsRoot, engineVersion)
    liveRace.startTransactionHash = started.tx.hash
    liveRace.startBlock = started.startBlock
    liveRace.engine = new Engine({ raceId: liveRace.raceId, seed: started.seed, entrants: liveRace.entrants, profile: liveRace.profile, laps: liveRace.laps })
    liveRace.row = await this.raceRepository.create({
      room_id: liveRace.roomId,
      race_id: String(liveRace.raceId),
      seed: started.seed,
      start_block: String(started.startBlock),
      start_tx: started.tx.hash,
      engine_version: engineVersion,
      participants_root: participantsRoot,
      layout_version: liveRace.layoutVersion,
    })
    liveRace.status = 'race'
    liveRace.startedAt = Date.now()

    const room = await this.roomService.mustGet(liveRace.code)
    await room.update({ status: 'race' })
    broadcast(liveRace.code, 'race:go', { raceId: liveRace.raceId, tx: started.tx.hash, startBlock: started.startBlock })
    liveRace.timer = setInterval(() => this.sendTick(liveRace), env.tickIntervalMs)
  }

  private async abort(liveRace: Live, error: unknown): Promise<void> {
    console.error(`[race] room ${liveRace.code} aborted:`, errorMessageOf(error))

    if (liveRace.timer) clearInterval(liveRace.timer)

    liveRace.timer = null
    this.live.delete(liveRace.code)

    try {
      const room = await this.roomService.mustGet(liveRace.code)
      await room.update({ status: 'lobby' })
    } catch (reopenError) {
      console.error(`[race] room ${liveRace.code}: could not reopen the lobby:`, (reopenError as Error).message)
    }

    broadcast(liveRace.code, 'race:aborted', { raceId: liveRace.raceId })
    roomEvents.emit('room:changed', liveRace.code)
  }

  cheer(code: string, address: string): { name: string } | null {
    const liveRace = this.live.get(code)

    if (!liveRace || liveRace.status !== 'race' || !liveRace.engine) return null

    const duckIndex = liveRace.duckIndexByAddress.get(address.toLowerCase())

    if (duckIndex === undefined) return null

    const now = Date.now()
    const recentTaps = (liveRace.tapTimestamps.get(address) ?? []).filter((tappedAt) => now - tappedAt < 1000)

    if (recentTaps.length >= MAX_TAPS_PER_SECOND) {
      liveRace.tapTimestamps.set(address, recentTaps)

      return null
    }

    recentTaps.push(now)
    liveRace.tapTimestamps.set(address, recentTaps)
    liveRace.pending[duckIndex] = (liveRace.pending[duckIndex] ?? 0) + 1

    return { name: liveRace.entrants[duckIndex].name }
  }

  private sendTick(liveRace: Live): void {
    if (liveRace.status !== 'race' || !liveRace.engine) return

    const maxDurationMs = liveRace.engine.expectedSteps * 4 * env.tickIntervalMs + 60_000

    if (Date.now() - liveRace.startedAt > maxDurationMs) {
      console.error(`[race] room ${liveRace.code}: no finish after ${maxDurationMs} ms, closing with the current standing`)

      if (liveRace.timer) clearInterval(liveRace.timer)

      liveRace.timer = null
      this.finish(liveRace).catch((error) => console.error('[race] finish', error))

      return
    }

    if (liveRace.inflightTicks >= MAX_INFLIGHT) return

    liveRace.inflightTicks++
    liveRace.sentTicks++
    const tickPromise = relayer.tick(liveRace.chainRoomId).then((result) => {
      liveRace.inflightTicks--

      if (result) this.onTick(liveRace, result)
    })
    liveRace.ticks.push(tickPromise)
  }

  private onTick(liveRace: Live, result: TickResult): void {
    const engine = liveRace.engine

    if (liveRace.status !== 'race' || !engine || liveRace.startBlock === null) return

    const stepBefore = engine.step

    if (result.step <= stepBefore) return

    let isFirstStep = true
    const events = engine.advanceTo(result.step, (step) => {
      const taps = isFirstStep ? liveRace.pending : {}

      if (isFirstStep) liveRace.pending = {}

      isFirstStep = false

      if (Object.keys(taps).length) liveRace.log[step] = { ...taps }

      return taps
    })
    const positions = engine.positions()
    broadcast(liveRace.code, 'race:tick', {
      raceId: liveRace.raceId,
      b: liveRace.startBlock + engine.step,
      n: engine.step,
      t: engine.step,
      p: positions,
      en: engine.boost(),
      ev: events,
      tx: result.hash,
    })
    this.recordTick(liveRace, result, positions)

    if (engine.done) {
      if (liveRace.timer) clearInterval(liveRace.timer)

      liveRace.timer = null
      this.finish(liveRace).catch((error) => console.error('[race] finish', error))
    }
  }

  private recordTick(liveRace: Live, result: TickResult, positions: number[]): void {
    const packedPositions = concatHex(positions.map((position) => toHex(position, { size: 2 })))
    this.raceRepository
      .addTick({
        room_id: liveRace.roomId,
        race_id: String(liveRace.raceId),
        seq: liveRace.engine!.step - 1,
        step: result.step,
        blk: String(liveRace.startBlock! + result.step),
        positions: packedPositions,
        tx_hash: result.hash,
        included_block: String(result.includedBlock),
        status: 'success',
        gas_limit: result.gasLimit,
        submit_to_receipt_ms: result.durationMs,
      })
      .catch((error) => console.warn(`[race] room ${liveRace.code} tick row ${result.step}:`, error.message))
  }

  private async finish(liveRace: Live): Promise<void> {
    if (liveRace.status !== 'race') return

    const engine = liveRace.engine!
    liveRace.status = 'results'
    const ranking = engine.ranking()
    const rows: RankRow[] = ranking.map((duck, position) => ({
      rank: position + 1,
      name: duck.name,
      address: duck.address,
      human: duck.human,
      progress: Math.round(Math.min(duck.progress, PROGRESS_CAP_PPM) / 100),
    }))
    const podium = rows.slice(0, 3).map((row) => (row.address || zeroAddress) as Address) as [Address, Address, Address]
    const endBlock = (liveRace.startBlock ?? 0) + engine.step
    const raceRoot = keccak256(
      encodeAbiParameters(
        [{ type: 'uint64' }, { type: 'uint64' }, { type: 'uint64' }, { type: 'address[]' }],
        [BigInt(liveRace.raceId), BigInt(liveRace.startBlock ?? 0), BigInt(endBlock), rows.map((row) => (row.address || zeroAddress) as Address)],
      ),
    )
    const cheerLogRoot = cheersRoot(liveRace.log)
    const resultsRoot = standingRoot(raceRoot, cheerLogRoot)
    const result = {
      raceId: liveRace.raceId,
      startBlock: liveRace.startBlock,
      endBlock,
      resultsRoot,
      cheersRoot: cheerLogRoot,
      cheers: liveRace.log,
      field: rows.length,
      ranking: rows.map((row, position) => ({ ...row, title: titleFor(row.rank), color: ranking[position].color, i: ranking[position].index })),
    }
    liveRace.last = result
    broadcast(liveRace.code, 'race:result', result)

    await Promise.allSettled(liveRace.ticks)

    let minted: { address: string; kind: number }[] = []
    let finalizeTransaction: { hash: string; url: string | null } | null = null

    try {
      const transaction = await relayer.finalize(liveRace.chainRoomId, resultsRoot, podium)
      finalizeTransaction = { hash: transaction.hash, url: transaction.url }
      minted = relayer.achievements(transaction)
    } catch (error) {
      console.warn(`[race] room ${liveRace.code} finalize failed:`, (error as any)?.shortMessage || (error as Error).message)
    }

    const room = await this.roomService.mustGet(liveRace.code)
    await room.update({ status: finalizeTransaction ? 'closed' : 'lobby' })
    liveRace.status = finalizeTransaction ? 'closed' : 'lobby'

    if (liveRace.row) {
      await this.raceRepository.finish(liveRace.row, {
        end_block: String(endBlock),
        ranking: rows,
        podium,
        results_root: resultsRoot,
        cheers: liveRace.log,
        cheers_root: cheerLogRoot,
        status: finalizeTransaction ? 'settled' : 'failed',
      })

      if (finalizeTransaction) await liveRace.row.update({ settle_tx: finalizeTransaction.hash })
    }

    for (const row of rows) {
      if (!row.human || !row.address) continue

      const duck = await this.duckRepository.byAddress(row.address)

      if (!duck) continue

      const mintedCount = minted.filter((achievement) => achievement.address.toLowerCase() === row.address!.toLowerCase()).length
      await duck.update({ races: duck.races + 1, titles: duck.titles + mintedCount, best_rank: duck.best_rank === null ? row.rank : Math.min(duck.best_rank, row.rank) })
    }

    const titles = minted.map((achievement) => ({ address: achievement.address, rank: achievement.kind + 1, title: ACHIEVEMENT_TITLE_BY_KIND[achievement.kind] }))

    for (const title of titles) {
      await this.duckRepository.addTitle({
        address: title.address,
        room_code: liveRace.code,
        race_id: String(liveRace.raceId),
        rank: title.rank,
        title: title.title,
        tx_hash: finalizeTransaction?.hash ?? null,
      })
    }

    broadcast(liveRace.code, 'race:settled', { raceId: liveRace.raceId, tx: finalizeTransaction?.hash ?? null, url: finalizeTransaction?.url ?? null, titles, ok: !!finalizeTransaction })

    if (finalizeTransaction) void this.hatchFirstTimers(liveRace)
  }

  private async hatchFirstTimers(liveRace: Live): Promise<void> {
    const ranking = (liveRace.last as { ranking?: { address: string | null; human: boolean }[] } | null)?.ranking ?? []

    for (const row of ranking) {
      if (!row.human || !row.address) continue

      try {
        const duck = await this.duckRepository.byAddress(row.address)

        if (!duck || duck.status !== 'egg') continue

        await duck.update({ status: 'hatched' })
        broadcast(liveRace.code, 'duck:hatched', { address: row.address })
      } catch (error) {
        console.error(`[hatch] room ${liveRace.code} player ${row.address}:`, (error as any)?.shortMessage || (error as Error).message)
      }
    }
  }
}
