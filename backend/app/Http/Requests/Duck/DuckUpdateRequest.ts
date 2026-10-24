import Joi from 'joi'
import { BadRequestException } from '@Exceptions/BadRequestException'
import { DuckUpdateDTO } from '@DTOs/DuckUpdateDTO'
import { IUpdateDuck } from '@Interfaces/IUpdateDuck'

export class DuckUpdateRequest {
  protected request: IUpdateDuck

  constructor(request: IUpdateDuck) {
    this.request = request
  }

  public validator(): void {
    const validationScheme = Joi.object({
      address: Joi.string().pattern(/^0x[0-9a-fA-F]{40}$/).required(),
      name: Joi.string().trim().min(1).max(14).required(),
      template: Joi.string().valid('balanced', 'sprint', 'tank').required(),
      bodyColor: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/).required(),
      billColor: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/).required(),
      cosmetics: Joi.object({ hat: Joi.boolean(), shades: Joi.boolean(), scarf: Joi.boolean() }).required(),
      equippedPartTypeId: Joi.number().integer().min(0).allow(null),
    })
    const { error } = validationScheme.validate(this.request, { abortEarly: false })
    if (error) {
      throw new BadRequestException('Error Validation', { validations: error.details.map((x) => x.message) })
    }
  }

  public toDTO(): DuckUpdateDTO {
    this.validator()
    return new DuckUpdateDTO(this.request as any)
  }
}
