export interface IUpdateDuck {
  address: string
  name: string
  template: 'balanced' | 'sprint' | 'tank'
  bodyColor: string
  billColor: string
  cosmetics: { hat: boolean; shades: boolean; scarf: boolean }
  equippedPartTypeId: number | null
}
