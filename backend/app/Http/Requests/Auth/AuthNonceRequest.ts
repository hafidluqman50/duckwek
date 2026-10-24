import Joi from 'joi'
import { BadRequestException } from '@Exceptions/BadRequestException'
import { AuthNonceDTO } from '@DTOs/AuthNonceDTO'

export class AuthNonceRequest {
  protected request: { address: string }

  constructor(request: { address: string }) {
    this.request = request
  }

  public validator(): void {
    const validationScheme = Joi.object({ address: Joi.string().pattern(/^0x[0-9a-fA-F]{40}$/).required() })
    const { error } = validationScheme.validate(this.request, { abortEarly: false })
    if (error) {
      throw new BadRequestException('Error Validation', { validations: error.details.map((x) => x.message) })
    }
  }

  public toDTO(): AuthNonceDTO {
    this.validator()
    return new AuthNonceDTO(this.request as any)
  }
}
