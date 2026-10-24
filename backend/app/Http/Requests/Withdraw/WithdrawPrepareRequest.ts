import Joi from 'joi'
import { BadRequestException } from '@Exceptions/BadRequestException'
import { WithdrawPrepareDTO } from '@DTOs/WithdrawDTO'
import { IWithdrawPrepare } from '@Interfaces/IWithdraw'

export class WithdrawPrepareRequest {
  protected request: IWithdrawPrepare

  constructor(request: IWithdrawPrepare) {
    this.request = request
  }

  public validator(): void {
    const validationScheme = Joi.object({
      owner: Joi.string().pattern(/^0x[0-9a-fA-F]{40}$/).required(),
      to: Joi.string().pattern(/^0x[0-9a-fA-F]{40}$/),
      amount: Joi.string().pattern(/^[0-9]+$/),
    })
    const { error } = validationScheme.validate(this.request, { abortEarly: false })
    if (error) {
      throw new BadRequestException('Error Validation', { validations: error.details.map((x) => x.message) })
    }
  }

  public toDTO(): WithdrawPrepareDTO {
    this.validator()
    return new WithdrawPrepareDTO(this.request as any)
  }
}
