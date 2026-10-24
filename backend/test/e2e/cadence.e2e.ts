/**
 * How ticks really arrive on Monad (the projector's smoothness depends on it), and what the projector's playback does with them.
 * One real race with three players; every `race:tick` is timestamped on arrival. The playback model below is the controller of
 * RaceLayer in frontend/app/stage/[code]/ui.tsx (LAG_STEPS, speed clamp, step time estimate); it is replayed on the real arrivals
 * and reports how often the ducks would have stood still.
 *   API_URL=… npx ts-node -T -r tsconfig-paths/register test/e2e/cadence.e2e.ts
 */
import { io } from 'socket.io-client'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { API, assert, call, order, signIn, sleep } from './lib'

import fs from 'fs'

const LAG_STEPS = Number(process.env.LAG || 2)
const EXTRAP_MS = Number(process.env.EXTRAP || 0) // keep gliding at the last speed for at most this long when no new tick is known
const STEP_MS = 300

const q = (xs: number[], f: number) => [...xs].sort((x, y) => x - y)[Math.min(xs.length - 1, Math.floor(xs.length * f))]

/** The projector's playback replayed at 60 frames per second on recorded arrivals. */
function playback(arrivals: { t: number; n: number }[]) {
  let play = Math.max(0, arrivals[0].n - LAG_STEPS)
  let stepMs = STEP_MS
  const known: { t: number; n: number }[] = []
  let ai = 0, stalled = 0, frames = 0, longest = 0, run = 0
  const t0 = arrivals[0].t
  const tEnd = arrivals[arrivals.length - 1].t
  for (let now = t0; now < tEnd; now += 1000 / 60) {
    while (ai < arrivals.length && arrivals[ai].t <= now) {
      const x = arrivals[ai++]
      const last = known[known.length - 1]
      if (last && x.n > last.n) { const gap = (x.t - last.t) / (x.n - last.n); if (gap > 80 && gap < 1500) stepMs = stepMs * 0.7 + gap * 0.3 }
      if (!last || x.n > last.n) known.push(x)
    }
    const latest = known[known.length - 1]
    const target = latest.n + Math.min(EXTRAP_MS, now - latest.t) / stepMs // may glide a little past the newest known step
    const speed = 1 + Math.max(-0.5, Math.min(0.35, (latest.n - LAG_STEPS - play) * 0.3))
    const before = play
    play = Math.min(target, play + (1000 / 60 / stepMs) * speed)
    frames++
    if (play - before < 1e-6) { stalled++; run++; longest = Math.max(longest, run * (1000 / 60)) } else run = 0
  }
  return `LAG ${LAG_STEPS} steps (${Math.round(LAG_STEPS * STEP_MS)} ms), glide ${EXTRAP_MS} ms: ducks stand still in ${(stalled / frames * 100).toFixed(1)} % of ${frames} frames, longest stand-still ${Math.round(longest)} ms`
}

async function main() {
  if (process.env.TRACE_IN) {
    for (const f of process.env.TRACE_IN.split(',')) console.log(f.split('/').pop(), '->', playback(JSON.parse(fs.readFileSync(f, 'utf8'))))
    return
  }
  const [h, a] = [privateKeyToAccount(generatePrivateKey()), privateKeyToAccount(generatePrivateKey())]
  const [ht, at] = await Promise.all([signIn(h), signIn(a)])
  const kali = (await call('/api/catalog/tracks')).find((t: any) => t.slug === (process.env.TRACK || 'kali-code-sprint'))
  const room = await order(ht, { kind: 'create_room', trackId: kali.id, roomName: 'Cadence', maxDucks: 50, fillBots: true })
  await order(at, { kind: 'join_room', roomCode: room.roomCode })
  const arrivals: { t: number; n: number }[] = []
  let settled: any = null
  const s = io(API, { transports: ['websocket'] })
  s.on('connect', () => s.emit('room:watch', { code: room.roomCode }))
  s.on('race:tick', (m: any) => arrivals.push({ t: performance.now(), n: m.n }))
  s.on('race:settled', (m: any) => (settled = m))
  await sleep(1000)
  await call(`/api/rooms/${room.roomCode}/start`, 'POST', {}, ht)
  const until = Date.now() + 150_000
  while (!settled && Date.now() < until) await sleep(200)
  s.close()
  assert(arrivals.length > 5, 'ticks arrived')

  if (process.env.TRACE_OUT) fs.writeFileSync(process.env.TRACE_OUT, JSON.stringify(arrivals))
  const gaps = arrivals.slice(1).map((x, i) => x.t - arrivals[i].t)
  const steps = arrivals.slice(1).map((x, i) => x.n - arrivals[i].n)
  console.log(`ticks ${arrivals.length}, last step ${arrivals[arrivals.length - 1].n}`)
  console.log(`gap between ticks: min ${Math.round(Math.min(...gaps))} ms, median ${Math.round(q(gaps, 0.5))}, p95 ${Math.round(q(gaps, 0.95))}, max ${Math.round(Math.max(...gaps))}`)
  console.log(`steps per tick: ${[1, 2, 3, 4].map((k) => `${k}: ${steps.filter((x) => x === k).length}`).join(' | ')} | more: ${steps.filter((x) => x > 4).length}`)

  console.log('playback on these arrivals:', playback(arrivals))
  console.log('PASS cadence')
}

main().catch((e) => { console.error('FAIL', e); process.exit(1) })
