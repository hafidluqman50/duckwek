import { IUpdateDuck } from '@Interfaces/IUpdateDuck'

export class DuckUpdateDTO {
  public address: string
  public name: string
  public template: IUpdateDuck['template']
  public bodyColor: string
  public billColor: string
  public cosmetics: IUpdateDuck['cosmetics']
  public equippedPartTypeId: number | null

  constructor(input: IUpdateDuck) {
    this.address = input.address.toLowerCase()
    this.name = input.name.trim().slice(0, 14)
    this.template = input.template
    this.bodyColor = input.bodyColor.toUpperCase()
    this.billColor = input.billColor.toUpperCase()
    this.cosmetics = { hat: !!input.cosmetics?.hat, shades: !!input.cosmetics?.shades, scarf: !!input.cosmetics?.scarf }
    this.equippedPartTypeId = input.equippedPartTypeId ?? null
  }
}
