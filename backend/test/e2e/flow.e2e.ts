/**
 * End-to-end flow on the REAL deployment (plan T-4, T-6, V-2): real backend, real contracts on Monad testnet, real Alchemy RPC.
 * One signature at connect, then: create room, joins, buy a part, loadout, race, result, settlement, titles. It then
 * replays the race from the on-chain seed and compares every position the backend pushed.
 *   API_URL=http://localhost:8080 RPC_URL=<alchemy> npx ts-node -T -r tsconfig-paths/register test/e2e/flow.e2e.ts
 */
import { io } from 'socket.io-client'
import { parseEventLogs, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { raceAbi } from '../../app/Chain/abis'
import { Race, statsFor, type Entrant, type Template } from '../../app/Engine/Race'
import { API, assert, call, chargedMon, mon, order, publicClient, signIn, sleep } from './lib'

async function main() {
  const t0 = Date.now()
  const host = privateKeyToAccount(generatePrivateKey())
  const p1 = privateKeyToAccount(generatePrivateKey())
  const p2 = privateKeyToAccount(generatePrivateKey())

  // 1. ONE signature each, at connect. No popup after this.
  const [ht, t1, t2] = await Promise.all([signIn(host), signIn(p1), signIn(p2)])
  console.log('✓ connect: one signature each', ((Date.now() - t0) / 1000).toFixed(1) + 's')

  const duck = (name: string, template: string) => ({ name, template, bodyColor: '#4ED1C5', billColor: '#FFC93C', cosmetics: { hat: true, shades: false, scarf: false }, equippedPartTypeId: null })
  await call('/api/me/duck', 'PUT', duck('HostDuck', 'tank'), ht)
  await call('/api/me/duck', 'PUT', duck('Alice', 'sprint'), t1)
  await call('/api/me/duck', 'PUT', duck('Bob', 'balanced'), t2)

  const me0 = await call('/api/me', 'GET', undefined, ht)
  assert(BigInt(me0.usdc) >= 5_000_000n, 'a new wallet shows the 5 USDC welcome before its first order')

  // 2. create room (1 USDC) and join (0.10 USDC), with no signature after connect
  const tracks = await call('/api/catalog/tracks')
  const kali = tracks.find((t: any) => t.slug === 'kali-code-sprint')
  const created = await order(ht, { kind: 'create_room', trackId: kali.id, roomName: 'E2E Real', maxDucks: 20, fillBots: true })
  const code = created.roomCode as string
  assert(/^WEK-/.test(code) && created.amount === '1000000', 'create room costs 1 USDC')
  const [j1, j2] = await Promise.all([order(t1, { kind: 'join_room', roomCode: code }), order(t2, { kind: 'join_room', roomCode: code })])
  assert(j1.amount === '100000' && j2.amount === '100000', 'a ticket costs 0.10 USDC')
  console.log('✓ create + 2 joins paid under the session', code)

  // 3. buy a part (1 USDC) with the same session, equip it for this room
  const bought = await order(ht, { kind: 'buy_part', partTypeId: 0 })
  assert(bought.amount === '1000000', 'a part costs 1 USDC')
  await call(`/api/rooms/${code}/loadout`, 'PUT', { partTypeId: 0 }, ht)
  const me1 = await call('/api/me', 'GET', undefined, ht)
  assert(me1.parts.includes(0), 'the part license is in the wallet')
  assert(BigInt(me1.usdc) < BigInt(me0.usdc), 'USDC went down after the payments')
  console.log('✓ buy part + loadout, USDC', me0.usdc, '→', me1.usdc)

  // 4. a second order of the same kind is rejected, and nothing can be charged without a session
  const again = await order(ht, { kind: 'join_room', roomCode: code })
  assert(again.alreadyIn === true, 'the host is already in: no second charge')
  let noSession = false
  try { await order('not-a-token', { kind: 'join_room', roomCode: code }) } catch (e) { noSession = (e as any).status === 401 }
  assert(noSession, 'an order without a valid session is a 401')

  // 5. race
  const sock = io(API, { transports: ['websocket'] })
  const grid: any[] = []
  const ticks: any[] = []
  let go: any = null
  let result: any = null
  let settled: any = null
  sock.on('connect', () => sock.emit('room:watch', { code }))
  sock.on('race:grid', (g: any) => grid.push(g))
  sock.on('race:go', (g: any) => (go = g))
  sock.on('race:tick', (t: any) => ticks.push(t))
  sock.on('race:result', (r: any) => (result = r))
  sock.on('race:settled', (s: any) => (settled = s))
  await sleep(800)
  const started = await call(`/api/rooms/${code}/start`, 'POST', {}, ht)
  console.log('✓ start', started)
  // T-3: what a tick costs. Monad charges the gas limit, so the figure to set TICK_GAS from is estimateGas of a real tick in a started room.
  while (!go && Date.now() < Date.now() + 20_000) await sleep(100)
  if (process.env.OPERATOR_ADDRESS && go?.tx) {
    const rc0 = await publicClient().getTransactionReceipt({ hash: go.tx as Hex })
    const roomId = parseEventLogs({ abi: raceAbi, logs: rc0.logs, eventName: 'Started' })[0]?.args.roomId
    const race = rc0.to as Hex
    const est = await publicClient().estimateContractGas({ account: process.env.OPERATOR_ADDRESS as Hex, address: race, abi: raceAbi, functionName: 'tick', args: [roomId!] }).catch((e: Error) => e.message.slice(0, 80))
    console.log('  T-3 estimateGas of tick on Monad:', est)
  }
  const until = Date.now() + 150_000
  while (!settled && Date.now() < until) await sleep(300)
  sock.close()
  assert(go && go.tx, 'race:go carries the start transaction')
  assert(result && settled, 'the race finished and settled')
  assert(settled.ok, 'finalize succeeded on-chain')
  const steps = ticks.map((t) => t.n)
  assert(steps.every((n, i) => i === 0 || n > steps[i - 1]), 'step numbers only go up')
  console.log(`✓ race: ${ticks.length} tick broadcasts, last step ${steps[steps.length - 1]}, winner ${result.ranking[0].name}, titles ${settled.titles.length}`)

  // 6. T-4: replay from the on-chain seed, the participant list and the step numbers
  const pc = publicClient()
  const startRc = await pc.getTransactionReceipt({ hash: go.tx as Hex })
  const ev = parseEventLogs({ abi: raceAbi, logs: startRc.logs, eventName: 'Started' })[0]
  assert(ev, 'Started event in the start receipt')
  const parts = await call('/api/catalog/parts')
  const entrants: Entrant[] = grid[0].entrants.map((e: any) => ({
    id: String(e.i), name: e.name, color: e.color, human: e.human, address: e.address,
    stats: statsFor(e.template as Template, e.partTypeId === null ? null : parts.find((p: any) => p.typeId === e.partTypeId)),
    build: '',
  }))
  const profile = kali.profile
  const fresh = new Race({ raceId: grid[0].raceId, seed: ev.args.seed, entrants, profile, laps: kali.laps })
  let bad = 0
  for (const t of ticks) {
    fresh.advanceTo(t.n)
    if (JSON.stringify(fresh.positions()) !== JSON.stringify(t.p)) bad++
  }
  assert(bad === 0, `replay from the on-chain seed reproduces every pushed position (${bad} differences)`)
  console.log(`✓ replay: ${ticks.length} / ${ticks.length} ticks identical to the backend (seed ${ev.args.seed.slice(0, 12)}…)`)

  // 7. money: exact MON per phase from the receipts
  const tickHashes = ticks.map((t) => t.tx as string).filter(Boolean)
  const phases: [string, string[]][] = [
    ['create room', [created.tx]],
    ['joins (batch)', [...new Set([j1.tx, j2.tx])]],
    ['buy part', [bought.tx]],
    ['start', [go.tx]],
    [`${tickHashes.length} ticks`, tickHashes],
    ['finalize', [settled.tx]],
  ]
  let total = 0n
  for (const [name, hs] of phases) {
    const c = await chargedMon([...new Set(hs)])
    total += c.total
    console.log(`  ${name.padEnd(14)} ${mon(c.total)} MON`)
  }
  console.log(`  ${'total'.padEnd(14)} ${mon(total)} MON  (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
  const health = await call('/api/health')
  console.log('  rpc calls so far:', JSON.stringify(health.rpc))
  console.log('PASS e2e')
}

main().catch((e) => {
  console.error('FAIL', e)
  process.exit(1)
})
