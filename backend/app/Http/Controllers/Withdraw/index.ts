import { WithdrawController } from './WithdrawController'
import { withdrawService } from '@Services/Withdraw'

const withdrawController = new WithdrawController(withdrawService)

export { withdrawController }
