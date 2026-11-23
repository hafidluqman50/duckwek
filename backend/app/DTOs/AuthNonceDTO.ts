import { env } from '@config/env'

export class AuthNonceDTO {
  public address: string
  public limit: bigint
  public duration: number

  constructor(input: { address: string; limit?: string; duration?: number }) {
    this.address = input.address.toLowerCase()
    this.limit = input.limit === undefined ? env.sessionCap : BigInt(input.limit)
    this.duration = input.duration === undefined ? env.sessionTtlSec : Number(input.duration)
  }
}
