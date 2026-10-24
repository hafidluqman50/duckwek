/**
 * Load test on the REAL deployment (plan T-2, T-3, T-7, T-8, T-11): N generated wallets, each with its own real signature,
 * connect and join one room at once; W sockets watch; the race runs; exact MON and RPC calls are reported.
 * These are test wallets signing real messages and sending real transactions to the deployed contracts, from one machine.
 * It does NOT prove 200 phones on 200 networks.
 *   API_URL=http://localhost:8080 RPC_URL=<alchemy> N=200 W=200 npx ts-node -T -r tsconfig-paths/register test/load/loadtest.ts
 */
import { io, type Socket } from 'socket.io-client'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { API, assert, call, chargedMon, mon, order, signIn, sleep } from '../e2e/lib'

const N = Number(process.env.N || 50)
const W = Number(process.env.W || 100)
const TRACK = process.env.TRACK || 'alpine-ring'
const CONCURRENCY = Number(process.env.CONCURRENCY || 50)
const pct = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))]

async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }))
  return out
}

async function main() {
  const host = privateKeyToAccount(generatePrivateKey())
  const ht = await signIn(host)
  await call('/api/me/duck', 'PUT', { name: 'LoadHost', template: 'sprint', bodyColor: '#FFC93C', billColor: '#FF9F1C', cosmetics: { hat: true, shades: false, scarf: false }, equippedPartTypeId: null }, ht)
  const tracks = await call('/api/catalog/tracks')
  const track = tracks.find((t: any) => t.slug === TRACK)
  const created = await order(ht, { kind: 'create_room', trackId: track.id, roomName: `Load ${N}`, maxDucks: 200, fillBots: true })
  const code = created.roomCode as string
  console.log('room', code, 'on', track.name)
  const rpc0 = (await call('/api/health')).rpc

  // N players: ONE signature each, then one order each. Time = connect + pay + recorded on-chain.
  const accs = Array.from({ length: N }, () => privateKeyToAccount(generatePrivateKey()))
  const t0 = Date.now()
  const joined = await pool(accs, CONCURRENCY, async (a, i) => {
    const s0 = Date.now()
    const token = await signIn(a)
    await call('/api/me/duck', 'PUT', { name: `P${i}`, template: ['balanced', 'sprint', 'tank'][i % 3], bodyColor: '#7CC6FE', billColor: '#FF9F1C', cosmetics: { hat: false, shades: false, scarf: false }, equippedPartTypeId: null }, token)
    const r = await order(token, { kind: 'join_room', roomCode: code })
    return { ms: Date.now() - s0, tx: r.tx as string }
  })
  const wall = Date.now() - t0
  const lat = joined.map((j) => j.ms)
  const batches = [...new Set(joined.map((j) => j.tx))]
  console.log(`✓ ${N} players joined in ${(wall / 1000).toFixed(1)} s | per player p50 ${pct(lat, 0.5)} ms, p90 ${pct(lat, 0.9)} ms, max ${Math.max(...lat)} ms | ${batches.length} joinBatch transaction(s)`)
  const room = await call(`/api/rooms/${code}`)
  assert(room.count === N + 1, `the room has ${N + 1} players, got ${room.count}`)

  // W watchers, then the race
  const socks: Socket[] = Array.from({ length: W }, () => io(API, { transports: ['websocket'] }))
  let ticks = 0
  let result: any = null
  let settled: any = null
  let go: any = null
  const txs: string[] = []
  socks.forEach((s, i) => {
    s.on('connect', () => s.emit('room:watch', { code }))
    if (i === 0) {
      s.on('race:go', (g: any) => (go = g))
      s.on('race:tick', (t: any) => { ticks++; if (t.tx) txs.push(t.tx) })
      s.on('race:result', (r: any) => (result = r))
      s.on('race:settled', (x: any) => (settled = x))
    }
  })
  await sleep(1500)
  await call(`/api/rooms/${code}/start`, 'POST', {}, ht)
  const until = Date.now() + 180_000
  while (!settled && Date.now() < until) await sleep(300)
  socks.forEach((s) => s.close())
  assert(result && settled?.ok, 'the race finished and settled on-chain')
  console.log(`✓ race done: ${ticks} tick broadcasts, field ${result.field}, winner ${result.ranking[0].name}`)

  // money and RPC, exact
  const c = (hs: string[]) => chargedMon([...new Set(hs)])
  const rows: [string, bigint][] = []
  rows.push(['create room', (await c([created.tx])).total])
  rows.push([`join (${batches.length} batch)`, (await c(batches)).total])
  rows.push(['start', (await c([go.tx])).total])
  rows.push([`${txs.length} ticks`, (await c(txs)).total])
  rows.push(['finalize', (await c([settled.tx])).total])
  const total = rows.reduce((a, [, w]) => a + w, 0n)
  for (const [n, w] of rows) console.log(`  ${n.padEnd(18)} ${mon(w)} MON`)
  console.log(`  ${'total'.padEnd(18)} ${mon(total)} MON`)
  const rpc1 = (await call('/api/health')).rpc
  console.log('  rpc calls during the test:', rpc1.calls - rpc0.calls, '| computed CU:', rpc1.cu - rpc0.cu, '| methods:', JSON.stringify(rpc1.methods), '| unpriced:', JSON.stringify(rpc1.unpriced))
  console.log('PASS load')
}

main().catch((e) => {
  console.error('FAIL', e)
  process.exit(1)
})
