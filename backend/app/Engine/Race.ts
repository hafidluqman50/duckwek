// Pure race engine. No I/O. Every duck's progress is a deterministic function of (seed, step, duck index, track profile):
// the seed comes from the contract (`Started` event), the step from the contract (`Tick` event: block.number - startBlock).
// Anyone can replay a race from the seed, the participant list and the step numbers and reproduce every position.
// All arithmetic is integer: progress is in ppm (1_000_000 = the finish line) and randomness is keccak256 output, so an
// independent re-implementation (or a future on-chain check) gets the same numbers.
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

/** Track profile as stored (floats from the seeder). */
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
  idx: number
  p: number // ppm of the whole race distance
  finishedAt: number | null // step * 1e6 + fraction in ppm (integer)
  tie: bigint
}

export interface RaceEvent {
  type: 'boost' | 'leader' | 'splash'
  name: string
  human: boolean
}

export const SCALE = 1_000_000
export const FINISH = SCALE
const OVERRUN = 60_000 // ducks keep gliding a little past the line
const BOOST_ZONE = 650_000
const BASE_TICKS = 35
const POST_FINISH_STEPS = 3

/**
 * Weights of the engine, ppm of progress per step before the track scale. Chosen with the offline run
 * (test/engine/montecarlo.script.ts, plan §3.5 and §11): no template and no part wins more than 1.5x its average share on
 * Kali or Alpine, and the lead changes about 40 % (Kali) and 60 % (Alpine) more often than without the catch-up.
 */
export const TUNING = { base: 24_800, speedC: 350, weightC: 200, boostC: 900, noiseC: 40, splashBase: 35_000, catchupDiv: 20 }

/**
 * Cheer (plan §3.10). A duck has energy; each accepted tap adds `tapUnit`, every step takes `decay`, the energy stays in 0..`eMax`
 * (thousandths of a tap). The step gain is multiplied by `1 + cheerMax * energy / eMax`. A duck that nobody cheers (a bot, or a
 * human who does not tap) has no energy, so an idle human and a bot are equal and tapping is what lifts a duck above them.
 * Chosen with test/engine/rank.script.ts (a room of 50 with a tapper and an idler, 300 races per setting), see plan §11.12:
 * at 6 % a duck that started tapping in mid-race from the middle of the field only reached about 15th to 19th (the owner: not useful);
 * at 20 % it ends about 6th on Kali and 3rd on Alpine, at 35 % it wins almost every race. Plan §11.13.
 */
export const CHEER = { cheerMax: 200_000, eMax: 8_000, decay: 500, tapUnit: 1_000 }

/** Accepted taps of one step: duck index to number of taps (sparse). */
export type Taps = Record<number, number>

const trunc = Math.trunc

export function statsFor(template: Template, part: PartStats | null): [number, number, number] {
  const base = (TEMPLATES[template] || TEMPLATES.balanced).stats
  const d = part ? [part.speed, part.weight, part.boost] : [0, 0, 0]
  return base.map((v, i) => Math.max(0, v + d[i])) as [number, number, number]
}

// ---- randomness: keccak256 output, domain separated, converted to ppm integers -----------------------------------

const word = (h: Hex, i: number): number => parseInt(h.slice(2 + i * 8, 10 + i * 8), 16)
const ppm = (u32: number): number => trunc((u32 * SCALE) / 4294967296)

/** Two independent draws for one duck on one step: noise `r` and the splash roll `r2`, both in ppm. */
export function drawStep(seed: Hex, n: number, idx: number): { r: number; r2: number } {
  const h = keccak256(encodePacked(['bytes32', 'uint8', 'uint32', 'uint16'], [seed, 1, n, idx]))
  return { r: ppm(word(h, 0)), r2: ppm(word(h, 1)) }
}

/** Final tie-break, fixed per duck and race: the order of two ducks that are equal in everything else depends on the seed only. */
export function tieKey(seed: Hex, idx: number): bigint {
  return BigInt(keccak256(encodePacked(['bytes32', 'uint8', 'uint16'], [seed, 3, idx])))
}

// ---- one step ------------------------------------------------------------------------------------------------

export interface Pm {
  speed: number
  weight: number
  boost: number
  lapTicks: number
}
export const permille = (p: Profile): Pm => ({ speed: Math.round(p.speed * 1000), weight: Math.round(p.weight * 1000), boost: Math.round(p.boost * 1000), lapTicks: p.lapTicks })

/**
 * Progress gained in one step, ppm. Trade-offs (FINANCE.md rule 4: no part wins on every track): speed helps everywhere but
 * more on long straights, weight is drag on fast tracks, boost only kicks in on the final 35%. The catch-up toward the leader
 * (a duck that is behind gains a little, in proportion to the gap) is what makes overtaking frequent. Noise and the splash
 * chance are the same for every duck, so ducks with identical stats have identical odds.
 */
export function stepFor(stats: [number, number, number], progress: number, leader: number, r: number, r2: number, pm: Pm, laps: number, cheerPpm = 0): number {
  const [speed, weight, boost] = stats
  let dv = TUNING.base + trunc((speed * TUNING.speedC * pm.speed) / 1000) - trunc((weight * TUNING.weightC * pm.weight) / 1000)
  dv += trunc(((r - 500_000) * TUNING.noiseC) / 1000)
  dv += trunc(Math.max(0, leader - progress) / TUNING.catchupDiv)
  if (progress > BOOST_ZONE) dv += trunc((boost * TUNING.boostC * pm.boost) / 1000)
  if (r2 < TUNING.splashBase) dv -= 12_000 // splash: lost a beat
  const gain = trunc((Math.max(0, dv) * BASE_TICKS) / (pm.lapTicks * laps)) // a duck never swims backwards
  return trunc((gain * (SCALE + cheerPpm)) / SCALE)
}

const BOT_PRE = ['Quack', 'Buroq', 'Wek', 'Paddle', 'Monad', 'Bebek', 'Mallard', 'Splash', 'Feather', 'Bill', 'Tiki', 'Jogja', 'Gudeg', 'Merapi']
const BOT_SUF = ['Jr', 'King', 'Queen', 'Bro', 'Max', 'X', '77', 'Boy', 'Gang', 'Pro', 'Zz', 'One']
export const PALETTE = ['#ffffff', '#FF7AB6', '#4ED1C5', '#FF9F1C', '#7CC6FE', '#B8F35A', '#C9B8FF', '#F25F5C', '#9BE7FF', '#FFE59A']
export function botName(i: number): string {
  return BOT_PRE[(i * 7) % BOT_PRE.length] + BOT_SUF[(i * 5 + 3) % BOT_SUF.length]
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
  pm: Pm
  laps: number
  ducks: DuckState[]
  /** Last step that was computed. Steps are numbered like the contract's `Tick.n` (first tick is 1). */
  step = 0
  postFinishSteps = 0
  done = false
  leaderIdx: number | null = null
  leadChanges = 0
  /** Cheer energy per duck, thousandths of a tap (0..CHEER.eMax). */
  energy: number[]

  constructor(opts: { raceId: number; seed: Hex; entrants: Entrant[]; profile: Profile; laps: number }) {
    this.raceId = opts.raceId
    this.seed = opts.seed
    this.pm = permille(opts.profile)
    this.laps = Math.max(1, opts.laps)
    this.ducks = opts.entrants.map((e, i) => ({ ...e, idx: i, p: 0, finishedAt: null, tie: tieKey(opts.seed, i) }))
    this.energy = this.ducks.map(() => 0)
  }

  get expectedSteps(): number {
    return this.pm.lapTicks * this.laps
  }

  /**
   * Computes every step after the last one up to `n` (steps that no receipt reported are filled here, nothing freezes).
   * `cheers(step)` gives the accepted taps of the human ducks in that step (the cheer log); bots never tap.
   */
  advanceTo(n: number, cheers?: (step: number) => Taps | undefined): RaceEvent[] {
    const events: RaceEvent[] = []
    while (!this.done && this.step < n) events.push(...this.stepOnce(this.step + 1, cheers?.(this.step + 1)))
    return events
  }

  /** Energy as a whole percent per duck (0..100), for the screens. */
  boost(): number[] {
    return this.energy.map((e) => Math.round((e * 100) / CHEER.eMax))
  }

  private stepOnce(n: number, taps?: Taps): RaceEvent[] {
    this.step = n
    const leaderP = this.ducks.reduce((m, d) => Math.max(m, d.p), 0)
    const events: RaceEvent[] = []
    for (const d of this.ducks) {
      if (d.p >= FINISH + OVERRUN) continue
      const before = d.p
      const { r, r2 } = drawStep(this.seed, n, d.idx)
      const t = d.human ? (taps?.[d.idx] ?? 0) : 0
      const e = Math.max(0, Math.min(CHEER.eMax, this.energy[d.idx] - CHEER.decay + t * CHEER.tapUnit))
      this.energy[d.idx] = e
      d.p += stepFor(d.stats, d.p, leaderP, r, r2, this.pm, this.laps, trunc((CHEER.cheerMax * e) / CHEER.eMax))
      if (before <= BOOST_ZONE && d.p > BOOST_ZONE && d.stats[2] >= 4) events.push({ type: 'boost', name: d.name, human: d.human })
      if (before < FINISH && d.p >= FINISH && d.finishedAt === null) d.finishedAt = n * SCALE + trunc(((FINISH - before) * SCALE) / (d.p - before))
    }
    const leader = this.leader()
    if (this.leaderIdx !== null && leader.idx !== this.leaderIdx) {
      this.leadChanges++
      if (leader.p < FINISH && n > 6) events.push({ type: 'leader', name: leader.name, human: leader.human })
    }
    this.leaderIdx = leader.idx
    if (leader.p >= FINISH) this.postFinishSteps++
    if (this.postFinishSteps >= POST_FINISH_STEPS) this.done = true
    return events
  }

  /** Highest progress; ties go to the larger tieKey, so the leader never depends on join order. */
  leader(): DuckState {
    let best = this.ducks[0]
    for (const d of this.ducks) if (d.p > best.p || (d.p === best.p && d.tie > best.tie)) best = d
    return best
  }

  /** Finished ducks by finish time, then the rest by progress; equal in both, the larger tieKey is ahead (strict total order). */
  ranking(): DuckState[] {
    return [...this.ducks].sort((a, b) => {
      if (a.finishedAt !== null && b.finishedAt !== null) {
        if (a.finishedAt !== b.finishedAt) return a.finishedAt - b.finishedAt
      } else if (a.finishedAt !== null) return -1
      else if (b.finishedAt !== null) return 1
      else if (a.p !== b.p) return b.p - a.p
      return a.tie === b.tie ? 0 : a.tie > b.tie ? -1 : 1
    })
  }

  /** Compact positions for the projector and the database: progress * 10000 as ints, in entrant order. */
  positions(): number[] {
    return this.ducks.map((d) => Math.round(Math.min(d.p, FINISH + OVERRUN) / 100))
  }
}
