import { Op } from 'sequelize'
import { AuthNonce } from '@Models/AuthNonce'

export class AuthNonceRepository {
  /** One row per sign-in challenge. `permit_nonce` and `deadline` are the fields of the permit the player will sign. */
  public async create(address: string, nonce: string, ttlMs: number, permit: { permit_nonce: string; deadline: string }): Promise<AuthNonce> {
    return AuthNonce.create({ address, nonce, expires_at: new Date(Date.now() + ttlMs), ...permit } as any)
  }

  public async latestValid(address: string): Promise<AuthNonce | null> {
    return AuthNonce.findOne({ where: { address, used: false, expires_at: { [Op.gt]: new Date() } }, order: [['id', 'DESC']] })
  }

  /** The challenge is consumed and the signature kept: from now on it is the player's session. */
  public async startSession(n: AuthNonce, signature: string): Promise<void> {
    await n.update({ used: true, signature })
  }

  /** The newest signed session that has not expired. */
  public async activeSession(address: string): Promise<AuthNonce | null> {
    return AuthNonce.findOne({ where: { address, used: true, signature: { [Op.ne]: null }, deadline: { [Op.gt]: String(Math.floor(Date.now() / 1000)) } }, order: [['id', 'DESC']] })
  }

  public async recordSpend(n: AuthNonce, amount: bigint): Promise<void> {
    await n.update({ spent: String(BigInt(n.spent) + amount), permit_used: true })
  }
}
