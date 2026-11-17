import { parseEventLogs, type Address } from 'viem'
import { env } from '@config/env'
import { raceAbi } from './abis'
import { relayer, revertReason, type OrderArg, type PermitArg, type TxResult } from './Relayer'

interface Pending {
  order: OrderArg
  permit: PermitArg
  resolve: (result: TxResult) => void
  reject: (error: Error) => void
}

interface RoomQueue {
  queue: Pending[]
  timer: NodeJS.Timeout | null
  inflight: number
}

export class JoinBatcher {
  private rooms = new Map<number, RoomQueue>()

  constructor(private windowMs = env.joinBatchWindowMs, private max = env.joinBatchMax) {}

  private room(id: number): RoomQueue {
    let roomQueue = this.rooms.get(id)

    if (!roomQueue) this.rooms.set(id, (roomQueue = { queue: [], timer: null, inflight: 0 }))

    return roomQueue
  }

  submit(chainRoomId: number, order: OrderArg, permit: PermitArg): Promise<TxResult> {
    return new Promise((resolve, reject) => {
      const roomQueue = this.room(chainRoomId)
      roomQueue.queue.push({ order, permit, resolve, reject })

      if (roomQueue.queue.length >= this.max) void this.flush(chainRoomId)
      else if (!roomQueue.timer) roomQueue.timer = setTimeout(() => void this.flush(chainRoomId), this.windowMs)
    })
  }

  async flush(chainRoomId: number): Promise<void> {
    const roomQueue = this.room(chainRoomId)

    if (roomQueue.timer) clearTimeout(roomQueue.timer)

    roomQueue.timer = null
    const batch = roomQueue.queue.splice(0, this.max)

    if (!batch.length) return

    roomQueue.inflight++

    try {
      const transaction = await relayer.joinBatch(chainRoomId, batch.map((pending) => pending.order), batch.map((pending) => pending.permit))
      const events = parseEventLogs({ abi: raceAbi, logs: transaction.logs })
      const joined = new Set<string>()
      const failed = new Map<string, string>()

      for (const event of events) {
        if (event.eventName === 'Joined') joined.add((event.args.player as Address).toLowerCase())
        else if (event.eventName === 'JoinFailed') failed.set((event.args.player as Address).toLowerCase(), revertReason(event.args.reason))
      }

      for (const pending of batch) {
        const payer = pending.order.payer.toLowerCase()

        if (joined.has(payer)) pending.resolve(transaction)
        else pending.reject(new Error(failed.get(payer) || 'Join was not recorded on-chain'))
      }
    } catch (error) {
      for (const pending of batch) pending.reject(error as Error)
    } finally {
      roomQueue.inflight--
    }

    if (roomQueue.queue.length) void this.flush(chainRoomId)
  }

  async idle(chainRoomId: number, timeoutMs = 20_000): Promise<void> {
    const startedAt = Date.now()
    const roomQueue = this.room(chainRoomId)

    if (roomQueue.queue.length) await this.flush(chainRoomId)

    while ((roomQueue.queue.length || roomQueue.inflight) && Date.now() - startedAt < timeoutMs) await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

export const joinBatcher = new JoinBatcher()
