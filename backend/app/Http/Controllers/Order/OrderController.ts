import { Response } from 'express'
import { BaseController } from '@Controllers/BaseController'
import { OrderService } from '@Services/Order/OrderService'
import { OrderCreateRequest } from '@Requests/Order/OrderCreateRequest'
import { IAuthRequest } from '@Interfaces/IAuthRequest'

export class OrderController extends BaseController {
  constructor(public orderService: OrderService) {
    super()
  }

  public async create(request: IAuthRequest, response: Response): Promise<void> {
    try {
      const orderInput = new OrderCreateRequest({ ...request.body, payer: request.address! }).toDTO()

      this.ok(response, 'Paid · confirmed on Monad', await this.orderService.create(orderInput))
    } catch (error) {
      this.fail(response, error)
    }
  }
}
