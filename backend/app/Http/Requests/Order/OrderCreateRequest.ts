import Joi from 'joi'
import { BadRequestException } from '@Exceptions/BadRequestException'
import { OrderCreateDTO } from '@DTOs/OrderCreateDTO'
import { ICreateOrder } from '@Interfaces/ICreateOrder'

export class OrderCreateRequest {
  protected request: ICreateOrder

  constructor(request: ICreateOrder) {
    this.request = request
  }

  public validator(): void {
    const validationScheme = Joi.object({
      payer: Joi.string().pattern(/^0x[0-9a-fA-F]{40}$/).required(),
      kind: Joi.string().valid('create_room', 'join_room', 'buy_part').required(),
      trackId: Joi.when('kind', { is: 'create_room', then: Joi.number().integer().min(1).required(), otherwise: Joi.any().strip() }),
      roomName: Joi.when('kind', { is: 'create_room', then: Joi.string().trim().min(1).max(40).required(), otherwise: Joi.any().strip() }),
      maxDucks: Joi.when('kind', { is: 'create_room', then: Joi.number().valid(20, 50, 100, 200).required(), otherwise: Joi.any().strip() }),
      fillBots: Joi.boolean(),
      roomCode: Joi.when('kind', { is: 'join_room', then: Joi.string().pattern(/^WEK-[A-Z0-9]{3,6}$/i).required(), otherwise: Joi.any().strip() }),
      partTypeId: Joi.when('kind', { is: 'buy_part', then: Joi.number().integer().min(0).required(), otherwise: Joi.any().strip() }),
    })
    const { error } = validationScheme.validate(this.request, { abortEarly: false })
    if (error) {
      throw new BadRequestException('Error Validation', { validations: error.details.map((x) => x.message) })
    }
  }

  public toDTO(): OrderCreateDTO {
    this.validator()
    return new OrderCreateDTO(this.request as any)
  }
}
