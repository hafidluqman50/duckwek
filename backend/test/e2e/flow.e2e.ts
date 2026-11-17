import { io } from 'socket.io-client'
import { parseEventLogs, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { raceAbi } from '../../app/Chain/abis'
import { Race, statsFor, type Entrant, type Template } from '../../app/Engine/Race'
import { API, assert, call, chargedMon, mon, order, publicClient, signIn, sleep } from './lib'

async function main() {
  const startedAt = Date.now()
  const host = privateKeyToAccount(generatePrivateKey())
  const alice = privateKeyToAccount(generatePrivateKey())
  const bob = privateKeyToAccount(generatePrivateKey())

  const [hostToken, aliceToken, bobToken] = await Promise.all([signIn(host), signIn(alice), signIn(bob)])
  console.log('✓ connect: one signature each', ((Date.now() - startedAt) / 1000).toFixed(1) + 's')

  const duck = (name: string, template: string) => ({ name, template, bodyColor: '#4ED1C5', billColor: '#FFC93C', cosmetics: { hat: true, shades: false, scarf: false }, equippedPartTypeId: null })
  await call('/api/me/duck', 'PUT', duck('HostDuck', 'tank'), hostToken)
  await call('/api/me/duck', 'PUT', duck('Alice', 'sprint'), aliceToken)
  await call('/api/me/duck', 'PUT', duck('Bob', 'balanced'), bobToken)

  const hostProfileBefore = await call('/api/me', 'GET', undefined, hostToken)
  assert(BigInt(hostProfileBefore.usdc) >= 5_000_000n, 'a new wallet shows the 5 USDC welcome before its first order')

  const boughtHostPart = await order(hostToken, { kind: 'buy_part', partTypeId: 0 })
  assert(boughtHostPart.amount === '1000000', 'a part costs 1 USDC')
  await call('/api/me/duck', 'PUT', { ...duck('HostDuck', 'tank'), equippedPartTypeId: 0 }, hostToken)
  await order(aliceToken, { kind: 'buy_part', partTypeId: 1 })
  await call('/api/me/duck', 'PUT', { ...duck('Alice', 'sprint'), equippedPartTypeId: 1 }, aliceToken)

  const hostProfileAfter = await call('/api/me', 'GET', undefined, hostToken)
  assert(hostProfileAfter.parts.includes(0), 'the part licence is in the wallet')
  assert(BigInt(hostProfileAfter.usdc) < BigInt(hostProfileBefore.usdc), 'USDC went down after the payment')
  console.log('✓ buy + equip a part before joining, USDC', hostProfileBefore.usdc, '→', hostProfileAfter.usdc)

  const tracks = await call('/api/catalog/tracks')
  const kali = tracks.find((track: any) => track.slug === 'kali-code-sprint')
  const created = await order(hostToken, { kind: 'create_room', trackId: kali.id, roomName: 'E2E Real', maxDucks: 20, fillBots: true })
  const code = created.roomCode as string
  assert(/^WEK-/.test(code) && created.amount === '1000000', 'create room costs 1 USDC')

  const [aliceJoin, bobJoin] = await Promise.all([order(aliceToken, { kind: 'join_room', roomCode: code }), order(bobToken, { kind: 'join_room', roomCode: code })])
  assert(aliceJoin.amount === '100000' && bobJoin.amount === '100000', 'a ticket costs 0.10 USDC')
  console.log('✓ create + 2 joins paid under the session', code)

  const state = await call(`/api/rooms/${code}`)
  const playerByAddress = (address: string) => state.players.find((player: any) => player.address.toLowerCase() === address.toLowerCase())
  assert(playerByAddress(host.address).partTypeId === 0 && playerByAddress(host.address).template === 'tank', 'the host races with the part and template committed at create')
  assert(playerByAddress(alice.address).partTypeId === 1 && playerByAddress(alice.address).template === 'sprint', 'Alice races with the part and template committed at join')
  assert(playerByAddress(bob.address).partTypeId === null, 'Bob joined without a part')

  let loadoutLocked = false
  try {
    await call(`/api/rooms/${code}/loadout`, 'PUT', { partTypeId: 0 }, bobToken)
  } catch (error) {
    loadoutLocked = (error as any).status === 409
  }

  assert(loadoutLocked, 'a loadout cannot change after the join committed it on chain')
  console.log('✓ the loadout is committed at join and locked')

  const secondJoin = await order(hostToken, { kind: 'join_room', roomCode: code })
  assert(secondJoin.alreadyIn === true, 'the host is already in: no second charge')

  let rejectedWithoutSession = false
  try {
    await order('not-a-token', { kind: 'join_room', roomCode: code })
  } catch (error) {
    rejectedWithoutSession = (error as any).status === 401
  }

  assert(rejectedWithoutSession, 'an order without a valid session is a 401')

  const socket = io(API, { transports: ['websocket'] })
  const grids: any[] = []
  const ticks: any[] = []
  let go: any = null
  let result: any = null
  let settled: any = null
  socket.on('connect', () => socket.emit('room:watch', { code }))
  socket.on('race:grid', (grid: any) => grids.push(grid))
  socket.on('race:go', (message: any) => (go = message))
  socket.on('race:tick', (tick: any) => ticks.push(tick))
  socket.on('race:result', (message: any) => (result = message))
  socket.on('race:settled', (message: any) => (settled = message))
  await sleep(800)

  const started = await call(`/api/rooms/${code}/start`, 'POST', {}, hostToken)
  console.log('✓ start', started)

  while (!go && Date.now() < Date.now() + 20_000) await sleep(100)

  if (process.env.OPERATOR_ADDRESS && go?.tx) {
    const startReceipt = await publicClient().getTransactionReceipt({ hash: go.tx as Hex })
    const roomId = parseEventLogs({ abi: raceAbi, logs: startReceipt.logs, eventName: 'Started' })[0]?.args.roomId
    const raceContract = startReceipt.to as Hex
    const tickGasEstimate = await publicClient()
      .estimateContractGas({ account: process.env.OPERATOR_ADDRESS as Hex, address: raceContract, abi: raceAbi, functionName: 'tick', args: [roomId!] })
      .catch((error: Error) => error.message.slice(0, 80))
    console.log('  T-3 estimateGas of tick on Monad:', tickGasEstimate)
  }

  const deadline = Date.now() + 150_000
  while (!settled && Date.now() < deadline) await sleep(300)
  socket.close()

  assert(go && go.tx, 'race:go carries the start transaction')
  assert(result && settled, 'the race finished and settled')
  assert(settled.ok, 'finalize succeeded on-chain')

  const steps = ticks.map((tick) => tick.n)
  assert(steps.every((step, index) => index === 0 || step > steps[index - 1]), 'step numbers only go up')
  console.log(`✓ race: ${ticks.length} tick broadcasts, last step ${steps[steps.length - 1]}, winner ${result.ranking[0].name}, titles ${settled.titles.length}`)

  const client = publicClient()
  const startReceipt = await client.getTransactionReceipt({ hash: go.tx as Hex })
  const startedEvent = parseEventLogs({ abi: raceAbi, logs: startReceipt.logs, eventName: 'Started' })[0]
  assert(startedEvent, 'Started event in the start receipt')

  const parts = await call('/api/catalog/parts')
  const entrants: Entrant[] = grids[0].entrants.map((entrant: any) => ({
    id: String(entrant.i),
    name: entrant.name,
    color: entrant.color,
    human: entrant.human,
    address: entrant.address,
    stats: statsFor(entrant.template as Template, entrant.partTypeId === null ? null : parts.find((part: any) => part.typeId === entrant.partTypeId)),
    build: '',
  }))
  const replay = new Race({ raceId: grids[0].raceId, seed: startedEvent.args.seed, entrants, profile: kali.profile, laps: kali.laps })
  let differences = 0
  for (const tick of ticks) {
    replay.advanceTo(tick.n)

    if (JSON.stringify(replay.positions()) !== JSON.stringify(tick.p)) differences++
  }

  assert(differences === 0, `replay from the on-chain seed reproduces every pushed position (${differences} differences)`)
  console.log(`✓ replay: ${ticks.length} / ${ticks.length} ticks identical to the backend (seed ${startedEvent.args.seed.slice(0, 12)}…)`)

  const tickHashes = ticks.map((tick) => tick.tx as string).filter(Boolean)
  const phases: [string, string[]][] = [
    ['create room', [created.tx]],
    ['joins (batch)', [...new Set([aliceJoin.tx, bobJoin.tx])]],
    ['buy part', [boughtHostPart.tx]],
    ['start', [go.tx]],
    [`${tickHashes.length} ticks`, tickHashes],
    ['finalize', [settled.tx]],
  ]
  let total = 0n
  for (const [name, hashes] of phases) {
    const charged = await chargedMon([...new Set(hashes)])
    total += charged.total
    console.log(`  ${name.padEnd(14)} ${mon(charged.total)} MON`)
  }

  console.log(`  ${'total'.padEnd(14)} ${mon(total)} MON  (${((Date.now() - startedAt) / 1000).toFixed(0)} s)`)

  const health = await call('/api/health')
  console.log('  rpc calls so far:', JSON.stringify(health.rpc))
  console.log('PASS e2e')
}

main().catch((error) => {
  console.error('FAIL', error)
  process.exit(1)
})
