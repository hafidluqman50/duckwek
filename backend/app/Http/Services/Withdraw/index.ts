import { WithdrawService } from './WithdrawService'
import { paymentRepository } from '@Repositories/Payment'

const withdrawService = new WithdrawService(paymentRepository)

export { withdrawService }
