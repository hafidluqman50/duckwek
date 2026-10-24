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

/**
 * The one signature at connect (plan §3.2): an EIP-2612 permit (owner = player, spender = Vault, value = session cap,
 * deadline = session end). It is the login proof (the address is recovered from it) and the spending authorisation:
 * the relayer submits it with the player's first paid order, then the Vault charges every order with transferFrom.
 */
export class AuthService {
  constructor(
    public playerRepository: PlayerRepository,
    public authNonceRepository: AuthNonceRepository,
  ) {}

  private message(owner: string, permitNonce: bigint, deadline: bigint) {
    return { owner: owner as Address, spender: addresses.vault, value: env.sessionCap, nonce: permitNonce, deadline }
  }

  public async nonce(dto: AuthNonceDTO): Promise<{ session: unknown }> {
    const permitNonce = (await publicClient.readContract({ address: addresses.usdc, abi: usdcAbi, functionName: 'nonces', args: [dto.address as Address] })) as bigint
    const deadline = BigInt(Math.floor(Date.now() / 1000) + env.sessionTtlSec)
    await this.authNonceRepository.create(dto.address, crypto.randomBytes(12).toString('hex'), 10 * 60_000, { permit_nonce: permitNonce.toString(), deadline: deadline.toString() })
    return { session: jsonify({ domain: usdcDomain(), types: permitTypes, primaryType: 'Permit', message: this.message(dto.address, permitNonce, deadline) }) }
  }

  public async verify(dto: AuthVerifyDTO) {
    const n = await this.authNonceRepository.latestValid(dto.address)
    if (!n || n.permit_nonce === null || n.deadline === null) throw new UnauthorizedException('Sign-in expired, try again')
    const ok = await verifyTypedData({
      address: dto.address as Address,
      domain: usdcDomain(),
      types: permitTypes,
      primaryType: 'Permit',
      message: this.message(dto.address, BigInt(n.permit_nonce), BigInt(n.deadline)),
      signature: dto.signature as Hex,
    }).catch(() => false)
    if (!ok) throw new UnauthorizedException('Signature does not match this wallet')
    await this.authNonceRepository.startSession(n, dto.signature)
    const { created } = await this.playerRepository.findOrCreate(dto.address)
    // The token lives as long as the session: after that the player signs once more.
    const token = jwt.sign({ address: dto.address }, env.jwtSecret, { expiresIn: env.sessionTtlSec })
    return { token, address: dto.address, isNew: created }
  }
}
