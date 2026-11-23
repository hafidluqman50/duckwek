import { createPublicClient, http, type Address } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { usdcAbi, vaultAbi } from '../../app/Chain/abis'
import { assert, call, order, signIn } from './lib'

const USDC = 1_000_000n
const VAULT = process.env.VAULT as Address
const MOCK_USDC = process.env.MOCK_USDC as Address
const client = createPublicClient({ transport: http(process.env.RPC_URL) })

const sessionOnChain = async (payer: Address) => {
  const [cap, end, spent] = await Promise.all([
    client.readContract({ address: VAULT, abi: vaultAbi, functionName: 'sessionCap', args: [payer] }),
    client.readContract({ address: VAULT, abi: vaultAbi, functionName: 'sessionEnd', args: [payer] }),
    client.readContract({ address: VAULT, abi: vaultAbi, functionName: 'sessionSpent', args: [payer] }),
  ])
  const allowance = await client.readContract({ address: MOCK_USDC, abi: usdcAbi, functionName: 'allowance', args: [payer, VAULT] })

  return { cap: cap as bigint, end: end as bigint, spent: spent as bigint, allowance: allowance as bigint }
}

const refusedByLimit = async (token: string, body: Record<string, unknown>) => {
  try {
    await order(token, body)
  } catch (error) {
    return (error as Error).message.includes('Session spending limit reached')
  }

  return false
}

async function main() {
  const player = privateKeyToAccount(generatePrivateKey())
  const payer = player.address

  for (const body of [{ limit: '0' }, { limit: '500000' }, { limit: '100000000001' }, { limit: 'abc' }, { duration: 3599 }, { duration: 172801 }]) {
    let rejected = false

    try {
      await call('/api/auth/nonce', 'POST', { address: payer, ...body })
    } catch (error) {
      rejected = (error as any).status === 400
    }

    assert(rejected, `out of range ${JSON.stringify(body)} is a 400`)
  }

  console.log('✓ V18 out of range limit and duration are rejected')

  const nonce = await call('/api/auth/nonce', 'POST', { address: payer, limit: String(10n * USDC), duration: 2 * 24 * 3600 })
  const now = Math.floor(Date.now() / 1000)

  assert(nonce.session.message.value === String(10n * USDC), 'the permit value is the chosen limit')
  assert(Math.abs(Number(nonce.session.message.deadline) - (now + 172800)) < 30, 'the permit deadline is now + the chosen duration')
  console.log('✓ V14 the permit carries the chosen limit and duration')

  const token = await signIn(player, { limit: 2n * USDC, duration: 7200 })
  const profile = await call('/api/me', 'GET', undefined, token)

  assert(profile.session.limit === String(2n * USDC) && profile.session.spent === '0', '/api/me reports the limit and zero spent')
  assert(Math.abs(Number(profile.session.deadline) - (now + 7200)) < 60, '/api/me reports the 2 hour deadline')

  await call('/api/me/duck', 'PUT', { name: 'LimitDuck', template: 'sprint', bodyColor: '#4ED1C5', billColor: '#FFC93C', cosmetics: { hat: true, shades: false, scarf: false }, equippedPartTypeId: null }, token)
  await order(token, { kind: 'buy_part', partTypeId: 0 })
  await order(token, { kind: 'buy_part', partTypeId: 1 })

  assert(await refusedByLimit(token, { kind: 'buy_part', partTypeId: 2 }), 'the third 1 USDC order is refused by the 2 USDC limit')

  const small = await sessionOnChain(payer)

  assert(small.cap === 2n * USDC && small.spent === 2n * USDC, 'the vault recorded cap 2 and spent 2')
  console.log('✓ V15 a 2 USDC limit allows two 1 USDC orders and refuses the third')

  const raisedToken = await signIn(player, { limit: 10n * USDC, duration: 24 * 3600 })

  await order(raisedToken, { kind: 'buy_part', partTypeId: 2 })

  const raised = await sessionOnChain(payer)
  const raisedProfile = await call('/api/me', 'GET', undefined, raisedToken)

  assert(raised.cap === 10n * USDC, 'Vault.sessionCap reads 10 USDC after the new permit')
  assert(raised.spent === 1n * USDC, 'sessionSpent restarted at zero and holds the new order only')
  assert(raised.end === BigInt(raisedProfile.session.deadline), 'sessionEnd is the new deadline')
  assert(raisedProfile.session.limit === String(10n * USDC) && raisedProfile.session.spent === String(1n * USDC), '/api/me matches the chain')
  console.log('✓ V16 raising the limit replaces the session: cap 10, spent restarted, new deadline')

  const tracks = await call('/api/catalog/tracks')
  const lowered = await signIn(player, { limit: 1n * USDC, duration: 3600 })

  await order(lowered, { kind: 'create_room', trackId: tracks[0].id, roomName: 'Limit E2E', maxDucks: 20, fillBots: true })

  const afterLower = await sessionOnChain(payer)

  assert(afterLower.cap === 1n * USDC && afterLower.spent === 1n * USDC, 'lowering to 1 USDC set the cap to 1 and the order used it')
  assert(afterLower.allowance === 0n, 'the token allowance is cap minus spent')
  console.log('✓ V17 lowering the limit sets the cap to the smaller number')
  console.log('limit e2e: all passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
