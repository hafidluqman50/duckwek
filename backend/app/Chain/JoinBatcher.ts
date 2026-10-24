import { parseEventLogs, type Address } from 'viem'
import { env } from '@config/env'
import { raceAbi } from './abis'
import { relayer, revertReason, type OrderArg, type PermitArg, type TxResult } from './Relayer'

interface Pending {
  order: OrderArg
  permit: PermitArg
  resolve: (r: TxResult) => void
  reject: (e: Error) => void
}

interface RoomQueue {
  queue: Pending[]
  timer: NodeJS.Timeout | null
  inflight: number
}

/**
 * 200 phones joining within seconds become a handful of joinBatch transactions per room. Joins are collected for
 * `windowMs` (or until `max`) and sent as one transaction. The contract charges every ticket under the payer's session
 * (permit + transferFrom); a ticket that cannot be charged emits JoinFailed and does not block the others, so each
 * caller gets its own answer from the Joined / JoinFailed logs of the receipt.
 */
export class JoinBatcher {
  private rooms = new Map<number, RoomQueue>()

  constructor(private windowMs = env.joinBatchWindowMs, private max = env.joinBatchMax) {}

  private room(id: number): RoomQueue {
    let r = this.rooms.get(id)
    if (!r) this.rooms.set(id, (r = { queue: [], timer: null, inflight: 0 }))
    return r
  }

  submit(chainRoomId: number, order: OrderArg, permit: PermitArg): Promise<TxResult> {
    return new Promise((resolve, reject) => {
      const r = this.room(chainRoomId)
      r.queue.push({ order, permit, resolve, reject })
      if (r.queue.length >= this.max) void this.flush(chainRoomId)
      else if (!r.timer) r.timer = setTimeout(() => void this.flush(chainRoomId), this.windowMs)
    })
  }

  /** Sends whatever is queued for this room right now. */
  async flush(chainRoomId: number): Promise<void> {
    const r = this.room(chainRoomId)
    if (r.timer) clearTimeout(r.timer)
    r.timer = null
    const batch = r.queue.splice(0, this.max)
    if (!batch.length) return
    r.inflight++
    try {
      const tx = await relayer.joinBatch(chainRoomId, batch.map((b) => b.order), batch.map((b) => b.permit))
      const events = parseEventLogs({ abi: raceAbi, logs: tx.logs })
      const joined = new Set<string>()
      const failed = new Map<string, string>()
      for (const ev of events) {
        if (ev.eventName === 'Joined') joined.add((ev.args.player as Address).toLowerCase())
        else if (ev.eventName === 'JoinFailed') failed.set((ev.args.player as Address).toLowerCase(), revertReason(ev.args.reason))
      }
      for (const b of batch) {
        const who = b.order.payer.toLowerCase()
        if (joined.has(who)) b.resolve(tx)
        else b.reject(new Error(failed.get(who) || 'Join was not recorded on-chain'))
      }
    } catch (e) {
      for (const b of batch) b.reject(e as Error)
    } finally {
      r.inflight--
    }
    if (r.queue.length) void this.flush(chainRoomId)
  }

  /** Resolves once nothing is queued or in flight for this room (the race must not start before every join is on-chain). */
  async idle(chainRoomId: number, timeoutMs = 20_000): Promise<void> {
    const t0 = Date.now()
    const r = this.room(chainRoomId)
    if (r.queue.length) await this.flush(chainRoomId)
    while ((r.queue.length || r.inflight) && Date.now() - t0 < timeoutMs) await new Promise((res) => setTimeout(res, 100))
  }
}

export const joinBatcher = new JoinBatcher()
