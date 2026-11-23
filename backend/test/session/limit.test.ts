import assert from 'node:assert/strict'

process.env.JWT_SECRET ||= 'test'
process.env.RPC_URL ||= 'http://localhost:8545'
process.env.OPERATOR_PRIVATE_KEY ||= '0x' + '11'.repeat(32)
for (const key of ['RACE', 'VAULT', 'MOCK_USDC', 'BADGE', 'PART_NFT', 'TRACK_NFT']) process.env[key] ||= '0x' + '22'.repeat(20)

const address = '0x' + 'ab'.repeat(20)

async function main() {
  const { AuthNonceRequest } = await import('@Requests/Auth/AuthNonceRequest')
  const accepted = (body: object) => new AuthNonceRequest({ address, ...body } as any).toDTO()
  const rejected = (body: object) => assert.throws(() => new AuthNonceRequest({ address, ...body } as any).toDTO(), /Error Validation/)

  const defaults = accepted({})
  assert.equal(defaults.limit, 5_000_000n)
  assert.equal(defaults.duration, 24 * 3600)

  const chosen = accepted({ limit: '10000000', duration: 2 * 24 * 3600 })
  assert.equal(chosen.limit, 10_000_000n)
  assert.equal(chosen.duration, 172_800)

  assert.equal(accepted({ limit: '1000000' }).limit, 1_000_000n)
  assert.equal(accepted({ limit: '100000000000' }).limit, 100_000_000_000n)
  assert.equal(accepted({ duration: 3600 }).duration, 3600)
  assert.equal(accepted({ duration: '7200' }).duration, 7200)

  rejected({ limit: '0' })
  rejected({ limit: '500000' })
  rejected({ limit: '100000000001' })
  rejected({ limit: '-5' })
  rejected({ limit: 'abc' })
  rejected({ limit: '1.5' })
  rejected({ duration: 3599 })
  rejected({ duration: 172_801 })
  rejected({ duration: 'x' })

  console.log('limit and duration validation: ok')
}

main()
