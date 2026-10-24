/**
 * Cheer on the REAL deployment (plan §3.10, T-14 and T-15): one player taps faster than the limit, one never taps, one wallet is not
 * in the room. Checks the rules, that the boost shows up, the replay from the seed + the published cheer log, and that the standing
 * root on chain commits to the log.
 *   API_URL=… RPC_URL=… npx ts-node -T -r tsconfig-paths/register test/e2e/cheer.e2e.ts
 */
import { io } from 'socket.io-client'
import { encodeAbiParameters, keccak256, parseEventLogs, zeroAddress, type Address, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { raceAbi } from '../../app/Chain/abis'
import { cheersRoot, standingRoot, type CheerLog } from '../../app/Engine/Cheers'
import { Race, statsFor, type Entrant, type Template } from '../../app/Engine/Race'
import { API, assert, call, order, publicClient, signIn, sleep } from './lib'

async function main() {
  const [tapper, idler, outsider] = [1, 2, 3].map(() => privateKeyToAccount(generatePrivateKey()))
  const [tt, it, ot] = await Promise.all([signIn(tapper), signIn(idler), signIn(outsider)])
  const duck = (name: string) => ({ name, template: 'balanced', bodyColor: '#4ED1C5', billColor: '#FFC93C', cosmetics: { hat: false, shades: false, scarf: false }, equippedPartTypeId: null })
  await call('/api/me/duck', 'PUT', duck('Tapper'), tt)
  await call('/api/me/duck', 'PUT', duck('Idler'), it)
  const tracks = await call('/api/catalog/tracks')
  const kali = tracks.find((t: any) => t.slug === 'kali-code-sprint')
  const room = await order(tt, { kind: 'create_room', trackId: kali.id, roomName: 'Cheer test', maxDucks: 20, fillBots: true })
  const code = room.roomCode as string
  await order(it, { kind: 'join_room', roomCode: code })
  console.log('✓ room', code, 'tapper hosts, idler joined, outsider did not join')

  const watch = (token: string | null) => {
    const s = io(API, { transports: ['websocket'] })
    s.on('connect', () => { s.emit('room:watch', { code }); if (token) s.emit('auth', { token }) })
    return s
  }
  const sTap = watch(tt)
  const sOut = watch(ot)
  const sAnon = watch(null)
  const grid: any[] = []
  const ticks: any[] = []
  let go: any = null
  let result: any = null
  let settled: any = null
  sTap.on('race:grid', (g: any) => grid.push(g))
  sTap.on('race:go', (g: any) => (go = g))
  sTap.on('race:tick', (t: any) => ticks.push(t))
  sTap.on('race:result', (r: any) => (result = r))
  sTap.on('race:settled', (x: any) => (settled = x))
  await sleep(1200)
  await call(`/api/rooms/${code}/start`, 'POST', {}, tt)

  // taps before the race runs count for nothing
  for (let i = 0; i < 10; i++) sTap.emit('race:cheer')
  while (!go) await sleep(100)
  // 12 taps per second for the whole race from the tapper (the limit is 5), taps from a wallet outside the room and from an anonymous socket
  let sent = 0
  const t0 = Date.now()
  const timer = setInterval(() => { sTap.emit('race:cheer'); sOut.emit('race:cheer'); sAnon.emit('race:cheer'); sent++ }, 1000 / 12)
  const until = Date.now() + 150_000
  while (!settled && Date.now() < until) await sleep(200)
  clearInterval(timer)
  const secs = (Date.now() - t0) / 1000
  ;[sTap, sOut, sAnon].forEach((s) => s.close())
  assert(result && settled?.ok, 'the race finished and settled')

  const log: CheerLog = {}
  for (const [step, m] of Object.entries(result.cheers as Record<string, Record<string, number>>)) log[Number(step)] = Object.fromEntries(Object.entries(m).map(([k, v]) => [Number(k), v]))
  const entrants0 = grid[0].entrants as any[]
  const idxTap = entrants0.findIndex((e) => e.address === tapper.address.toLowerCase())
  const idxIdle = entrants0.findIndex((e) => e.address === idler.address.toLowerCase())
  const total = (idx: number) => Object.values(log).reduce((a, m) => a + (m[idx] || 0), 0)
  const accepted = total(idxTap)
  const humans = new Set(entrants0.filter((e) => e.human).map((e) => e.i))
  console.log(`✓ taps sent ${sent} in ${secs.toFixed(0)} s, accepted ${accepted}; idler ${total(idxIdle)}`)
  assert(accepted > 0, 'the tapper\'s taps counted')
  assert(accepted <= Math.ceil(secs) * 5 + 5, `at most 5 taps per second count (${accepted} accepted in ${secs.toFixed(0)} s)`)
  assert(accepted < sent, 'taps above the limit are dropped')
  assert(total(idxIdle) === 0, 'the idler has no taps')
  assert(Object.values(log).every((m) => Object.keys(m).every((k) => humans.has(Number(k)))), 'the log has no one but human entrants (not the outsider, not the anonymous socket, not bots)')
  assert(!Object.keys(log).some((s) => Number(s) < 1), 'no tap counted before the race')

  const place = (idx: number) => result.ranking.findIndex((r: any) => r.i === idx) + 1
  console.log(`  finishing places in a field of ${result.field}: tapper ${place(idxTap)}, idler ${place(idxIdle)} (one race says little; test/engine/rank.script.ts has the averages)`)
  const boostTap = Math.max(...ticks.map((t) => t.en?.[idxTap] ?? 0))
  const boostIdle = Math.max(...ticks.map((t) => t.en?.[idxIdle] ?? 0))
  console.log(`✓ energy shown on the ticks: tapper up to ${boostTap} %, idler up to ${boostIdle} %`)
  assert(boostTap >= 50 && boostIdle === 0, 'the tapper is boosted and the idler is not')

  // replay: seed from the chain + participants + the published log reproduces every pushed tick
  const pc = publicClient()
  const startRc = await pc.getTransactionReceipt({ hash: go.tx as Hex })
  const ev = parseEventLogs({ abi: raceAbi, logs: startRc.logs, eventName: 'Started' })[0]
  const parts = await call('/api/catalog/parts')
  const entrants: Entrant[] = entrants0.map((e: any) => ({ id: String(e.i), name: e.name, color: e.color, human: e.human, address: e.address, stats: statsFor(e.template as Template, e.partTypeId === null ? null : parts.find((p: any) => p.typeId === e.partTypeId)), build: '' }))
  const fresh = new Race({ raceId: grid[0].raceId, seed: ev!.args.seed, entrants, profile: kali.profile, laps: kali.laps })
  let bad = 0
  for (const t of ticks) {
    fresh.advanceTo(t.n, (step) => log[step])
    if (JSON.stringify(fresh.positions()) !== JSON.stringify(t.p) || JSON.stringify(fresh.boost()) !== JSON.stringify(t.en)) bad++
  }
  assert(bad === 0, `replay from seed + cheer log reproduces every tick (${bad} differences)`)
  console.log(`✓ replay: ${ticks.length} / ${ticks.length} ticks identical (positions and energy) from the on-chain seed and the published log`)

  // commitment: the cheers root recomputed from the log, and the standing root on chain
  assert(cheersRoot(log) === result.cheersRoot, 'cheersRoot recomputed from the log equals the published one')
  const raceRoot = keccak256(encodeAbiParameters([{ type: 'uint64' }, { type: 'uint64' }, { type: 'uint64' }, { type: 'address[]' }], [BigInt(result.raceId), BigInt(result.startBlock), BigInt(result.endBlock), result.ranking.map((r: any) => (r.address || zeroAddress) as Address)]))
  const finRc = await pc.getTransactionReceipt({ hash: settled.tx as Hex })
  const fin = parseEventLogs({ abi: raceAbi, logs: finRc.logs, eventName: 'Finalized' })[0]
  assert(fin!.args.standingRoot === standingRoot(raceRoot, cheersRoot(log)), 'the standing root on chain commits to the standings and to the cheer log')
  assert(fin!.args.standingRoot !== standingRoot(raceRoot, cheersRoot({})), 'and it would differ without the log')
  console.log('✓ the standing root on chain =', fin!.args.standingRoot.slice(0, 14) + '…, recomputed from the published standings and log')
  console.log('PASS cheer e2e')
}

main().catch((e) => {
  console.error('FAIL', e)
  process.exit(1)
})
