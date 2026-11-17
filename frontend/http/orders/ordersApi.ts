import { api } from '@/http/client'

export type OrderBody =
  | { kind: 'create_room'; trackId: number; roomName: string; maxDucks: number; fillBots: boolean }
  | { kind: 'join_room'; roomCode: string }
  | { kind: 'buy_part'; partTypeId: number }

export interface OrderResult {
  alreadyIn?: boolean
  tx: string
  url: string | null
  kind: OrderBody['kind']
  label: string
  amount: string
  roomCode?: string | null
  partTypeId?: number
  tokenId?: string
  equipped?: boolean
}

export const createOrder = (body: OrderBody) => api<OrderResult>('/api/orders', { method: 'POST', body })
