import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { verifyTypedData, type Address, type Hex } from 'viem'
import { env } from '@config/env'
import { addresses, publicClient } from '@Chain/Contracts'
import { usdcAbi } from '@Chain/abis'
import { jsonify, permitTypes, usdcDomain } from '@Chain/TypedData'
import { PlayerRepository } from '@Repositories/Auth/PlayerRepository'
import { AuthNonceRepository } from '@Repositories/Auth/AuthNonceRepository'
import { AuthNonceDTO } from '@DTOs/AuthNonceDTO'
import { AuthVerifyDTO } from '@DTOs/AuthVerifyDTO'
import { UnauthorizedException } from '@Exceptions/UnauthorizedException'

export class AuthService {
  constructor(
    public playerRepository: PlayerRepository,
    public authNonceRepository: AuthNonceRepository,
  ) {}

  private message(owner: string, permitNonce: bigint, deadline: bigint, sessionCap: bigint) {
    return { owner: owner as Address, spender: addresses.vault, value: sessionCap, nonce: permitNonce, deadline }
  }

  public async nonce(nonceInput: AuthNonceDTO): Promise<{ session: unknown }> {
    const permitNonce = (await publicClient.readContract({ address: addresses.usdc, abi: usdcAbi, functionName: 'nonces', args: [nonceInput.address as Address] })) as bigint
    const deadline = BigInt(Math.floor(Date.now() / 1000) + nonceInput.duration)

    await this.authNonceRepository.create(nonceInput.address, crypto.randomBytes(12).toString('hex'), 10 * 60_000, { permit_nonce: permitNonce.toString(), deadline: deadline.toString(), session_cap: nonceInput.limit.toString() })

    return { session: jsonify({ domain: usdcDomain(), types: permitTypes, primaryType: 'Permit', message: this.message(nonceInput.address, permitNonce, deadline, nonceInput.limit) }) }
  }

  public async verify(verifyInput: AuthVerifyDTO) {
    const authNonce = await this.authNonceRepository.latestValid(verifyInput.address)

    if (!authNonce || authNonce.permit_nonce === null || authNonce.deadline === null) throw new UnauthorizedException('Sign-in expired, try again')

    const signatureMatches = await verifyTypedData({
      address: verifyInput.address as Address,
      domain: usdcDomain(),
      types: permitTypes,
      primaryType: 'Permit',
      message: this.message(verifyInput.address, BigInt(authNonce.permit_nonce), BigInt(authNonce.deadline), BigInt(authNonce.session_cap)),
      signature: verifyInput.signature as Hex,
    }).catch(() => false)

    if (!signatureMatches) throw new UnauthorizedException('Signature does not match this wallet')

    await this.authNonceRepository.startSession(authNonce, verifyInput.signature)
    const { created } = await this.playerRepository.findOrCreate(verifyInput.address)
    const secondsLeft = Math.max(1, Number(authNonce.deadline) - Math.floor(Date.now() / 1000))
    const token = jwt.sign({ address: verifyInput.address }, env.jwtSecret, { expiresIn: secondsLeft })

    return { token, address: verifyInput.address, isNew: created }
  }
}
