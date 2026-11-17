import { Op } from 'sequelize'
import { AuthNonce } from '@Models/AuthNonce'

export class AuthNonceRepository {
  public async create(address: string, nonce: string, ttlMs: number, permit: { permit_nonce: string; deadline: string }): Promise<AuthNonce> {
    return AuthNonce.create({ address, nonce, expires_at: new Date(Date.now() + ttlMs), ...permit } as any)
  }

  public async latestValid(address: string): Promise<AuthNonce | null> {
    return AuthNonce.findOne({ where: { address, used: false, expires_at: { [Op.gt]: new Date() } }, order: [['id', 'DESC']] })
  }

  public async startSession(authNonce: AuthNonce, signature: string): Promise<void> {
    await authNonce.update({ used: true, signature })
  }

  public async activeSession(address: string): Promise<AuthNonce | null> {
    return AuthNonce.findOne({ where: { address, used: true, signature: { [Op.ne]: null }, deadline: { [Op.gt]: String(Math.floor(Date.now() / 1000)) } }, order: [['id', 'DESC']] })
  }

  public async recordSpend(authNonce: AuthNonce, amount: bigint): Promise<void> {
    await authNonce.update({ spent: String(BigInt(authNonce.spent) + amount), permit_used: true })
  }
}
