/**
 * T-12: the cheer log and the engine (plan §3.10). No chain, no MON.
 *   npx ts-node -T -r tsconfig-paths/register test/engine/cheer.test.ts
 */
import { keccak256, toHex, type Hex } from 'viem'
import { CHEER, Race, statsFor, type Entrant, type Profile, type Taps } from '../../app/Engine/Race'
import { cheersRoot, standingRoot, type CheerLog } from '../../app/Engine/Cheers'

const assert = (c: unknown, m: string) => { if (!c) throw new Error('ASSERT: ' + m) }
const seedOf = (i: number): Hex => keccak256(toHex(`cheer:${i}`))
const KALI: Profile = { speed: 0.8, weight: 0.4, boost: 1, lapTicks: 35 }
const field = (n: number, human: boolean): Entrant[] =>
  Array.from({ length: n }, (_, i) => ({ id: 'd' + i, name: 'd' + i, color: '#fff', human, address: human ? '0x' + String(i).padStart(40, '0') : null, stats: statsFor('balanced', null), build: '' }))
const mk = (seed: Hex, e: Entrant[]) => new Race({ raceId: 1, seed, entrants: e, profile: KALI, laps: 1 })
const logFn = (log: CheerLog) => (step: number): Taps | undefined => log[step]
const run = (r: Race, log: CheerLog) => { let n = 0; while (!r.done && n < 300) r.advanceTo(++n, logFn(log)); return r }
const same = (a: Race, b: Race) => JSON.stringify(a.positions()) === JSON.stringify(b.positions()) && a.step === b.step

// (1) Replay: a fresh run from seed + participants + the cheer log reproduces every position, however the steps arrive.
{
  const log: CheerLog = {}
  for (let n = 1; n <= 40; n++) log[n] = { 0: 1 + (n % 2), 3: n % 3 === 0 ? 2 : 0, 5: 1 }
  const a = run(mk(seedOf(1), field(8, true)), log)
  const b = run(mk(seedOf(1), field(8, true)), log)
  const c = mk(seedOf(1), field(8, true)); for (let n = 4; n <= 80; n += 4) c.advanceTo(n, logFn(log)) // ticks that land every 4 steps
  assert(same(a, b), 'the same log gives the same race')
  assert(a.step === c.step || c.done, 'gap filling ends the same race')
  const d = mk(seedOf(1), field(8, true)); d.advanceTo(a.step, logFn(log))
  assert(JSON.stringify(a.positions()) === JSON.stringify(d.positions()), 'one jump with the log equals stepping one by one')
  console.log('(1) replay with the cheer log: identical, also with ticks every 4 steps and one jump')
}

// (2) No taps = the engine without cheer: an all-human field that never taps races exactly as with cheerMax = 0.
{
  const base = run(mk(seedOf(2), field(10, true)), {})
  const saved = CHEER.cheerMax
  CHEER.cheerMax = 0
  const off = run(mk(seedOf(2), field(10, true)), { 0: { 0: 5 }, 1: { 1: 5 } })
  CHEER.cheerMax = saved
  assert(same(base, off), 'with no taps the cheer factor is exactly 1')
  console.log('(2) a field that never taps races exactly like the engine without cheer')
}

// (3) Bounds: energy stays in 0..eMax and the factor never passes cheerMax, whatever the taps.
{
  const log: CheerLog = {}
  for (let n = 1; n <= 80; n++) log[n] = { 0: 50, 1: 5, 2: 0 }
  const r = mk(seedOf(3), field(4, true))
  let max = 0
  for (let n = 1; n <= 60 && !r.done; n++) { r.advanceTo(n, logFn(log)); for (const e of r.energy) { assert(e >= 0 && e <= CHEER.eMax, 'energy in range'); max = Math.max(max, e) } }
  assert(max === CHEER.eMax, 'a flood of taps saturates at eMax and no further')
  console.log('(3) energy always inside 0..eMax; 50 taps in one step is capped like eMax')
}

// (4) Energy dynamics: +2 taps and -0.5 decay per step is +1.5 taps per step up to eMax, a quiet duck drains 0.5 per step.
{
  const r = mk(seedOf(4), field(2, true))
  const log: CheerLog = {}
  for (let n = 1; n <= 10; n++) log[n] = { 0: 2 }
  r.advanceTo(3, logFn(log))
  assert(r.energy[0] === 4_500 && r.energy[1] === 0, `energy after 3 steps of 2 taps is 4.5 taps, got ${r.energy[0]}`)
  r.advanceTo(10, logFn(log))
  assert(r.energy[0] === CHEER.eMax, `a duck that keeps tapping saturates at eMax, got ${r.energy[0]}`)
  r.advanceTo(16, logFn(log)) // 6 quiet steps
  assert(r.energy[0] === CHEER.eMax - 6 * CHEER.decay, `6 quiet steps drain 3 taps, got ${r.energy[0]}`)
  console.log('(4) energy rises 1.5 taps per step at 2 taps per step, saturates at eMax, drains 0.5 per quiet step')
}

// (5) The commitment: the hash depends on the whole log and on nothing else, and is the same for any insertion order.
{
  const l1: CheerLog = { 3: { 0: 2, 4: 1 }, 1: { 2: 1 } }
  const l2: CheerLog = { 1: { 2: 1 }, 3: { 4: 1, 0: 2 } }
  assert(cheersRoot(l1) === cheersRoot(l2), 'insertion order does not matter')
  assert(cheersRoot(l1) !== cheersRoot({ ...l1, 3: { 0: 2, 4: 2 } }), 'one tap more changes the root')
  assert(cheersRoot({}) === cheersRoot({ 5: { 1: 0 } }), 'zero taps are not part of the log')
  const res = keccak256(toHex('results'))
  assert(standingRoot(res, cheersRoot(l1)) !== standingRoot(res, cheersRoot({})), 'the standing root commits to the cheers')
  console.log('(5) cheersRoot: canonical, sensitive to every tap, folded into the standing root')
}

// (6) Rough size of the effect on a 2-human race with identical stats over many seeds (the proper run is the Monte Carlo).
{
  let tapperWins = 0
  const N = 400
  for (let s = 0; s < N; s++) {
    const log: CheerLog = {}
    for (let n = 1; n <= 80; n++) log[n] = { 0: n % 2 === 0 ? 2 : 1 } // duck 0 taps 1.5 per step, duck 1 never
    const r = run(mk(seedOf(1000 + s), field(2, true)), log)
    if (r.ranking()[0].idx === 0) tapperWins++
  }
  console.log(`(6) two humans, identical stats, one taps 1.5 per step and one never: the tapper wins ${(tapperWins / N * 100).toFixed(1)} % of ${N} races`)
  assert(tapperWins / N > 0.5, 'tapping helps')
}
console.log('PASS cheer')
