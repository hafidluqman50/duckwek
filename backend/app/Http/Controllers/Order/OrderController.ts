import { Response } from 'express'
import { BaseController } from '@Controllers/BaseController'
import { OrderService } from '@Services/Order/OrderService'
import { OrderCreateRequest } from '@Requests/Order/OrderCreateRequest'
import { IAuthRequest } from '@Interfaces/IAuthRequest'

export class OrderController extends BaseController {
  constructor(public orderService: OrderService) {
    super()
  }

  /** The player signed once at connect: the order is charged under that session, there is nothing more to sign. */
  public async create(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const dto = new OrderCreateRequest({ ...req.body, payer: req.address! }).toDTO()
      this.ok(res, 'Paid · confirmed on Monad', await this.orderService.create(dto))
    } catch (e) {
      this.fail(res, e)
    }
  }
}
