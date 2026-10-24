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

  public async prepare(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const dto = new WithdrawPrepareRequest({ owner: req.address!, to: req.body.to, amount: req.body.amount }).toDTO()
      this.ok(res, 'Sign the withdrawal', await this.withdrawService.prepare(dto))
    } catch (e) {
      this.fail(res, e)
    }
  }

  public async submit(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const dto = new WithdrawSubmitRequest({ owner: req.address!, withdrawal: req.body.withdrawal, signature: req.body.signature }).toDTO()
      this.ok(res, 'Withdrawn', await this.withdrawService.submit(dto))
    } catch (e) {
      this.fail(res, e)
    }
  }
}
