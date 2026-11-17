import { keccak256, toHex, type Hex } from 'viem'
import { CHEER, Race, statsFor, type Entrant, type Profile, type Taps } from '../../app/Engine/Race'
import { cheersRoot, standingRoot, type CheerLog } from '../../app/Engine/Cheers'

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error('ASSERT: ' + message)
}

const seedOf = (index: number): Hex => keccak256(toHex(`cheer:${index}`))

const KALI: Profile = { speed: 0.8, weight: 0.4, boost: 1, lapTicks: 35 }

const field = (size: number, human: boolean): Entrant[] =>
  Array.from({ length: size }, (_, index) => ({
    id: 'd' + index,
    name: 'd' + index,
    color: '#fff',
    human,
    address: human ? '0x' + String(index).padStart(40, '0') : null,
    stats: statsFor('balanced', null),
    build: '',
  }))

const createRace = (seed: Hex, entrants: Entrant[]) => new Race({ raceId: 1, seed, entrants, profile: KALI, laps: 1 })

const tapsOfLog = (log: CheerLog) => (step: number): Taps | undefined => log[step]

const runToEnd = (race: Race, log: CheerLog) => {
  let step = 0
  while (!race.done && step < 300) race.advanceTo(++step, tapsOfLog(log))

  return race
}

const samePositions = (first: Race, second: Race) =>
  JSON.stringify(first.positions()) === JSON.stringify(second.positions()) && first.step === second.step

{
  const log: CheerLog = {}
  for (let step = 1; step <= 40; step++) log[step] = { 0: 1 + (step % 2), 3: step % 3 === 0 ? 2 : 0, 5: 1 }

  const first = runToEnd(createRace(seedOf(1), field(8, true)), log)
  const second = runToEnd(createRace(seedOf(1), field(8, true)), log)

  const everyFourSteps = createRace(seedOf(1), field(8, true))
  for (let step = 4; step <= 80; step += 4) everyFourSteps.advanceTo(step, tapsOfLog(log))

  assert(samePositions(first, second), 'the same log gives the same race')
  assert(first.step === everyFourSteps.step || everyFourSteps.done, 'gap filling ends the same race')

  const oneJump = createRace(seedOf(1), field(8, true))
  oneJump.advanceTo(first.step, tapsOfLog(log))

  assert(JSON.stringify(first.positions()) === JSON.stringify(oneJump.positions()), 'one jump with the log equals stepping one by one')
  console.log('(1) replay with the cheer log: identical, also with ticks every 4 steps and one jump')
}

{
  const base = runToEnd(createRace(seedOf(2), field(10, true)), {})
  const savedCheerMax = CHEER.cheerMax
  CHEER.cheerMax = 0

  const withoutCheer = runToEnd(createRace(seedOf(2), field(10, true)), { 0: { 0: 5 }, 1: { 1: 5 } })
  CHEER.cheerMax = savedCheerMax

  assert(samePositions(base, withoutCheer), 'with no taps the cheer factor is exactly 1')
  console.log('(2) a field that never taps races exactly like the engine without cheer')
}

{
  const log: CheerLog = {}
  for (let step = 1; step <= 80; step++) log[step] = { 0: 50, 1: 5, 2: 0 }

  const race = createRace(seedOf(3), field(4, true))
  let highestEnergy = 0
  for (let step = 1; step <= 60 && !race.done; step++) {
    race.advanceTo(step, tapsOfLog(log))

    for (const energy of race.energy) {
      assert(energy >= 0 && energy <= CHEER.energyMax, 'energy in range')
      highestEnergy = Math.max(highestEnergy, energy)
    }
  }

  assert(highestEnergy === CHEER.energyMax, 'a flood of taps saturates at eMax and no further')
  console.log('(3) energy always inside 0..eMax; 50 taps in one step is capped like eMax')
}

{
  const race = createRace(seedOf(4), field(2, true))
  const log: CheerLog = {}
  for (let step = 1; step <= 10; step++) log[step] = { 0: 2 }

  race.advanceTo(3, tapsOfLog(log))
  assert(race.energy[0] === 4_500 && race.energy[1] === 0, `energy after 3 steps of 2 taps is 4.5 taps, got ${race.energy[0]}`)

  race.advanceTo(10, tapsOfLog(log))
  assert(race.energy[0] === CHEER.energyMax, `a duck that keeps tapping saturates at eMax, got ${race.energy[0]}`)

  race.advanceTo(16, tapsOfLog(log))
  assert(race.energy[0] === CHEER.energyMax - 6 * CHEER.decay, `6 quiet steps drain 3 taps, got ${race.energy[0]}`)
  console.log('(4) energy rises 1.5 taps per step at 2 taps per step, saturates at eMax, drains 0.5 per quiet step')
}

{
  const firstLog: CheerLog = { 3: { 0: 2, 4: 1 }, 1: { 2: 1 } }
  const secondLog: CheerLog = { 1: { 2: 1 }, 3: { 4: 1, 0: 2 } }

  assert(cheersRoot(firstLog) === cheersRoot(secondLog), 'insertion order does not matter')
  assert(cheersRoot(firstLog) !== cheersRoot({ ...firstLog, 3: { 0: 2, 4: 2 } }), 'one tap more changes the root')
  assert(cheersRoot({}) === cheersRoot({ 5: { 1: 0 } }), 'zero taps are not part of the log')

  const resultsRoot = keccak256(toHex('results'))

  assert(standingRoot(resultsRoot, cheersRoot(firstLog)) !== standingRoot(resultsRoot, cheersRoot({})), 'the standing root commits to the cheers')
  console.log('(5) cheersRoot: canonical, sensitive to every tap, folded into the standing root')
}

{
  let tapperWins = 0
  const races = 400
  for (let seedIndex = 0; seedIndex < races; seedIndex++) {
    const log: CheerLog = {}
    for (let step = 1; step <= 80; step++) log[step] = { 0: step % 2 === 0 ? 2 : 1 }

    const race = runToEnd(createRace(seedOf(1000 + seedIndex), field(2, true)), log)

    if (race.ranking()[0].index === 0) tapperWins++
  }

  console.log(`(6) two humans, identical stats, one taps 1.5 per step and one never: the tapper wins ${((tapperWins / races) * 100).toFixed(1)} % of ${races} races`)
  assert(tapperWins / races > 0.5, 'tapping helps')
}

console.log('PASS cheer')
