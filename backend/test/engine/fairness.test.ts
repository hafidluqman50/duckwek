import { keccak256, toHex, type Hex } from 'viem'
import { Race, statsFor, tieKey, type Entrant, type Profile } from '../../app/Engine/Race'

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error('ASSERT: ' + message)
}

const seedOf = (index: number): Hex => keccak256(toHex(`fairness:${index}`))

const KALI: Profile = { speed: 0.8, weight: 0.4, boost: 1, lapTicks: 35 }
const ALPINE: Profile = { speed: 1.2, weight: 0.9, boost: 1, lapTicks: 40 }

const field = (size: number, template: 'balanced' | 'sprint' | 'tank' = 'balanced'): Entrant[] =>
  Array.from({ length: size }, (_, index) => ({
    id: 'd' + index,
    name: 'd' + index,
    color: '#fff',
    human: false,
    address: null,
    stats: statsFor(template, null),
    build: template,
  }))

const runToEnd = (seed: Hex, entrants: Entrant[], profile: Profile, laps: number) => {
  const race = new Race({ raceId: 1, seed, entrants, profile, laps })
  let step = 0
  while (!race.done && step < 500) race.advanceTo(++step)

  return race
}

{
  const duckCount = 20
  const raceCount = 600
  const wins = new Array(duckCount).fill(0)
  for (let seedIndex = 0; seedIndex < raceCount; seedIndex++) {
    const race = runToEnd(seedOf(seedIndex), field(duckCount), ALPINE, 2)
    const ranking = race.ranking()

    assert(ranking.length === duckCount && new Set(ranking.map((duck) => duck.index)).size === duckCount, 'ranking is a permutation')
    wins[ranking[0].index]++
  }

  const expected = raceCount / duckCount
  const chiSquare = wins.reduce((sum, duckWins) => sum + (duckWins - expected) ** 2 / expected, 0)
  console.log('(1) wins per duck', wins.join(' '), '| chi2', chiSquare.toFixed(1), '(limit 43.8)')
  assert(chiSquare < 43.82, 'identical ducks must win equally often')
}

{
  for (let seedIndex = 0; seedIndex < 50; seedIndex++) {
    const seed = seedOf(1000 + seedIndex)
    const race = new Race({ raceId: 1, seed, entrants: field(2), profile: KALI, laps: 1 })
    for (const duck of race.ducks) {
      duck.progress = 1_020_000
      duck.finishedAt = 33_500_000
    }

    const first = race.ranking()[0].index
    const expectedFirst = tieKey(seed, 0) > tieKey(seed, 1) ? 0 : 1

    assert(first === expectedFirst, 'the larger tieKey is ahead')
    assert(race.leader().index === expectedFirst, 'the leader on equal progress is the larger tieKey')
  }

  console.log('(2) equal progress and finish time: ordered by tieKey in 50 / 50 seeds')
}

{
  const seed = seedOf(7)
  const stepByStep = new Race({ raceId: 1, seed, entrants: field(40), profile: ALPINE, laps: 2 })
  const oneJump = new Race({ raceId: 1, seed, entrants: field(40), profile: ALPINE, laps: 2 })
  const everyThreeSteps = new Race({ raceId: 1, seed, entrants: field(40), profile: ALPINE, laps: 2 })
  for (let step = 1; step <= 30; step++) stepByStep.advanceTo(step)
  oneJump.advanceTo(30)
  for (let step = 3; step <= 30; step += 3) everyThreeSteps.advanceTo(step)

  assert(JSON.stringify(stepByStep.positions()) === JSON.stringify(oneJump.positions()), 'jump of 30 steps equals 30 single steps')
  assert(JSON.stringify(stepByStep.positions()) === JSON.stringify(everyThreeSteps.positions()), 'ticks that land every 3 steps give the same positions')
  console.log('(3) replay and gap filling reproduce every position')
}

console.log('PASS fairness')
