import crypto from 'crypto'
import { verifyTypedData, type Address } from 'viem'
import { addresses, publicClient } from '@Chain/Contracts'
import { vaultAbi } from '@Chain/abis'
import { relayer } from '@Chain/Relayer'
import { jsonify, vaultDomain, withdrawalTypes } from '@Chain/TypedData'
import { PaymentRepository } from '@Repositories/Payment/PaymentRepository'
import { WithdrawPrepareDTO, WithdrawSubmitDTO } from '@DTOs/WithdrawDTO'
import { BadRequestException } from '@Exceptions/BadRequestException'
import { ForbiddenException } from '@Exceptions/ForbiddenException'

const TTL_S = 15 * 60

/**
 * Pull payout (plan: receivers withdraw themselves). The owner signs a Withdrawal, the relayer submits it and pays gas.
 * Funds only ever go to `to`, chosen and signed by the owner, so the operator cannot redirect them.
 * This is a separate signature on purpose: it is not part of the one signature at connect.
 */
export class WithdrawService {
  constructor(public paymentRepository: PaymentRepository) {}

  public async prepare(dto: WithdrawPrepareDTO) {
    const available = (await publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: 'available', args: [dto.owner as Address] })) as bigint
    const amount = dto.amount ?? available
    if (amount <= 0n) throw new BadRequestException('Nothing to withdraw yet')
    if (amount > available) throw new BadRequestException('That is more than you have earned')
    const withdrawal = { owner: dto.owner, to: dto.to, amount, nonce: BigInt('0x' + crypto.randomBytes(8).toString('hex')), deadline: BigInt(Math.floor(Date.now() / 1000) + TTL_S) }
    return jsonify({ withdrawal, typedData: { domain: vaultDomain(), types: withdrawalTypes, primaryType: 'Withdrawal', message: withdrawal } })
  }

  public async submit(dto: WithdrawSubmitDTO) {
    const w = dto.withdrawal
    if (w.owner.toLowerCase() !== dto.owner) throw new ForbiddenException('Not your withdrawal')
    const ok = await verifyTypedData({ address: w.owner, domain: vaultDomain(), types: withdrawalTypes, primaryType: 'Withdrawal', message: w, signature: dto.signature }).catch(() => false)
    if (!ok) throw new BadRequestException('Signature does not match your wallet')
    const payment = await this.paymentRepository.create({ kind: 'withdraw', payer: dto.owner, amount: w.amount.toString(), nonce: w.nonce.toString(), deadline: w.deadline.toString(), status: 'pending', meta: { label: 'Withdraw earnings', to: w.to } })
    try {
      const tx = await relayer.withdraw(w, dto.signature)
      await payment.update({ status: 'confirmed', tx_hash: tx.hash })
      return { tx: tx.hash, url: tx.url }
    } catch (e) {
      const msg = (e as any)?.shortMessage || (e as Error).message
      await payment.update({ status: 'failed', error: msg })
      throw new BadRequestException('Withdraw failed: ' + msg)
    }
  }
}
