import { io } from 'socket.io-client'
import { encodeAbiParameters, keccak256, parseEventLogs, zeroAddress, type Address, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { raceAbi } from '../../app/Chain/abis'
import { cheersRoot, standingRoot, type CheerLog } from '../../app/Engine/Cheers'
import { Race, statsFor, type Entrant, type Template } from '../../app/Engine/Race'
import { API, assert, call, order, publicClient, signIn, sleep } from './lib'

async function main() {
  const [tapper, idler, outsider] = [1, 2, 3].map(() => privateKeyToAccount(generatePrivateKey()))
  const [tapperToken, idlerToken, outsiderToken] = await Promise.all([signIn(tapper), signIn(idler), signIn(outsider)])
  const duck = (name: string) => ({ name, template: 'balanced', bodyColor: '#4ED1C5', billColor: '#FFC93C', cosmetics: { hat: false, shades: false, scarf: false }, equippedPartTypeId: null })
  await call('/api/me/duck', 'PUT', duck('Tapper'), tapperToken)
  await call('/api/me/duck', 'PUT', duck('Idler'), idlerToken)

  const tracks = await call('/api/catalog/tracks')
  const kali = tracks.find((track: any) => track.slug === 'kali-code-sprint')
  const room = await order(tapperToken, { kind: 'create_room', trackId: kali.id, roomName: 'Cheer test', maxDucks: 20, fillBots: true })
  const code = room.roomCode as string
  await order(idlerToken, { kind: 'join_room', roomCode: code })
  console.log('✓ room', code, 'tapper hosts, idler joined, outsider did not join')

  const watch = (token: string | null) => {
    const socket = io(API, { transports: ['websocket'] })
    socket.on('connect', () => {
      socket.emit('room:watch', { code })

      if (token) socket.emit('auth', { token })
    })

    return socket
  }
  const tapperSocket = watch(tapperToken)
  const outsiderSocket = watch(outsiderToken)
  const anonymousSocket = watch(null)
  const grids: any[] = []
  const ticks: any[] = []
  let go: any = null
  let result: any = null
  let settled: any = null
  tapperSocket.on('race:grid', (grid: any) => grids.push(grid))
  tapperSocket.on('race:go', (message: any) => (go = message))
  tapperSocket.on('race:tick', (tick: any) => ticks.push(tick))
  tapperSocket.on('race:result', (message: any) => (result = message))
  tapperSocket.on('race:settled', (message: any) => (settled = message))
  await sleep(1200)
  await call(`/api/rooms/${code}/start`, 'POST', {}, tapperToken)

  for (let tap = 0; tap < 10; tap++) tapperSocket.emit('race:cheer')

  while (!go) await sleep(100)

  let sent = 0
  const startedAt = Date.now()
  const timer = setInterval(() => {
    tapperSocket.emit('race:cheer')
    outsiderSocket.emit('race:cheer')
    anonymousSocket.emit('race:cheer')
    sent++
  }, 1000 / 12)
  const deadline = Date.now() + 150_000
  while (!settled && Date.now() < deadline) await sleep(200)
  clearInterval(timer)

  const seconds = (Date.now() - startedAt) / 1000
  ;[tapperSocket, outsiderSocket, anonymousSocket].forEach((socket) => socket.close())
  assert(result && settled?.ok, 'the race finished and settled')

  const log: CheerLog = {}
  for (const [step, tapsByDuck] of Object.entries(result.cheers as Record<string, Record<string, number>>)) {
    log[Number(step)] = Object.fromEntries(Object.entries(tapsByDuck).map(([duckIndex, taps]) => [Number(duckIndex), taps]))
  }

  const gridEntrants = grids[0].entrants as any[]
  const tapperIndex = gridEntrants.findIndex((entrant) => entrant.address === tapper.address.toLowerCase())
  const idlerIndex = gridEntrants.findIndex((entrant) => entrant.address === idler.address.toLowerCase())
  const totalTaps = (duckIndex: number) => Object.values(log).reduce((sum, tapsByDuck) => sum + (tapsByDuck[duckIndex] || 0), 0)
  const accepted = totalTaps(tapperIndex)
  const humanIndexes = new Set(gridEntrants.filter((entrant) => entrant.human).map((entrant) => entrant.i))
  console.log(`✓ taps sent ${sent} in ${seconds.toFixed(0)} s, accepted ${accepted}; idler ${totalTaps(idlerIndex)}`)

  assert(accepted > 0, 'the tapper\'s taps counted')
  assert(accepted <= Math.ceil(seconds) * 5 + 5, `at most 5 taps per second count (${accepted} accepted in ${seconds.toFixed(0)} s)`)
  assert(accepted < sent, 'taps above the limit are dropped')
  assert(totalTaps(idlerIndex) === 0, 'the idler has no taps')
  assert(Object.values(log).every((tapsByDuck) => Object.keys(tapsByDuck).every((duckIndex) => humanIndexes.has(Number(duckIndex)))), 'the log has no one but human entrants (not the outsider, not the anonymous socket, not bots)')
  assert(!Object.keys(log).some((step) => Number(step) < 1), 'no tap counted before the race')

  const placeOf = (duckIndex: number) => result.ranking.findIndex((row: any) => row.i === duckIndex) + 1
  console.log(`  finishing places in a field of ${result.field}: tapper ${placeOf(tapperIndex)}, idler ${placeOf(idlerIndex)} (one race says little; test/engine/rank.script.ts has the averages)`)

  const tapperBoost = Math.max(...ticks.map((tick) => tick.en?.[tapperIndex] ?? 0))
  const idlerBoost = Math.max(...ticks.map((tick) => tick.en?.[idlerIndex] ?? 0))
  console.log(`✓ energy shown on the ticks: tapper up to ${tapperBoost} %, idler up to ${idlerBoost} %`)

  assert(tapperBoost >= 50 && idlerBoost === 0, 'the tapper is boosted and the idler is not')

  const client = publicClient()
  const startReceipt = await client.getTransactionReceipt({ hash: go.tx as Hex })
  const startedEvent = parseEventLogs({ abi: raceAbi, logs: startReceipt.logs, eventName: 'Started' })[0]
  const parts = await call('/api/catalog/parts')
  const entrants: Entrant[] = gridEntrants.map((entrant: any) => ({
    id: String(entrant.i),
    name: entrant.name,
    color: entrant.color,
    human: entrant.human,
    address: entrant.address,
    stats: statsFor(entrant.template as Template, entrant.partTypeId === null ? null : parts.find((part: any) => part.typeId === entrant.partTypeId)),
    build: '',
  }))
  const replay = new Race({ raceId: grids[0].raceId, seed: startedEvent!.args.seed, entrants, profile: kali.profile, laps: kali.laps })
  let differences = 0
  for (const tick of ticks) {
    replay.advanceTo(tick.n, (step) => log[step])

    if (JSON.stringify(replay.positions()) !== JSON.stringify(tick.p) || JSON.stringify(replay.boost()) !== JSON.stringify(tick.en)) differences++
  }

  assert(differences === 0, `replay from seed + cheer log reproduces every tick (${differences} differences)`)
  console.log(`✓ replay: ${ticks.length} / ${ticks.length} ticks identical (positions and energy) from the on-chain seed and the published log`)

  assert(cheersRoot(log) === result.cheersRoot, 'cheersRoot recomputed from the log equals the published one')

  const raceRoot = keccak256(
    encodeAbiParameters(
      [{ type: 'uint64' }, { type: 'uint64' }, { type: 'uint64' }, { type: 'address[]' }],
      [BigInt(result.raceId), BigInt(result.startBlock), BigInt(result.endBlock), result.ranking.map((row: any) => (row.address || zeroAddress) as Address)],
    ),
  )
  const finalizeReceipt = await client.getTransactionReceipt({ hash: settled.tx as Hex })
  const finalizedEvent = parseEventLogs({ abi: raceAbi, logs: finalizeReceipt.logs, eventName: 'Finalized' })[0]

  assert(finalizedEvent!.args.standingRoot === standingRoot(raceRoot, cheersRoot(log)), 'the standing root on chain commits to the standings and to the cheer log')
  assert(finalizedEvent!.args.standingRoot !== standingRoot(raceRoot, cheersRoot({})), 'and it would differ without the log')
  console.log('✓ the standing root on chain =', finalizedEvent!.args.standingRoot.slice(0, 14) + '…, recomputed from the published standings and log')
  console.log('PASS cheer e2e')
}

main().catch((error) => {
  console.error('FAIL', error)
  process.exit(1)
})
