import { keccak256, toHex } from 'viem'
import { CHEER, Race, statsFor, type Entrant, type Profile, type Taps, type Template } from '../../app/Engine/Race'

if (process.env.CHEER_TUNE) Object.assign(CHEER, JSON.parse(process.env.CHEER_TUNE))

const FIELD = Number(process.env.FIELD || 50)
const RACES = Number(process.env.RACES || 400)
const TAP_FROM = process.env.TAP_FROM ? JSON.parse(process.env.TAP_FROM) : { kali: 1, alpine: 1 }
const TAP_PER_STEP = Number(process.env.TAPS || 1.5)
const TRACKS: [string, Profile, number][] = [
  ['kali', { speed: 0.8, weight: 0.4, boost: 1, lapTicks: 35 }, 1],
  ['alpine', { speed: 1.2, weight: 0.9, boost: 1, lapTicks: 40 }, 2],
]
const TEMPLATES: Template[] = ['balanced', 'sprint', 'tank']

for (const [track, profile, laps] of TRACKS) {
  let tapperRankSum = 0
  let idlerRankSum = 0
  let tapperTopTen = 0
  let idlerTopTen = 0
  let tapperWins = 0
  let idlerWins = 0
  let tapperStartPlaceSum = 0
  let idlerStartPlaceSum = 0

  for (let seedIndex = 1; seedIndex <= RACES; seedIndex++) {
    const entrants: Entrant[] = Array.from({ length: FIELD }, (_, index) => ({
      id: 'd' + index,
      name: 'd' + index,
      color: '#fff',
      human: index < 2,
      address: null,
      stats: statsFor(index < 2 ? 'balanced' : TEMPLATES[index % 3], null),
      build: '',
    }))
    const race = new Race({ raceId: seedIndex, seed: keccak256(toHex(`rank:${seedIndex}`)), entrants, profile, laps })
    const tapFromStep = TAP_FROM[track]
    const tapsOfStep = (step: number): Taps =>
      step < tapFromStep
        ? {}
        : { 0: TAP_PER_STEP >= 2 ? 2 : Math.floor(TAP_PER_STEP) + ((step * TAP_PER_STEP) % 1 < TAP_PER_STEP % 1 ? 1 : 0) }

    let step = 0
    while (!race.done && step < 500) {
      race.advanceTo(++step, tapsOfStep)

      if (step === tapFromStep) {
        tapperStartPlaceSum += race.ranking().findIndex((duck) => duck.index === 0) + 1
        idlerStartPlaceSum += race.ranking().findIndex((duck) => duck.index === 1) + 1
      }
    }

    const order = race.ranking().map((duck) => duck.index)
    const tapperPlace = order.indexOf(0) + 1
    const idlerPlace = order.indexOf(1) + 1
    tapperRankSum += tapperPlace
    idlerRankSum += idlerPlace

    if (tapperPlace <= 10) tapperTopTen++

    if (idlerPlace <= 10) idlerTopTen++

    if (tapperPlace === 1) tapperWins++

    if (idlerPlace === 1) idlerWins++
  }

  console.log(
    `${track.padEnd(6)} taps from step ${TAP_FROM[track]}: place then ${(tapperStartPlaceSum / RACES).toFixed(1)} -> final ${(tapperRankSum / RACES).toFixed(1)} (idle: ${(idlerStartPlaceSum / RACES).toFixed(1)} -> ${(idlerRankSum / RACES).toFixed(1)}) | field ${FIELD}: place of the tapper ${(tapperRankSum / RACES).toFixed(1)} | of the idler ${(idlerRankSum / RACES).toFixed(1)} | top 10: ${((tapperTopTen / RACES) * 100).toFixed(0)} % vs ${((idlerTopTen / RACES) * 100).toFixed(0)} % | wins: ${((tapperWins / RACES) * 100).toFixed(1)} % vs ${((idlerWins / RACES) * 100).toFixed(1)} %`,
  )
}
