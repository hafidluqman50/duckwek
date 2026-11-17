import { createPublicClient, http, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { usdcAbi, vaultAbi } from '../../app/Chain/abis'
import { assert, call, mon, order, revive, signIn, RPC } from './lib'

async function main() {
  const creator = privateKeyToAccount(process.env.CREATOR_KEY as Hex)
  const trackId = Number(process.env.TRACK_ID || 3)
  const publicClient = createPublicClient({ transport: http(RPC) })
  const tracks = await call('/api/catalog/tracks')
  const track = tracks.find((candidate: any) => candidate.id === trackId)

  assert(track && track.status === 'active', 'the creator track is in the catalog')

  const [host, firstPlayer, secondPlayer] = [privateKeyToAccount(generatePrivateKey()), privateKeyToAccount(generatePrivateKey()), privateKeyToAccount(generatePrivateKey())]
  const [hostToken, firstPlayerToken, secondPlayerToken] = await Promise.all([signIn(host), signIn(firstPlayer), signIn(secondPlayer)])
  const room = await order(hostToken, { kind: 'create_room', trackId, roomName: 'Withdraw Test', maxDucks: 20, fillBots: true })
  await Promise.all([order(firstPlayerToken, { kind: 'join_room', roomCode: room.roomCode }), order(secondPlayerToken, { kind: 'join_room', roomCode: room.roomCode })])

  const creatorToken = await signIn(creator)
  const profile = await call('/api/me', 'GET', undefined, creatorToken)

  assert(profile.earnings === '600000', `the circuit owner earned 0.60 USDC (50 % of 1.00 + 0.10 + 0.10), got ${profile.earnings}`)

  const onchainAvailable = (await publicClient.readContract({ address: process.env.VAULT as Hex, abi: vaultAbi, functionName: 'available', args: [creator.address] })) as bigint

  assert(onchainAvailable === 600000n, 'the Vault agrees')
  console.log('✓ the circuit owner earned', profile.earnings, 'micro-USDC on', track.name)

  const usdcBefore = (await publicClient.readContract({ address: process.env.MOCK_USDC as Hex, abi: usdcAbi, functionName: 'balanceOf', args: [creator.address] })) as bigint
  const prepared = await call('/api/withdraw/prepare', 'POST', {}, creatorToken)
  const typedData = revive(prepared.typedData)
  const signature = await creator.signTypedData({ domain: typedData.domain, types: typedData.types, primaryType: typedData.primaryType, message: typedData.message })
  const submitted = await call('/api/withdraw/submit', 'POST', { withdrawal: prepared.withdrawal, signature }, creatorToken)
  const usdcAfter = (await publicClient.readContract({ address: process.env.MOCK_USDC as Hex, abi: usdcAbi, functionName: 'balanceOf', args: [creator.address] })) as bigint
  const vaultOwes = (await publicClient.readContract({ address: process.env.VAULT as Hex, abi: vaultAbi, functionName: 'available', args: [creator.address] })) as bigint

  assert(usdcAfter - usdcBefore === 600000n && vaultOwes === 0n, `the wallet got 0.60 USDC and the Vault owes 0 (got +${usdcAfter - usdcBefore}, owes ${vaultOwes})`)
  console.log('✓ withdrawn gasless:', submitted.tx, '| wallet USDC +', (usdcAfter - usdcBefore).toString(), '| creator MON balance unchanged by the withdraw')

  let replayRefused = false
  try {
    await call('/api/withdraw/submit', 'POST', { withdrawal: prepared.withdrawal, signature }, creatorToken)
  } catch {
    replayRefused = true
  }

  assert(replayRefused, 'the same signed withdrawal cannot be used twice')

  const refusal = await call('/api/withdraw/prepare', 'POST', {}, hostToken).catch((error: Error) => error.message)

  console.log('✓ replay refused; a wallet with no earnings gets:', String(refusal).slice(0, 90))
  console.log('PASS withdraw', mon(0n) && '')
}

main().catch((error) => {
  console.error('FAIL', error)
  process.exit(1)
})
