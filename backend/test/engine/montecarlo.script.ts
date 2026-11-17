import { keccak256, toHex } from 'viem'
import { CHEER, Race, TUNING, statsFor, type Entrant, type Profile, type Taps, type Template } from '../../app/Engine/Race'

const MODE = process.env.MODE || 'tuned'
const RACES = Number(process.env.RACES || 200)
const FIELD = Number(process.env.FIELD || 120)

if (MODE === 'baseline') TUNING.catchupDivisor = Infinity

if (process.env.TUNE) Object.assign(TUNING, JSON.parse(process.env.TUNE, (_key, value) => (value === 'Infinity' ? Infinity : value)))

if (process.env.CHEER_TUNE) Object.assign(CHEER, JSON.parse(process.env.CHEER_TUNE))

const CHEER_ON = !!process.env.CHEER
const tapModeOf = (duckIndex: number) => Math.floor(duckIndex / 12) % 3
const QUIET = !!process.env.QUIET
const TARGET_STEPS: Record<string, number> = { kali: 34, alpine: 76 }
const CALIBRATE = !!process.env.CALIBRATE

const PARTS = [
  null,
  { name: 'wings', speed: 2, weight: 0, boost: -1 },
  { name: 'tail', speed: 1, weight: 1, boost: 0 },
  { name: 'bill', speed: -1, weight: 1, boost: 2 },
]
const TEMPLATES: Template[] = ['balanced', 'sprint', 'tank']
const TRACKS: [string, Profile, number][] = [
  ['kali', { speed: 0.8, weight: 0.4, boost: 1, lapTicks: 35 }, 1],
  ['alpine', { speed: 1.2, weight: 0.9, boost: 1, lapTicks: 40 }, 2],
]

const countTopTenInversions = (previousTop: number[], currentTop: number[]): number => {
  const positionInCurrent = new Map(currentTop.map((duckIndex, position) => [duckIndex, position]))
  let inversions = 0
  for (let first = 0; first < previousTop.length; first++) {
    for (let second = first + 1; second < previousTop.length; second++) {
      if ((positionInCurrent.get(previousTop[first]) ?? 99) > (positionInCurrent.get(previousTop[second]) ?? 99)) inversions++
    }
  }

  return inversions
}

const buildField = (size: number): Entrant[] =>
  Array.from({ length: size }, (_, index) => {
    const template = TEMPLATES[index % 3]
    const part = PARTS[Math.floor(index / 3) % 4]
    const tapModeName = CHEER_ON ? ['cap', 'idle', 'bot'][tapModeOf(index)] : 'bot'

    return {
      id: `${template}:${part?.name ?? 'stock'}:${index}:${tapModeName}`,
      name: 'd' + index,
      color: '#fff',
      human: CHEER_ON && tapModeOf(index) !== 2,
      address: null,
      stats: statsFor(template, part),
      build: '',
    }
  })

const tapsOfStep = (step: number, size: number): Taps => {
  const taps: Taps = {}
  for (let duckIndex = 0; duckIndex < size; duckIndex++) {
    if (tapModeOf(duckIndex) === 0) taps[duckIndex] = 1 + ((step + duckIndex) % 2)
  }

  return taps
}

const meanSteps = (profile: Profile, laps: number, races: number, tag: string): number => {
  let totalSteps = 0
  for (let seedIndex = 1; seedIndex <= races; seedIndex++) {
    const race = new Race({ raceId: seedIndex, seed: keccak256(toHex(`${tag}:${seedIndex}`)), entrants: buildField(60), profile, laps })
    let step = 0
    while (!race.done && step < 500) race.advanceTo(++step)
    totalSteps += race.step
  }

  return totalSteps / races
}

if (!QUIET) console.log(`mode=${MODE} ${JSON.stringify(TUNING)} races=${RACES} field=${FIELD}`)

for (const [track, profile, laps] of TRACKS) {
  if (CALIBRATE) {
    for (let iteration = 0; iteration < 5; iteration++) {
      const mean = meanSteps(profile, laps, 25, 'cal')
      TUNING.base = Math.round(TUNING.base * (1 + (mean / TARGET_STEPS[track] - 1) * 0.9))
    }
  }

  const winsByTemplate: Record<string, number> = {}
  const winsByPart: Record<string, number> = {}
  const winsByTapMode: Record<string, number> = {}
  let leadChanges = 0
  let topTenSwaps = 0
  let totalSteps = 0

  for (let seedIndex = 1; seedIndex <= RACES; seedIndex++) {
    const entrants = buildField(FIELD)
    const race = new Race({ raceId: seedIndex, seed: keccak256(toHex(`mc:${seedIndex}`)), entrants, profile, laps })
    let step = 0
    let previousTop: number[] = []
    while (!race.done && step < 500) {
      race.advanceTo(++step, CHEER_ON ? (stepNumber) => tapsOfStep(stepNumber, FIELD) : undefined)

      const top = [...race.ducks]
        .sort((first, second) => second.progress - first.progress || (first.tie > second.tie ? -1 : 1))
        .slice(0, 10)
        .map((duck) => duck.index)

      if (previousTop.length) topTenSwaps += countTopTenInversions(previousTop, top)

      previousTop = top
    }

    leadChanges += race.leadChanges
    totalSteps += race.step

    const winnerIdParts = race.ranking()[0].id.split(':')
    winsByTemplate[winnerIdParts[0]] = (winsByTemplate[winnerIdParts[0]] || 0) + 1
    winsByPart[winnerIdParts[1]] = (winsByPart[winnerIdParts[1]] || 0) + 1
    winsByTapMode[winnerIdParts[3]] = (winsByTapMode[winnerIdParts[3]] || 0) + 1
  }

  if (QUIET) {
    const highestRatio = (wins: Record<string, number>, groups: number) => (Math.max(...Object.values(wins)) / RACES) * groups
    const ratios = (wins: Record<string, number>, groups: number) =>
      Object.fromEntries(Object.entries(wins).map(([name, count]) => [name, +((count / RACES) * groups).toFixed(2)]))

    console.log(
      JSON.stringify({
        track,
        tune: { ...TUNING },
        cheer: CHEER_ON ? { ...CHEER } : null,
        mode: ratios(winsByTapMode, 3),
        steps: +(totalSteps / RACES).toFixed(1),
        lead: +(leadChanges / RACES).toFixed(2),
        swaps: +(topTenSwaps / RACES).toFixed(0),
        maxTemplate: +highestRatio(winsByTemplate, 3).toFixed(2),
        maxPart: +highestRatio(winsByPart, 4).toFixed(2),
        tpl: ratios(winsByTemplate, 3),
        part: ratios(winsByPart, 4),
      }),
    )
    continue
  }

  const share = (wins: Record<string, number>, groups: number) =>
    Object.entries(wins)
      .sort((first, second) => second[1] - first[1])
      .map(([name, count]) => `${name}=${((count / RACES) * 100).toFixed(1)}% (${((count / RACES) * groups).toFixed(2)}x)`)
      .join('  ')

  console.log(`${track}: steps/race ${(totalSteps / RACES).toFixed(1)} | lead changes/race ${(leadChanges / RACES).toFixed(2)} | top-10 swaps/race ${(topTenSwaps / RACES).toFixed(1)}`)
  console.log(`  by template: ${share(winsByTemplate, 3)}`)
  console.log(`  by part:     ${share(winsByPart, 4)}`)

  if (CHEER_ON) console.log(`  by tapping:  ${share(winsByTapMode, 3)}   (cap = taps 1.5 per step, idle = a human who never taps, bot = never taps; 1.00x = equal)`)
}
