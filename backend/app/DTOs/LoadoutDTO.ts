import { ILoadout } from '@Interfaces/ILoadout'

export class LoadoutDTO {
  public address: string
  public roomCode: string
  public partTypeId: number | null
  constructor(data: ILoadout) {
    this.address = data.address.toLowerCase()
    this.roomCode = data.roomCode.toUpperCase()
    this.partTypeId = data.partTypeId ?? null
  }
}
