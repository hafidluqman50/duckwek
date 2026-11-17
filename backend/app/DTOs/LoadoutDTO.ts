import { ILoadout } from '@Interfaces/ILoadout'

export class LoadoutDTO {
  public address: string
  public roomCode: string
  public partTypeId: number | null
  constructor(input: ILoadout) {
    this.address = input.address.toLowerCase()
    this.roomCode = input.roomCode.toUpperCase()
    this.partTypeId = input.partTypeId ?? null
  }
}
