import express, { Express, Response } from 'express'
import { withdrawController } from '@Controllers/Withdraw'
import { authCheck } from '@Middlewares/Kernel'
import { IAuthRequest } from '@Interfaces/IAuthRequest'

const withdrawRoute: Express = express()

withdrawRoute.post('/prepare', [authCheck.handle], (request: IAuthRequest, response: Response): Promise<void> => withdrawController.prepare(request, response))
withdrawRoute.post('/submit', [authCheck.handle], (request: IAuthRequest, response: Response): Promise<void> => withdrawController.submit(request, response))

export default withdrawRoute
