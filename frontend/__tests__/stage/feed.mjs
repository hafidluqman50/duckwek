// Visual test feed for the projector page (test only, never imported by the app).
// Serves GET /api/rooms/:code and the socket.io events useRoomLive listens to, with the same payload shapes as the backend.
//   node --experimental-strip-types __tests__/stage/feed.mjs        (port 8099, TRACK=alpine|kali, DUCKS=60)
// Drive it: POST /phase/lobby | grid | race | result | settled
import http from 'node:http'
import { createRequire } from 'node:module'
import { ALPINE_RING_PATH, KALI_CODE_PATH } from '../../../backend/app/Engine/TrackGeometry.ts'

const require = createRequire(new URL('../../../backend/package.json', import.meta.url))
const { Server } = require('socket.io')

const TRACK = process.env.TRACK === 'kali' ? 'kali' : 'alpine'
const DUCKS = Number(process.env.DUCKS || 60)
const track = TRACK === 'kali'
  ? { id: 1, slug: 'kali-code-sprint', name: 'Kali Code Sprint', description: 'Point-to-point river sprint with six bends.', rentPrice: '1000000', laps: 1, turns: 6, lengthM: 1800, closed: false, path: KALI_CODE_PATH, sectors: [16, 33, 49], profile: { speed: 0.8, weight: 0.4, boost: 1, lapTicks: 35 }, platform: true, status: 'active' }
  : { id: 2, slug: 'alpine-ring', name: 'Alpine Ring', description: 'Two laps of long straights.', rentPrice: '1000000', laps: 2, turns: 10, lengthM: 4326, closed: true, path: ALPINE_RING_PATH, sectors: [8, 24, 41], profile: { speed: 1.2, weight: 0.9, boost: 1, lapTicks: 40 }, platform: true, status: 'active' }

const COLORS = ['#FFC93C', '#FFFFFF', '#FF7AB6', '#4ED1C5', '#7CC6FE', '#B8F35A', '#FF9F1C', '#C9B8FF', '#F25F5C', '#836EF9']
const NAMES = ['QuackKing', 'BuroqMax', 'WekBro', 'PaddlePro', 'MonadBoy', 'BebekOne', 'MallardX', 'SplashJr', 'FeatherZz', 'BillGang', 'TikiQueen', 'JogjaPro']
const TEMPLATES = ['balanced', 'sprint', 'tank']
const look = (i) => ({ template: TEMPLATES[i % 3], bodyColor: COLORS[i % COLORS.length], billColor: '#FF9F1C', cosmetics: { hat: i % 3 === 0, shades: i % 4 === 1, scarf: i % 5 === 2 }, partTypeId: i % 4 === 3 ? null : i % 3 })
const players = Array.from({ length: 12 }, (_, i) => ({ address: '0x' + String(i + 1).padStart(40, '0'), name: NAMES[i], host: i === 0, ...look(i) }))
const room = { code: 'WEK-TEST', name: 'GIK UGM Main Stage', host: players[0].address, hostName: players[0].name, track, maxDucks: 200, fillBots: true, status: 'lobby', players, count: players.length }
const entrants = Array.from({ length: DUCKS }, (_, i) => ({ i, name: i < 12 ? NAMES[i] : 'Bot' + i, address: i < 12 ? players[i].address : null, human: i < 12, color: COLORS[i % COLORS.length], ...look(i) }))
const grid = { raceId: 1, laps: track.laps, countdown: 3, entrants }

let io
const send = (ev, m) => io.emit(ev, m)
let timer = null
const stop = () => { if (timer) clearTimeout(timer); timer = null }

function runRace() {
  stop()
  const speed = entrants.map((_, i) => 290 + ((i * 37) % 60))
  const p = entrants.map(() => 0)
  let n = 0
  send('race:go', { raceId: 1 })
  // JITTER=1: ticks arrive like on the real chain (uneven gaps, now and then two steps at once)
  const step = () => {
    const steps = process.env.JITTER && Math.random() < 0.25 ? 2 : 1
    for (let k = 0; k < steps; k++) {
      n++
      for (let i = 0; i < p.length; i++) p[i] = Math.min(10400, p[i] + speed[i] + Math.round((Math.random() - 0.5) * 120))
    }
    // en: cheer energy in percent; the first 12 ducks are the humans, every other one is boosted a little like a bot
    send('race:tick', { raceId: 1, b: 73_000_000 + n, n, t: n, p: [...p], en: p.map((_, i) => (i < 12 ? (i % 3 === 0 ? 100 : i % 3 === 1 ? 45 : 0) : 60)), ev: [] })
    if (p.some((v) => v >= 10000)) return stop()
    timer = setTimeout(step, process.env.JITTER ? 150 + Math.random() * 550 : 300)
  }
  timer = setTimeout(step, 300)
}

function result() {
  const ranking = entrants.slice(0, 10).map((e, k) => ({ rank: k + 1, name: e.name, address: e.address, human: e.human, progress: 10000 - k * 40, title: k === 0 ? 'ABSOLUTE MARVELOUS' : 'PODIUM PADDLER', color: e.color, i: e.i }))
  send('race:result', { raceId: 1, startBlock: 73_000_001, endBlock: 73_000_040, resultsRoot: '0x' + '11'.repeat(32), field: DUCKS, ranking })
}

const server = http.createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-headers', '*')
  res.setHeader('access-control-allow-methods', '*')
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }
  const url = new URL(req.url, 'http://x')
  const json = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)) }
  if (url.pathname.startsWith('/api/rooms/')) return json({ status: true, data: room })
  if (url.pathname.startsWith('/api/catalog/')) return json({ status: true, data: [] })
  const ph = url.pathname.match(/^\/phase\/(\w+)/)?.[1]
  if (ph === 'lobby') { stop(); send('room:state', room) }
  else if (ph === 'grid') send('race:grid', grid)
  else if (ph === 'race') runRace()
  else if (ph === 'result') { stop(); result() }
  else if (ph === 'settled') send('race:settled', { raceId: 1, tx: '0x' + '22'.repeat(32), url: null, titles: [], ok: true })
  else { res.statusCode = 404; return json({ status: false }) }
  json({ status: true, phase: ph })
})
io = new Server(server, { cors: { origin: '*' } })
io.on('connection', (s) => s.on('room:watch', () => s.emit('room:state', room)))
server.listen(8099, () => console.log(`stage feed on :8099 (${TRACK}, ${DUCKS} ducks)`))
