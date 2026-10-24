import Joi from 'joi'
import { BadRequestException } from '@Exceptions/BadRequestException'
import { LoadoutDTO } from '@DTOs/LoadoutDTO'
import { ILoadout } from '@Interfaces/ILoadout'

export class LoadoutRequest {
  protected request: ILoadout

  constructor(request: ILoadout) {
    this.request = request
  }

  public validator(): void {
    const validationScheme = Joi.object({
      address: Joi.string().pattern(/^0x[0-9a-fA-F]{40}$/).required(),
      roomCode: Joi.string().pattern(/^WEK-[A-Z0-9]{3,6}$/i).required(),
      partTypeId: Joi.number().integer().min(0).allow(null),
    })
    const { error } = validationScheme.validate(this.request, { abortEarly: false })
    if (error) {
      throw new BadRequestException('Error Validation', { validations: error.details.map((x) => x.message) })
    }
  }

  public toDTO(): LoadoutDTO {
    this.validator()
    return new LoadoutDTO(this.request as any)
  }
}
