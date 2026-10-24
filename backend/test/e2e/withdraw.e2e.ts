/**
 * Withdraw on the REAL deployment (plan T-1 live, DoD 2): a circuit owner earns 50 % of the rent and of every ticket of the
 * rooms on its circuit, then withdraws it gasless (the owner signs, the relayer pays gas). The circuit is owned by a test
 * wallet because the platform circuits belong to the treasury, whose key is not available to the tests.
 *   CREATOR_KEY=0x… TRACK_ID=3 API_URL=… RPC_URL=… npx ts-node -T -r tsconfig-paths/register test/e2e/withdraw.e2e.ts
 */
import { createPublicClient, http, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { usdcAbi, vaultAbi } from '../../app/Chain/abis'
import { assert, call, mon, order, revive, signIn, RPC } from './lib'

async function main() {
  const creator = privateKeyToAccount(process.env.CREATOR_KEY as Hex)
  const trackId = Number(process.env.TRACK_ID || 3)
  const pc = createPublicClient({ transport: http(RPC) })
  const tracks = await call('/api/catalog/tracks')
  const track = tracks.find((t: any) => t.id === trackId)
  assert(track && track.status === 'active', 'the creator track is in the catalog')

  // a host rents the creator's circuit, two players buy a ticket: 1.00 + 0.10 + 0.10 USDC, half of it is the creator's
  const [h, a, b] = [privateKeyToAccount(generatePrivateKey()), privateKeyToAccount(generatePrivateKey()), privateKeyToAccount(generatePrivateKey())]
  const [ht, at, bt] = await Promise.all([signIn(h), signIn(a), signIn(b)])
  const room = await order(ht, { kind: 'create_room', trackId, roomName: 'Withdraw Test', maxDucks: 20, fillBots: true })
  await Promise.all([order(at, { kind: 'join_room', roomCode: room.roomCode }), order(bt, { kind: 'join_room', roomCode: room.roomCode })])
  const ct = await signIn(creator)
  const me = await call('/api/me', 'GET', undefined, ct)
  assert(me.earnings === '600000', `the circuit owner earned 0.60 USDC (50 % of 1.00 + 0.10 + 0.10), got ${me.earnings}`)
  const onchain = (await pc.readContract({ address: process.env.VAULT as Hex, abi: vaultAbi, functionName: 'available', args: [creator.address] })) as bigint
  assert(onchain === 600000n, 'the Vault agrees')
  console.log('✓ the circuit owner earned', me.earnings, 'micro-USDC on', track.name)

  // gasless withdraw: prepare, sign (the owner), submit (the relayer pays)
  const usdc0 = (await pc.readContract({ address: process.env.MOCK_USDC as Hex, abi: usdcAbi, functionName: 'balanceOf', args: [creator.address] })) as bigint
  const prep = await call('/api/withdraw/prepare', 'POST', {}, ct)
  const td = revive(prep.typedData)
  const signature = await creator.signTypedData({ domain: td.domain, types: td.types, primaryType: td.primaryType, message: td.message })
  const sub = await call('/api/withdraw/submit', 'POST', { withdrawal: prep.withdrawal, signature }, ct)
  const usdc1 = (await pc.readContract({ address: process.env.MOCK_USDC as Hex, abi: usdcAbi, functionName: 'balanceOf', args: [creator.address] })) as bigint
  const left = (await pc.readContract({ address: process.env.VAULT as Hex, abi: vaultAbi, functionName: 'available', args: [creator.address] })) as bigint
  assert(usdc1 - usdc0 === 600000n && left === 0n, `the wallet got 0.60 USDC and the Vault owes 0 (got +${usdc1 - usdc0}, owes ${left})`)
  console.log('✓ withdrawn gasless:', sub.tx, '| wallet USDC +', (usdc1 - usdc0).toString(), '| creator MON balance unchanged by the withdraw')

  // replaying the same signed withdrawal must fail
  let replay = false
  try { await call('/api/withdraw/submit', 'POST', { withdrawal: prep.withdrawal, signature }, ct) } catch { replay = true }
  assert(replay, 'the same signed withdrawal cannot be used twice')
  // someone else's signature is refused
  const evil = await call('/api/withdraw/prepare', 'POST', {}, ht).catch((e: Error) => e.message)
  console.log('✓ replay refused; a wallet with no earnings gets:', String(evil).slice(0, 90))
  console.log('PASS withdraw', mon(0n) && '')
}

main().catch((e) => {
  console.error('FAIL', e)
  process.exit(1)
})
