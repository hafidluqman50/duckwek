import express, { Express, Response } from 'express'
import { orderController } from '@Controllers/Order'
import { authCheck } from '@Middlewares/Kernel'
import { IAuthRequest } from '@Interfaces/IAuthRequest'

const ordersRoute: Express = express()

ordersRoute.post('/', [authCheck.handle], (request: IAuthRequest, response: Response): Promise<void> => orderController.create(request, response))

export default ordersRoute
