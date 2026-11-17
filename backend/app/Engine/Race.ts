import { encodePacked, keccak256, type Hex } from 'viem'

export type Template = 'balanced' | 'sprint' | 'tank'

export const TEMPLATES: Record<Template, { name: string; stats: [number, number, number]; id: number }> = {
  balanced: { name: 'Balanced', stats: [3, 3, 3], id: 0 },
  sprint: { name: 'Sprint', stats: [5, 4, 2], id: 1 },
  tank: { name: 'Tank', stats: [2, 5, 5], id: 2 },
}

export interface PartStats {
  speed: number
  weight: number
  boost: number
}

export interface Profile {
  speed: number
  weight: number
  boost: number
  lapTicks: number
}

export interface Entrant {
  id: string
  name: string
  color: string
  human: boolean
  address: string | null
  stats: [number, number, number]
  build: string
}

export interface DuckState extends Entrant {
  index: number
  progress: number
  finishedAt: number | null
  tie: bigint
}

export interface RaceEvent {
  type: 'boost' | 'leader' | 'splash'
  name: string
  human: boolean
}

export const SCALE = 1_000_000
export const FINISH = SCALE
const OVERRUN = 60_000
const BOOST_ZONE = 650_000
const BASE_TICKS = 35
const POST_FINISH_STEPS = 3
const SPLASH_PENALTY = 12_000

export const TUNING = { base: 24_800, speedCoefficient: 350, weightCoefficient: 200, boostCoefficient: 900, noiseCoefficient: 40, splashThreshold: 35_000, catchupDivisor: 20 }

export const CHEER = { cheerMax: 200_000, energyMax: 8_000, decay: 500, tapUnit: 1_000 }

export type Taps = Record<number, number>

const trunc = Math.trunc

export function statsFor(template: Template, part: PartStats | null): [number, number, number] {
  const baseStats = (TEMPLATES[template] || TEMPLATES.balanced).stats
  const partDeltas = part ? [part.speed, part.weight, part.boost] : [0, 0, 0]

  return baseStats.map((value, statIndex) => Math.max(0, value + partDeltas[statIndex])) as [number, number, number]
}

const wordAt = (hash: Hex, wordIndex: number): number => parseInt(hash.slice(2 + wordIndex * 8, 10 + wordIndex * 8), 16)
const toPpm = (unsigned32: number): number => trunc((unsigned32 * SCALE) / 4294967296)

export function drawStep(seed: Hex, step: number, duckIndex: number): { noise: number; splashRoll: number } {
  const hash = keccak256(encodePacked(['bytes32', 'uint8', 'uint32', 'uint16'], [seed, 1, step, duckIndex]))

  return { noise: toPpm(wordAt(hash, 0)), splashRoll: toPpm(wordAt(hash, 1)) }
}

export function tieKey(seed: Hex, duckIndex: number): bigint {
  return BigInt(keccak256(encodePacked(['bytes32', 'uint8', 'uint16'], [seed, 3, duckIndex])))
}

export interface PermilleProfile {
  speed: number
  weight: number
  boost: number
  lapTicks: number
}

export const permille = (profile: Profile): PermilleProfile => ({
  speed: Math.round(profile.speed * 1000),
  weight: Math.round(profile.weight * 1000),
  boost: Math.round(profile.boost * 1000),
  lapTicks: profile.lapTicks,
})

export function stepFor(
  stats: [number, number, number],
  progress: number,
  leaderProgress: number,
  noise: number,
  splashRoll: number,
  permilleProfile: PermilleProfile,
  laps: number,
  cheerPpm = 0,
): number {
  const [speed, weight, boost] = stats
  let velocity = TUNING.base + trunc((speed * TUNING.speedCoefficient * permilleProfile.speed) / 1000) - trunc((weight * TUNING.weightCoefficient * permilleProfile.weight) / 1000)
  velocity += trunc(((noise - 500_000) * TUNING.noiseCoefficient) / 1000)
  velocity += trunc(Math.max(0, leaderProgress - progress) / TUNING.catchupDivisor)

  if (progress > BOOST_ZONE) velocity += trunc((boost * TUNING.boostCoefficient * permilleProfile.boost) / 1000)

  if (splashRoll < TUNING.splashThreshold) velocity -= SPLASH_PENALTY

  const gain = trunc((Math.max(0, velocity) * BASE_TICKS) / (permilleProfile.lapTicks * laps))

  return trunc((gain * (SCALE + cheerPpm)) / SCALE)
}

const BOT_PREFIXES = ['Quack', 'Kite', 'Wek', 'Paddle', 'Monad', 'Bebek', 'Mallard', 'Splash', 'Feather', 'Bill', 'Tiki', 'Jogja', 'Gudeg', 'Merapi']
const BOT_SUFFIXES = ['Jr', 'King', 'Queen', 'Bro', 'Max', 'X', '77', 'Boy', 'Gang', 'Pro', 'Zz', 'One']
export const PALETTE = ['#ffffff', '#FF7AB6', '#4ED1C5', '#FF9F1C', '#7CC6FE', '#B8F35A', '#C9B8FF', '#F25F5C', '#9BE7FF', '#FFE59A']

export function botName(botIndex: number): string {
  return BOT_PREFIXES[(botIndex * 7) % BOT_PREFIXES.length] + BOT_SUFFIXES[(botIndex * 5 + 3) % BOT_SUFFIXES.length]
}

export function titleFor(rank: number): string {
  if (rank === 1) return 'ABSOLUTE MARVELOUS'

  if (rank <= 3) return 'PODIUM PADDLER'

  if (rank <= 10) return 'TOP TEN TORPEDO'

  return 'BRAVE LITTLE DUCK'
}

export class Race {
  raceId: number
  seed: Hex
  permilleProfile: PermilleProfile
  laps: number
  ducks: DuckState[]
  step = 0
  postFinishSteps = 0
  done = false
  leaderIndex: number | null = null
  leadChanges = 0
  energy: number[]

  constructor(options: { raceId: number; seed: Hex; entrants: Entrant[]; profile: Profile; laps: number }) {
    this.raceId = options.raceId
    this.seed = options.seed
    this.permilleProfile = permille(options.profile)
    this.laps = Math.max(1, options.laps)
    this.ducks = options.entrants.map((entrant, index) => ({ ...entrant, index, progress: 0, finishedAt: null, tie: tieKey(options.seed, index) }))
    this.energy = this.ducks.map(() => 0)
  }

  get expectedSteps(): number {
    return this.permilleProfile.lapTicks * this.laps
  }

  advanceTo(targetStep: number, cheers?: (step: number) => Taps | undefined): RaceEvent[] {
    const events: RaceEvent[] = []

    while (!this.done && this.step < targetStep) events.push(...this.stepOnce(this.step + 1, cheers?.(this.step + 1)))

    return events
  }

  boost(): number[] {
    return this.energy.map((energy) => Math.round((energy * 100) / CHEER.energyMax))
  }

  private stepOnce(step: number, taps?: Taps): RaceEvent[] {
    this.step = step
    const leaderProgress = this.ducks.reduce((highest, duck) => Math.max(highest, duck.progress), 0)
    const events: RaceEvent[] = []

    for (const duck of this.ducks) {
      if (duck.progress >= FINISH + OVERRUN) continue

      const progressBefore = duck.progress
      const { noise, splashRoll } = drawStep(this.seed, step, duck.index)
      const duckTaps = duck.human ? (taps?.[duck.index] ?? 0) : 0
      const energy = Math.max(0, Math.min(CHEER.energyMax, this.energy[duck.index] - CHEER.decay + duckTaps * CHEER.tapUnit))
      this.energy[duck.index] = energy
      duck.progress += stepFor(duck.stats, duck.progress, leaderProgress, noise, splashRoll, this.permilleProfile, this.laps, trunc((CHEER.cheerMax * energy) / CHEER.energyMax))

      if (progressBefore <= BOOST_ZONE && duck.progress > BOOST_ZONE && duck.stats[2] >= 4) events.push({ type: 'boost', name: duck.name, human: duck.human })

      if (progressBefore < FINISH && duck.progress >= FINISH && duck.finishedAt === null) {
        duck.finishedAt = step * SCALE + trunc(((FINISH - progressBefore) * SCALE) / (duck.progress - progressBefore))
      }
    }

    const leader = this.leader()

    if (this.leaderIndex !== null && leader.index !== this.leaderIndex) {
      this.leadChanges++

      if (leader.progress < FINISH && step > 6) events.push({ type: 'leader', name: leader.name, human: leader.human })
    }

    this.leaderIndex = leader.index

    if (leader.progress >= FINISH) this.postFinishSteps++

    if (this.postFinishSteps >= POST_FINISH_STEPS) this.done = true

    return events
  }

  leader(): DuckState {
    let best = this.ducks[0]

    for (const duck of this.ducks) {
      if (duck.progress > best.progress || (duck.progress === best.progress && duck.tie > best.tie)) best = duck
    }

    return best
  }

  ranking(): DuckState[] {
    return [...this.ducks].sort((first, second) => {
      if (first.finishedAt !== null && second.finishedAt !== null) {
        if (first.finishedAt !== second.finishedAt) return first.finishedAt - second.finishedAt
      } else if (first.finishedAt !== null) return -1
      else if (second.finishedAt !== null) return 1
      else if (first.progress !== second.progress) return second.progress - first.progress

      return first.tie === second.tie ? 0 : first.tie > second.tie ? -1 : 1
    })
  }

  positions(): number[] {
    return this.ducks.map((duck) => Math.round(Math.min(duck.progress, FINISH + OVERRUN) / 100))
  }
}
