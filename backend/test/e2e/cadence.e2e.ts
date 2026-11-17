import fs from 'fs'
import { io } from 'socket.io-client'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { API, assert, call, order, signIn, sleep } from './lib'

interface Arrival {
  arrivedAt: number
  step: number
}

const LAG_STEPS = Number(process.env.LAG || 2)
const EXTRAPOLATE_MS = Number(process.env.EXTRAP || 0)
const STEP_MS = 300
const FRAME_MS = 1000 / 60

const quantile = (values: number[], fraction: number) =>
  [...values].sort((first, second) => first - second)[Math.min(values.length - 1, Math.floor(values.length * fraction))]

function playback(arrivals: Arrival[]) {
  let playing = Math.max(0, arrivals[0].step - LAG_STEPS)
  let stepMs = STEP_MS
  const known: Arrival[] = []
  let arrivalIndex = 0
  let stalledFrames = 0
  let frames = 0
  let longestStall = 0
  let currentStall = 0
  const startTime = arrivals[0].arrivedAt
  const endTime = arrivals[arrivals.length - 1].arrivedAt

  for (let now = startTime; now < endTime; now += FRAME_MS) {
    while (arrivalIndex < arrivals.length && arrivals[arrivalIndex].arrivedAt <= now) {
      const arrival = arrivals[arrivalIndex++]
      const last = known[known.length - 1]

      if (last && arrival.step > last.step) {
        const gap = (arrival.arrivedAt - last.arrivedAt) / (arrival.step - last.step)

        if (gap > 80 && gap < 1500) stepMs = stepMs * 0.7 + gap * 0.3
      }

      if (!last || arrival.step > last.step) known.push(arrival)
    }

    const latest = known[known.length - 1]
    const target = latest.step + Math.min(EXTRAPOLATE_MS, now - latest.arrivedAt) / stepMs
    const speed = 1 + Math.max(-0.5, Math.min(0.35, (latest.step - LAG_STEPS - playing) * 0.3))
    const before = playing
    playing = Math.min(target, playing + (FRAME_MS / stepMs) * speed)
    frames++

    if (playing - before < 1e-6) {
      stalledFrames++
      currentStall++
      longestStall = Math.max(longestStall, currentStall * FRAME_MS)
    } else {
      currentStall = 0
    }
  }

  return `LAG ${LAG_STEPS} steps (${Math.round(LAG_STEPS * STEP_MS)} ms), glide ${EXTRAPOLATE_MS} ms: ducks stand still in ${((stalledFrames / frames) * 100).toFixed(1)} % of ${frames} frames, longest stand-still ${Math.round(longestStall)} ms`
}

async function main() {
  if (process.env.TRACE_IN) {
    for (const file of process.env.TRACE_IN.split(',')) {
      console.log(file.split('/').pop(), '->', playback(JSON.parse(fs.readFileSync(file, 'utf8')).map((arrival: { t: number; n: number }) => ({ arrivedAt: arrival.t, step: arrival.n }))))
    }

    return
  }

  const [host, player] = [privateKeyToAccount(generatePrivateKey()), privateKeyToAccount(generatePrivateKey())]
  const [hostToken, playerToken] = await Promise.all([signIn(host), signIn(player)])
  const kali = (await call('/api/catalog/tracks')).find((track: any) => track.slug === (process.env.TRACK || 'kali-code-sprint'))
  const room = await order(hostToken, { kind: 'create_room', trackId: kali.id, roomName: 'Cadence', maxDucks: 50, fillBots: true })
  await order(playerToken, { kind: 'join_room', roomCode: room.roomCode })

  const arrivals: Arrival[] = []
  let settled: any = null
  const socket = io(API, { transports: ['websocket'] })
  socket.on('connect', () => socket.emit('room:watch', { code: room.roomCode }))
  socket.on('race:tick', (message: any) => arrivals.push({ arrivedAt: performance.now(), step: message.n }))
  socket.on('race:settled', (message: any) => (settled = message))
  await sleep(1000)
  await call(`/api/rooms/${room.roomCode}/start`, 'POST', {}, hostToken)

  const deadline = Date.now() + 150_000
  while (!settled && Date.now() < deadline) await sleep(200)
  socket.close()

  assert(arrivals.length > 5, 'ticks arrived')

  if (process.env.TRACE_OUT) fs.writeFileSync(process.env.TRACE_OUT, JSON.stringify(arrivals.map((arrival) => ({ t: arrival.arrivedAt, n: arrival.step }))))

  const gaps = arrivals.slice(1).map((arrival, index) => arrival.arrivedAt - arrivals[index].arrivedAt)
  const stepsPerTick = arrivals.slice(1).map((arrival, index) => arrival.step - arrivals[index].step)
  console.log(`ticks ${arrivals.length}, last step ${arrivals[arrivals.length - 1].step}`)
  console.log(`gap between ticks: min ${Math.round(Math.min(...gaps))} ms, median ${Math.round(quantile(gaps, 0.5))}, p95 ${Math.round(quantile(gaps, 0.95))}, max ${Math.round(Math.max(...gaps))}`)
  console.log(`steps per tick: ${[1, 2, 3, 4].map((count) => `${count}: ${stepsPerTick.filter((steps) => steps === count).length}`).join(' | ')} | more: ${stepsPerTick.filter((steps) => steps > 4).length}`)
  console.log('playback on these arrivals:', playback(arrivals))
  console.log('PASS cadence')
}

main().catch((error) => {
  console.error('FAIL', error)
  process.exit(1)
})
