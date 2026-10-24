export type Template = 'balanced' | 'sprint' | 'tank'
export interface Cosmetics { hat: boolean; shades: boolean; scarf: boolean }

export interface DuckLook {
  template: Template
  bodyColor: string
  billColor: string
  cosmetics: Cosmetics
  partTypeId: number | null
}

export interface Duck extends Omit<DuckLook, 'partTypeId'> {
  name: string
  equippedPartTypeId: number | null
  races: number
  titles: number
  bestRank: number | null
  status: 'egg' | 'hatching' | 'hatched' | 'failed'
  tokenId: string | null
  hatchTx: string | null
}

export interface Me {
  address: string
  duck: Duck | null
  usdc: string
  earnings: string
  parts: number[]
  titles: { title: string; rank: number; room: string; raceId: string; tx: string | null }[]
  activity: { kind: string; amount: string; status: string; tx: string | null; room: string | null; label: string }[]
}

export interface Track {
  id: number | null
  slug: string
  name: string
  description: string
  rentPrice: string
  laps: number
  turns: number
  lengthM: number
  closed: boolean
  path: number[][]
  sectors: number[]
  profile: { speed: number; weight: number; boost: number; lapTicks: number }
  platform: boolean
  status: 'active' | 'coming_soon'
}

export interface Part {
  typeId: number
  name: string
  rarity: string
  slot: 'wings' | 'tail' | 'bill'
  speed: number
  weight: number
  boost: number
  price: string
  platform: boolean
  status: string
  fit: Record<string, number>
}

export interface RoomPlayer extends DuckLook {
  address: string
  name: string
  host: boolean
}

export interface RoomState {
  code: string
  name: string
  host: string
  hostName: string
  track: Track
  maxDucks: number
  fillBots: boolean
  status: string
  players: RoomPlayer[]
  count: number
  lastResult?: RaceResult | null
}

export interface GridEntrant extends DuckLook {
  i: number
  name: string
  address: string | null
  human: boolean
  color: string
}

export interface Grid { raceId: number; laps: number; countdown: number; cheerPct?: number; entrants: GridEntrant[] }
export interface Tick { raceId: number; b: number; n?: number; t?: number; p: number[]; en?: number[]; ev: { type: string; name: string; human: boolean }[]; tx?: string }
export interface RankRow { rank: number; name: string; address: string | null; human: boolean; progress: number; title: string; color: string; i: number }
export interface RaceResult { raceId: number; startBlock: number; endBlock: number; resultsRoot: string; field: number; ranking: RankRow[] }
export interface Settled { raceId: number; tx: string | null; url: string | null; titles: { address: string; rank: number; title: string }[]; ok: boolean }

export const TEMPLATES: Record<Template, { name: string; tag: string; st: [number, number, number] }> = {
  balanced: { name: 'Balanced', tag: 'Good on every track', st: [3, 3, 3] },
  sprint: { name: 'Sprint', tag: 'Fast, light, loves straights', st: [5, 4, 2] },
  tank: { name: 'Tank', tag: 'Heavy, grippy, big late boost', st: [2, 5, 5] },
}
export const BODY_COLORS: [string, string][] = [['#FFC93C', 'Duck yellow'], ['#FFFFFF', 'White'], ['#FF7AB6', 'Pink'], ['#4ED1C5', 'Teal'], ['#7CC6FE', 'Sky'], ['#B8F35A', 'Lime'], ['#FF9F1C', 'Orange'], ['#C9B8FF', 'Lilac'], ['#F25F5C', 'Red'], ['#836EF9', 'Monad purple'], ['#2B2B2B', 'Black'], ['#9BE7FF', 'Ice']]
export const BILL_COLORS: [string, string][] = [['#FF9F1C', 'Orange'], ['#FFC93C', 'Yellow'], ['#FF7AB6', 'Pink'], ['#1E1446', 'Ink']]
const PRE = ['Quack', 'Buroq', 'Wek', 'Paddle', 'Monad', 'Bebek', 'Mallard', 'Splash', 'Feather', 'Bill', 'Tiki', 'Jogja', 'Gudeg', 'Merapi']
const SUF = ['Jr', 'King', 'Queen', 'Bro', 'Max', 'X', '77', 'Boy', 'Gang', 'Pro', 'Zz', 'One']
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
export const randomName = () => pick(PRE) + pick(SUF)
export const randomDuck = (): Omit<Duck, 'races' | 'titles' | 'bestRank' | 'status' | 'tokenId' | 'hatchTx'> => ({
  name: randomName(),
  template: pick<Template>(['balanced', 'sprint', 'tank']),
  bodyColor: pick(BODY_COLORS)[0],
  billColor: pick(BILL_COLORS)[0],
  cosmetics: { hat: Math.random() < 0.5, shades: Math.random() < 0.4, scarf: Math.random() < 0.3 },
  equippedPartTypeId: null,
})
export const statsOf = (t: Template, part?: Part | null): [number, number, number] => {
  const b = TEMPLATES[t]?.st || TEMPLATES.balanced.st
  return part ? [b[0] + part.speed, b[1] + part.weight, b[2] + part.boost] : b
}
export const titleFor = (rank: number) => (rank === 1 ? 'ABSOLUTE MARVELOUS' : rank <= 3 ? 'PODIUM PADDLER' : rank <= 10 ? 'TOP TEN TORPEDO' : 'BRAVE LITTLE DUCK')
export const dots = (n: number) => '●●●'.slice(0, n) + '○○○'.slice(0, 3 - n)
export const sgn = (n: number) => (n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0')
