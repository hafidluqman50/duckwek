import { io, type Socket } from 'socket.io-client'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { API, assert, call, chargedMon, mon, order, signIn, sleep } from '../e2e/lib'

const N = Number(process.env.N || 50)
const W = Number(process.env.W || 100)
const TRACK = process.env.TRACK || 'alpine-ring'
const CONCURRENCY = Number(process.env.CONCURRENCY || 50)

const percentile = (values: number[], fraction: number) =>
  [...values].sort((first, second) => first - second)[Math.min(values.length - 1, Math.floor(fraction * values.length))]

async function runWithConcurrency<Item, Result>(items: Item[], limit: number, work: (item: Item, index: number) => Promise<Result>): Promise<Result[]> {
  const results: Result[] = new Array(items.length)
  let nextIndex = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++
        results[index] = await work(items[index], index)
      }
    }),
  )

  return results
}

async function main() {
  const host = privateKeyToAccount(generatePrivateKey())
  const hostToken = await signIn(host)
  await call('/api/me/duck', 'PUT', { name: 'LoadHost', template: 'sprint', bodyColor: '#FFC93C', billColor: '#FF9F1C', cosmetics: { hat: true, shades: false, scarf: false }, equippedPartTypeId: null }, hostToken)

  const tracks = await call('/api/catalog/tracks')
  const track = tracks.find((candidate: any) => candidate.slug === TRACK)
  const created = await order(hostToken, { kind: 'create_room', trackId: track.id, roomName: `Load ${N}`, maxDucks: 200, fillBots: true })
  const code = created.roomCode as string
  console.log('room', code, 'on', track.name)

  const rpcBefore = (await call('/api/health')).rpc

  const accounts = Array.from({ length: N }, () => privateKeyToAccount(generatePrivateKey()))
  const startedAt = Date.now()
  const joined = await runWithConcurrency(accounts, CONCURRENCY, async (account, index) => {
    const playerStartedAt = Date.now()
    const token = await signIn(account)
    await call('/api/me/duck', 'PUT', { name: `P${index}`, template: ['balanced', 'sprint', 'tank'][index % 3], bodyColor: '#7CC6FE', billColor: '#FF9F1C', cosmetics: { hat: false, shades: false, scarf: false }, equippedPartTypeId: null }, token)
    const joinOrder = await order(token, { kind: 'join_room', roomCode: code })

    return { ms: Date.now() - playerStartedAt, tx: joinOrder.tx as string }
  })
  const wallMs = Date.now() - startedAt
  const latencies = joined.map((join) => join.ms)
  const batches = [...new Set(joined.map((join) => join.tx))]
  console.log(`✓ ${N} players joined in ${(wallMs / 1000).toFixed(1)} s | per player p50 ${percentile(latencies, 0.5)} ms, p90 ${percentile(latencies, 0.9)} ms, max ${Math.max(...latencies)} ms | ${batches.length} joinBatch transaction(s)`)

  const room = await call(`/api/rooms/${code}`)
  assert(room.count === N + 1, `the room has ${N + 1} players, got ${room.count}`)

  const sockets: Socket[] = Array.from({ length: W }, () => io(API, { transports: ['websocket'] }))
  let tickCount = 0
  let result: any = null
  let settled: any = null
  let go: any = null
  const tickHashes: string[] = []
  sockets.forEach((socket, index) => {
    socket.on('connect', () => socket.emit('room:watch', { code }))

    if (index === 0) {
      socket.on('race:go', (message: any) => (go = message))
      socket.on('race:tick', (tick: any) => {
        tickCount++

        if (tick.tx) tickHashes.push(tick.tx)
      })
      socket.on('race:result', (message: any) => (result = message))
      socket.on('race:settled', (message: any) => (settled = message))
    }
  })
  await sleep(1500)
  await call(`/api/rooms/${code}/start`, 'POST', {}, hostToken)

  const deadline = Date.now() + 180_000
  while (!settled && Date.now() < deadline) await sleep(300)
  sockets.forEach((socket) => socket.close())

  assert(result && settled?.ok, 'the race finished and settled on-chain')
  console.log(`✓ race done: ${tickCount} tick broadcasts, field ${result.field}, winner ${result.ranking[0].name}`)

  const chargedFor = (hashes: string[]) => chargedMon([...new Set(hashes)])
  const rows: [string, bigint][] = []
  rows.push(['create room', (await chargedFor([created.tx])).total])
  rows.push([`join (${batches.length} batch)`, (await chargedFor(batches)).total])
  rows.push(['start', (await chargedFor([go.tx])).total])
  rows.push([`${tickHashes.length} ticks`, (await chargedFor(tickHashes)).total])
  rows.push(['finalize', (await chargedFor([settled.tx])).total])

  const total = rows.reduce((sum, [, wei]) => sum + wei, 0n)
  for (const [name, wei] of rows) console.log(`  ${name.padEnd(18)} ${mon(wei)} MON`)

  console.log(`  ${'total'.padEnd(18)} ${mon(total)} MON`)

  const rpcAfter = (await call('/api/health')).rpc
  console.log('  rpc calls during the test:', rpcAfter.calls - rpcBefore.calls, '| computed CU:', rpcAfter.cu - rpcBefore.cu, '| methods:', JSON.stringify(rpcAfter.methods), '| unpriced:', JSON.stringify(rpcAfter.unpriced))
  console.log('PASS load')
}

main().catch((error) => {
  console.error('FAIL', error)
  process.exit(1)
})
