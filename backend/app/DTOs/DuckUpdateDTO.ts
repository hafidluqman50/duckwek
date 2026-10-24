import { IUpdateDuck } from '@Interfaces/IUpdateDuck'

export class DuckUpdateDTO {
  public address: string
  public name: string
  public template: IUpdateDuck['template']
  public bodyColor: string
  public billColor: string
  public cosmetics: IUpdateDuck['cosmetics']
  public equippedPartTypeId: number | null

  constructor(data: IUpdateDuck) {
    this.address = data.address.toLowerCase()
    this.name = data.name.trim().slice(0, 14)
    this.template = data.template
    this.bodyColor = data.bodyColor.toUpperCase()
    this.billColor = data.billColor.toUpperCase()
    this.cosmetics = { hat: !!data.cosmetics?.hat, shades: !!data.cosmetics?.shades, scarf: !!data.cosmetics?.scarf }
    this.equippedPartTypeId = data.equippedPartTypeId ?? null
  }
}
