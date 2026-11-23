import Joi from 'joi'
import { env } from '@config/env'
import { BadRequestException } from '@Exceptions/BadRequestException'
import { AuthNonceDTO } from '@DTOs/AuthNonceDTO'

interface AuthNonceBody {
  address: string
  limit?: string
  duration?: number
}

export class AuthNonceRequest {
  protected request: AuthNonceBody

  constructor(request: AuthNonceBody) {
    this.request = request
  }

  public validator(): void {
    const validationScheme = Joi.object({
      address: Joi.string().pattern(/^0x[0-9a-fA-F]{40}$/).required(),
      limit: Joi.string()
        .pattern(/^\d+$/)
        .custom((value: string, helpers) => {
          const amount = BigInt(value)

          return amount < env.sessionCapMinimum || amount > env.sessionCapMaximum ? helpers.error('any.invalid') : value
        })
        .messages({ 'any.invalid': `limit must be between ${env.sessionCapMinimum} and ${env.sessionCapMaximum} (USDC with 6 decimals)`, 'string.pattern.base': 'limit must be a whole number in USDC base units' }),
      duration: Joi.number().integer().min(env.sessionDurationMinimumSeconds).max(env.sessionDurationMaximumSeconds),
    })
    const { error } = validationScheme.validate(this.request, { abortEarly: false })

    if (error) {
      throw new BadRequestException('Error Validation', { validations: error.details.map((detail) => detail.message) })
    }
  }

  public toDTO(): AuthNonceDTO {
    this.validator()

    return new AuthNonceDTO(this.request)
  }
}
