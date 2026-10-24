import { OrderController } from './OrderController'
import { orderService } from '@Services/Order'

const orderController = new OrderController(orderService)

export { orderController }
