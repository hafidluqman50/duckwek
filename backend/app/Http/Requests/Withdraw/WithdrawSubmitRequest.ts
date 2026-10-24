import Joi from 'joi'
import { BadRequestException } from '@Exceptions/BadRequestException'
import { WithdrawSubmitDTO } from '@DTOs/WithdrawDTO'
import { IWithdrawSubmit } from '@Interfaces/IWithdraw'

export class WithdrawSubmitRequest {
  protected request: IWithdrawSubmit

  constructor(request: IWithdrawSubmit) {
    this.request = request
  }

  public validator(): void {
    const validationScheme = Joi.object({
      owner: Joi.string().pattern(/^0x[0-9a-fA-F]{40}$/).required(),
      withdrawal: Joi.object({ owner: Joi.string().pattern(/^0x[0-9a-fA-F]{40}$/).required(), to: Joi.string().pattern(/^0x[0-9a-fA-F]{40}$/).required(), amount: Joi.string().required(), nonce: Joi.string().required(), deadline: Joi.string().required() }).required(),
      signature: Joi.string().pattern(/^0x[0-9a-fA-F]+$/).required(),
    })
    const { error } = validationScheme.validate(this.request, { abortEarly: false })
    if (error) {
      throw new BadRequestException('Error Validation', { validations: error.details.map((x) => x.message) })
    }
  }

  public toDTO(): WithdrawSubmitDTO {
    this.validator()
    return new WithdrawSubmitDTO(this.request as any)
  }
}
