/**
 * What cheering is worth in a normal room (plan §3.10): a field of bots with two identical humans, one taps and one never taps.
 * Prints the average finishing place of each and how often each finishes in the top 10, for given cheer settings.
 *   FIELD=50 RACES=400 CHEER_TUNE='{"cheerMax":50000,"botMean":0}' npx ts-node -T -r tsconfig-paths/register test/engine/rank.script.ts
 */
import { keccak256, toHex } from 'viem'
import { CHEER, Race, statsFor, type Entrant, type Profile, type Taps, type Template } from '../../app/Engine/Race'

if (process.env.CHEER_TUNE) Object.assign(CHEER, JSON.parse(process.env.CHEER_TUNE))
const FIELD = Number(process.env.FIELD || 50)
const RACES = Number(process.env.RACES || 400)
const TAP_FROM = process.env.TAP_FROM ? JSON.parse(process.env.TAP_FROM) : { kali: 1, alpine: 1 } // step at which the tapper starts tapping, per track
const TAP_PER_STEP = Number(process.env.TAPS || 1.5) // 5 taps per second is about 1.5 per step
const TRACKS: [string, Profile, number][] = [['kali', { speed: 0.8, weight: 0.4, boost: 1, lapTicks: 35 }, 1], ['alpine', { speed: 1.2, weight: 0.9, boost: 1, lapTicks: 40 }, 2]]
const TEMPLATES: Template[] = ['balanced', 'sprint', 'tank']

for (const [track, profile, laps] of TRACKS) {
  let rankTap = 0, rankIdle = 0, topTap = 0, topIdle = 0, winTap = 0, winIdle = 0, startPlace = 0, startPlaceIdle = 0
  for (let s = 1; s <= RACES; s++) {
    // humans at index 0 (taps) and 1 (never taps), both balanced and equal; the rest are bots over the three templates
    const entrants: Entrant[] = Array.from({ length: FIELD }, (_, i) => ({ id: 'd' + i, name: 'd' + i, color: '#fff', human: i < 2, address: null, stats: statsFor(i < 2 ? 'balanced' : TEMPLATES[i % 3], null), build: '' }))
    const r = new Race({ raceId: s, seed: keccak256(toHex(`rank:${s}`)), entrants, profile, laps })
    const from = TAP_FROM[track]
    const taps = (n: number): Taps => (n < from ? {} : { 0: TAP_PER_STEP >= 2 ? 2 : Math.floor(TAP_PER_STEP) + ((n * TAP_PER_STEP) % 1 < TAP_PER_STEP % 1 ? 1 : 0) })
    let n = 0
    while (!r.done && n < 500) {
      r.advanceTo(++n, taps)
      if (n === from) { startPlace += r.ranking().findIndex((d) => d.idx === 0) + 1; startPlaceIdle += r.ranking().findIndex((d) => d.idx === 1) + 1 }
    }
    const order = r.ranking().map((d) => d.idx)
    const a = order.indexOf(0) + 1, b = order.indexOf(1) + 1
    rankTap += a; rankIdle += b
    if (a <= 10) topTap++; if (b <= 10) topIdle++
    if (a === 1) winTap++; if (b === 1) winIdle++
  }
  console.log(`${track.padEnd(6)} taps from step ${TAP_FROM[track]}: place then ${(startPlace / RACES).toFixed(1)} -> final ${(rankTap / RACES).toFixed(1)} (idle: ${(startPlaceIdle / RACES).toFixed(1)} -> ${(rankIdle / RACES).toFixed(1)}) | field ${FIELD}: place of the tapper ${(rankTap / RACES).toFixed(1)} | of the idler ${(rankIdle / RACES).toFixed(1)} | top 10: ${(topTap / RACES * 100).toFixed(0)} % vs ${(topIdle / RACES * 100).toFixed(0)} % | wins: ${(winTap / RACES * 100).toFixed(1)} % vs ${(winIdle / RACES * 100).toFixed(1)} %`)
}
