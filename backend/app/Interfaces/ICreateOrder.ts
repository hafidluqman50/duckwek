export type OrderKindName = 'create_room' | 'join_room' | 'buy_part'

export interface ICreateOrder {
  payer: string
  kind: OrderKindName
  trackId?: number
  roomName?: string
  maxDucks?: number
  fillBots?: boolean
  roomCode?: string
  partTypeId?: number
}
