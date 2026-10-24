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

  constructor(data: ICreateOrder) {
    this.payer = data.payer.toLowerCase() as `0x${string}`
    this.kind = data.kind
    this.trackId = data.trackId ?? null
    this.roomName = (data.roomName || 'DuckWek Room').trim()
    this.maxDucks = data.maxDucks ?? 50
    this.fillBots = data.fillBots ?? true
    this.roomCode = data.roomCode ? data.roomCode.toUpperCase() : null
    this.partTypeId = data.partTypeId ?? null
  }
}
