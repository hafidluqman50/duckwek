/**
 * T-9: identical stats, one winner. No chain, no MON.
 *   npx ts-node -T -r tsconfig-paths/register test/engine/fairness.test.ts
 */
import { keccak256, toHex, type Hex } from 'viem'
import { Race, statsFor, tieKey, type Entrant, type Profile } from '../../app/Engine/Race'

const assert = (c: unknown, m: string) => { if (!c) throw new Error('ASSERT: ' + m) }
const seedOf = (i: number): Hex => keccak256(toHex(`fairness:${i}`))
const KALI: Profile = { speed: 0.8, weight: 0.4, boost: 1, lapTicks: 35 }
const ALPINE: Profile = { speed: 1.2, weight: 0.9, boost: 1, lapTicks: 40 }
const field = (n: number, template: 'balanced' | 'sprint' | 'tank' = 'balanced'): Entrant[] =>
  Array.from({ length: n }, (_, i) => ({ id: 'd' + i, name: 'd' + i, color: '#fff', human: false, address: null, stats: statsFor(template, null), build: template }))
const run = (seed: Hex, e: Entrant[], p: Profile, laps: number) => { const r = new Race({ raceId: 1, seed, entrants: e, profile: p, laps }); let n = 0; while (!r.done && n < 500) r.advanceTo(++n); return r }

// (1) 20 ducks with identical stats: every race has exactly one winner and each duck wins about 1/20 of the races.
{
  const N = 20, RACES = 600
  const wins = new Array(N).fill(0)
  for (let s = 0; s < RACES; s++) {
    const r = run(seedOf(s), field(N), ALPINE, 2)
    const rank = r.ranking()
    assert(rank.length === N && new Set(rank.map((d) => d.idx)).size === N, 'ranking is a permutation')
    wins[rank[0].idx]++
  }
  const expected = RACES / N
  const chi = wins.reduce((a, w) => a + (w - expected) ** 2 / expected, 0)
  // chi-square, df = 19: 0.1 % critical value 43.82. Fixed seeds, so the result is reproducible.
  console.log('(1) wins per duck', wins.join(' '), '| chi2', chi.toFixed(1), '(limit 43.8)')
  assert(chi < 43.82, 'identical ducks must win equally often')
}

// (2) Two ducks equal in progress and finish time: the order depends on tieKey(seed, idx) only, never on join order.
{
  for (let s = 0; s < 50; s++) {
    const seed = seedOf(1000 + s)
    const r = new Race({ raceId: 1, seed, entrants: field(2), profile: KALI, laps: 1 })
    for (const d of r.ducks) { d.p = 1_020_000; d.finishedAt = 33_500_000 }
    const first = r.ranking()[0].idx
    const want = tieKey(seed, 0) > tieKey(seed, 1) ? 0 : 1
    assert(first === want, 'the larger tieKey is ahead')
    assert(r.leader().idx === want, 'the leader on equal progress is the larger tieKey')
  }
  console.log('(2) equal progress and finish time: ordered by tieKey in 50 / 50 seeds')
}

// (3) Replay: a fresh run reproduces every position, and filling missed steps in one jump equals stepping one by one.
{
  const seed = seedOf(7)
  const a = new Race({ raceId: 1, seed, entrants: field(40), profile: ALPINE, laps: 2 })
  const b = new Race({ raceId: 1, seed, entrants: field(40), profile: ALPINE, laps: 2 })
  const c = new Race({ raceId: 1, seed, entrants: field(40), profile: ALPINE, laps: 2 })
  for (let n = 1; n <= 30; n++) a.advanceTo(n)
  b.advanceTo(30)
  for (let n = 3; n <= 30; n += 3) c.advanceTo(n)
  assert(JSON.stringify(a.positions()) === JSON.stringify(b.positions()), 'jump of 30 steps equals 30 single steps')
  assert(JSON.stringify(a.positions()) === JSON.stringify(c.positions()), 'ticks that land every 3 steps give the same positions')
  console.log('(3) replay and gap filling reproduce every position')
}

console.log('PASS fairness')
