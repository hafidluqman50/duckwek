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

export class WithdrawService {
  constructor(public paymentRepository: PaymentRepository) {}

  public async prepare(prepareInput: WithdrawPrepareDTO) {
    const available = (await publicClient.readContract({ address: addresses.vault, abi: vaultAbi, functionName: 'available', args: [prepareInput.owner as Address] })) as bigint
    const amount = prepareInput.amount ?? available

    if (amount <= 0n) throw new BadRequestException('Nothing to withdraw yet')

    if (amount > available) throw new BadRequestException('That is more than you have earned')

    const withdrawal = { owner: prepareInput.owner, to: prepareInput.to, amount, nonce: BigInt('0x' + crypto.randomBytes(8).toString('hex')), deadline: BigInt(Math.floor(Date.now() / 1000) + TTL_S) }

    return jsonify({ withdrawal, typedData: { domain: vaultDomain(), types: withdrawalTypes, primaryType: 'Withdrawal', message: withdrawal } })
  }

  public async submit(submitInput: WithdrawSubmitDTO) {
    const withdrawal = submitInput.withdrawal

    if (withdrawal.owner.toLowerCase() !== submitInput.owner) throw new ForbiddenException('Not your withdrawal')

    const signatureMatches = await verifyTypedData({ address: withdrawal.owner, domain: vaultDomain(), types: withdrawalTypes, primaryType: 'Withdrawal', message: withdrawal, signature: submitInput.signature }).catch(() => false)

    if (!signatureMatches) throw new BadRequestException('Signature does not match your wallet')

    const payment = await this.paymentRepository.create({ kind: 'withdraw', payer: submitInput.owner, amount: withdrawal.amount.toString(), nonce: withdrawal.nonce.toString(), deadline: withdrawal.deadline.toString(), status: 'pending', meta: { label: 'Withdraw earnings', to: withdrawal.to } })

    try {
      const transaction = await relayer.withdraw(withdrawal, submitInput.signature)
      await payment.update({ status: 'confirmed', tx_hash: transaction.hash })

      return { tx: transaction.hash, url: transaction.url }
    } catch (error) {
      const message = (error as any)?.shortMessage || (error as Error).message
      await payment.update({ status: 'failed', error: message })

      throw new BadRequestException('Withdraw failed: ' + message)
    }
  }
}
