import Joi from 'joi'
import { BadRequestException } from '@Exceptions/BadRequestException'
import { AuthVerifyDTO } from '@DTOs/AuthVerifyDTO'

export class AuthVerifyRequest {
  protected request: { address: string; signature: string }

  constructor(request: { address: string; signature: string }) {
    this.request = request
  }

  public validator(): void {
    const validationScheme = Joi.object({ address: Joi.string().pattern(/^0x[0-9a-fA-F]{40}$/).required(), signature: Joi.string().pattern(/^0x[0-9a-fA-F]+$/).required() })
    const { error } = validationScheme.validate(this.request, { abortEarly: false })
    if (error) {
      throw new BadRequestException('Error Validation', { validations: error.details.map((x) => x.message) })
    }
  }

  public toDTO(): AuthVerifyDTO {
    this.validator()
    return new AuthVerifyDTO(this.request as any)
  }
}
