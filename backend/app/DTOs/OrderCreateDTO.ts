import { ICreateOrder, OrderKindName } from '@Interfaces/ICreateOrder'

export class OrderCreateDTO {
  public payer: `0x${string}`
  public kind: OrderKindName
  public trackId: number | null
  public roomName: string
  public maxDucks: number
  public fillBots: boolean
  public roomCode: string | null
  public partTypeId: number | null

  constructor(input: ICreateOrder) {
    this.payer = input.payer.toLowerCase() as `0x${string}`
    this.kind = input.kind
    this.trackId = input.trackId ?? null
    this.roomName = (input.roomName || 'DuckWek Room').trim()
    this.maxDucks = input.maxDucks ?? 50
    this.fillBots = input.fillBots ?? true
    this.roomCode = input.roomCode ? input.roomCode.toUpperCase() : null
    this.partTypeId = input.partTypeId ?? null
  }
}
