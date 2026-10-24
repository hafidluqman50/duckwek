import { Op } from 'sequelize'
import { Payment } from '@Models/Payment'

export class PaymentRepository {
  public async create(data: Partial<Payment> & { kind: Payment['kind']; payer: string; amount: string; nonce: string; deadline: string }): Promise<Payment> {
    return Payment.create(data as any)
  }

  public async byId(id: number): Promise<Payment | null> {
    return Payment.findByPk(id)
  }

  public async activity(payer: string): Promise<Payment[]> {
    return Payment.findAll({ where: { payer }, order: [['id', 'DESC']], limit: 30 })
  }

  public async recentPrepared(payer: string, kind: Payment['kind'], windowMs: number): Promise<number> {
    return Payment.count({ where: { payer, kind, created_at: { [Op.gte]: new Date(Date.now() - windowMs) } } })
  }

  public async confirmedFaucet(payer: string): Promise<Payment | null> {
    return Payment.findOne({ where: { payer, kind: 'faucet', status: 'confirmed' }, order: [['id', 'DESC']] })
  }
}
