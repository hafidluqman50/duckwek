import express, { Express, Response } from 'express'
import { orderController } from '@Controllers/Order'
import { authCheck } from '@Middlewares/Kernel'
import { IAuthRequest } from '@Interfaces/IAuthRequest'

const ordersRoute: Express = express()

ordersRoute.post('/', [authCheck.handle], (req: IAuthRequest, res: Response): Promise<void> => orderController.create(req, res))

export default ordersRoute
