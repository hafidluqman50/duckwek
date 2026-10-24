import { OrderService } from './OrderService'
import { paymentRepository } from '@Repositories/Payment'
import { roomRepository } from '@Repositories/Room'
import { catalogRepository } from '@Repositories/Catalog'
import { duckRepository } from '@Repositories/Duck'
import { authNonceRepository, playerRepository } from '@Repositories/Auth'

const orderService = new OrderService(paymentRepository, roomRepository, catalogRepository, duckRepository, authNonceRepository, playerRepository)

export { orderService }
