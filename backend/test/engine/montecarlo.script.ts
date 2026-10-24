/**
 * T-5: offline Monte Carlo of the pure engine. No chain, no MON.
 *   MODE=baseline|tuned RACES=200 npx ts-node -T -r tsconfig-paths/register test/engine/montecarlo.script.ts
 * Prints per track: win share per template and per part (bound: no entry above 1.5x the average share), and how often
 * the lead and the top 10 change per race. `baseline` switches the catch-up off (the engine before plan v1.4).
 */
import { keccak256, toHex } from 'viem'
import { CHEER, Race, TUNING, statsFor, type Entrant, type Profile, type Taps, type Template } from '../../app/Engine/Race'

const MODE = process.env.MODE || 'tuned'
const RACES = Number(process.env.RACES || 200)
const FIELD = Number(process.env.FIELD || 120)
if (MODE === 'baseline') TUNING.catchupDiv = Infinity
if (process.env.TUNE) Object.assign(TUNING, JSON.parse(process.env.TUNE, (_k, v) => (v === 'Infinity' ? Infinity : v)))
if (process.env.CHEER_TUNE) Object.assign(CHEER, JSON.parse(process.env.CHEER_TUNE))
// CHEER=1: a third of the ducks are humans who tap at the cap (1 or 2 taps per step, 1.5 on average), a third are humans who never tap,
// a third are bots (they never tap). The three groups are spread evenly over every template and part.
const CHEER_ON = !!process.env.CHEER
const modeOf = (i: number) => Math.floor(i / 12) % 3 // 0 taps at the cap, 1 never taps, 2 bot
const QUIET = !!process.env.QUIET // one JSON line per track, for the parameter search
const TARGET: Record<string, number> = { kali: 34, alpine: 76 } // race length of the engine before plan v1.4 (steps)
const CALIBRATE = !!process.env.CALIBRATE // adjust TUNING.base so the average race keeps that length

const PARTS = [null, { n: 'wings', speed: 2, weight: 0, boost: -1 }, { n: 'tail', speed: 1, weight: 1, boost: 0 }, { n: 'bill', speed: -1, weight: 1, boost: 2 }]
const TEMPLATES: Template[] = ['balanced', 'sprint', 'tank']
const TRACKS: [string, Profile, number][] = [['kali', { speed: 0.8, weight: 0.4, boost: 1, lapTicks: 35 }, 1], ['alpine', { speed: 1.2, weight: 0.9, boost: 1, lapTicks: 40 }, 2]]

const inversions = (a: number[], b: number[]): number => { // pairs in the top 10 of `a` whose order is different in `b`
  const posB = new Map(b.map((idx, i) => [idx, i]))
  let c = 0
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if ((posB.get(a[i]) ?? 99) > (posB.get(a[j]) ?? 99)) c++
  return c
}

const field = (n: number): Entrant[] => Array.from({ length: n }, (_, i) => {
  const t = TEMPLATES[i % 3], p = PARTS[Math.floor(i / 3) % 4]
  return { id: `${t}:${p?.n ?? 'stock'}:${i}:${CHEER_ON ? ['cap', 'idle', 'bot'][modeOf(i)] : 'bot'}`, name: 'd' + i, color: '#fff', human: CHEER_ON && modeOf(i) !== 2, address: null, stats: statsFor(t, p), build: '' }
})
// taps of the human ducks in one step (a tapper alternates 1 and 2)
const tapsOf = (n: number, count: number): Taps => { const t: Taps = {}; for (let i = 0; i < count; i++) if (modeOf(i) === 0) t[i] = 1 + ((n + i) % 2); return t }
const meanSteps = (track: string, profile: Profile, laps: number, races: number, tag: string): number => {
  let st = 0
  for (let s = 1; s <= races; s++) { const r = new Race({ raceId: s, seed: keccak256(toHex(`${tag}:${s}`)), entrants: field(60), profile, laps }); let n = 0; while (!r.done && n < 500) r.advanceTo(++n); st += r.step }
  return st / races
}
if (!QUIET) console.log(`mode=${MODE} ${JSON.stringify(TUNING)} races=${RACES} field=${FIELD}`)
for (const [track, profile, laps] of TRACKS) {
  if (CALIBRATE) {
    const base0 = TUNING.base
    for (let it = 0; it < 5; it++) { const m = meanSteps(track, profile, laps, 25, 'cal'); TUNING.base = Math.round(TUNING.base * (1 + (m / TARGET[track] - 1) * 0.9)) }
  }
  const winsT: Record<string, number> = {}, winsP: Record<string, number> = {}, winsM: Record<string, number> = {}
  let lead = 0, swaps = 0, steps = 0
  for (let s = 1; s <= RACES; s++) {
    const entrants = field(FIELD)
    const r = new Race({ raceId: s, seed: keccak256(toHex(`mc:${s}`)), entrants, profile, laps })
    let n = 0, prevTop: number[] = []
    while (!r.done && n < 500) {
      r.advanceTo(++n, CHEER_ON ? (step) => tapsOf(step, FIELD) : undefined)
      const top = [...r.ducks].sort((x, y) => y.p - x.p || (x.tie > y.tie ? -1 : 1)).slice(0, 10).map((d) => d.idx)
      if (prevTop.length) swaps += inversions(prevTop, top)
      prevTop = top
    }
    lead += r.leadChanges
    steps += r.step
    const w = r.ranking()[0].id.split(':')
    winsT[w[0]] = (winsT[w[0]] || 0) + 1
    winsP[w[1]] = (winsP[w[1]] || 0) + 1
    winsM[w[3]] = (winsM[w[3]] || 0) + 1
  }
  if (QUIET) {
    const ratio = (m: Record<string, number>, groups: number) => Math.max(...Object.values(m)) / RACES * groups
    const keep = (m: Record<string, number>, groups: number) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, +(v / RACES * groups).toFixed(2)]))
    console.log(JSON.stringify({ track, tune: { ...TUNING }, cheer: CHEER_ON ? { ...CHEER } : null, mode: keep(winsM, 3), steps: +(steps / RACES).toFixed(1), lead: +(lead / RACES).toFixed(2), swaps: +(swaps / RACES).toFixed(0), maxTemplate: +ratio(winsT, 3).toFixed(2), maxPart: +ratio(winsP, 4).toFixed(2), tpl: keep(winsT, 3), part: keep(winsP, 4) }))
    continue
  }
  const share = (m: Record<string, number>, groups: number) => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${(v / RACES * 100).toFixed(1)}% (${(v / RACES * groups).toFixed(2)}x)`).join('  ')
  console.log(`${track}: steps/race ${(steps / RACES).toFixed(1)} | lead changes/race ${(lead / RACES).toFixed(2)} | top-10 swaps/race ${(swaps / RACES).toFixed(1)}`)
  console.log(`  by template: ${share(winsT, 3)}`)
  console.log(`  by part:     ${share(winsP, 4)}`)
  if (CHEER_ON) console.log(`  by tapping:  ${share(winsM, 3)}   (cap = taps 1.5 per step, idle = a human who never taps, bot = never taps; 1.00x = equal)`)
}
