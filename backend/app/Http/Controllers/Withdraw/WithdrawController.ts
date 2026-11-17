import { Response } from 'express'
import { BaseController } from '@Controllers/BaseController'
import { WithdrawService } from '@Services/Withdraw/WithdrawService'
import { WithdrawPrepareRequest } from '@Requests/Withdraw/WithdrawPrepareRequest'
import { WithdrawSubmitRequest } from '@Requests/Withdraw/WithdrawSubmitRequest'
import { IAuthRequest } from '@Interfaces/IAuthRequest'

export class WithdrawController extends BaseController {
  constructor(public withdrawService: WithdrawService) {
    super()
  }

  public async prepare(request: IAuthRequest, response: Response): Promise<void> {
    try {
      const prepareInput = new WithdrawPrepareRequest({ owner: request.address!, to: request.body.to, amount: request.body.amount }).toDTO()

      this.ok(response, 'Sign the withdrawal', await this.withdrawService.prepare(prepareInput))
    } catch (error) {
      this.fail(response, error)
    }
  }

  public async submit(request: IAuthRequest, response: Response): Promise<void> {
    try {
      const submitInput = new WithdrawSubmitRequest({ owner: request.address!, withdrawal: request.body.withdrawal, signature: request.body.signature }).toDTO()

      this.ok(response, 'Withdrawn', await this.withdrawService.submit(submitInput))
    } catch (error) {
      this.fail(response, error)
    }
  }
}
