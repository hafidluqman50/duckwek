import express, { Express, Response } from 'express'
import { withdrawController } from '@Controllers/Withdraw'
import { authCheck } from '@Middlewares/Kernel'
import { IAuthRequest } from '@Interfaces/IAuthRequest'

const withdrawRoute: Express = express()

withdrawRoute.post('/prepare', [authCheck.handle], (req: IAuthRequest, res: Response): Promise<void> => withdrawController.prepare(req, res))
withdrawRoute.post('/submit', [authCheck.handle], (req: IAuthRequest, res: Response): Promise<void> => withdrawController.submit(req, res))

export default withdrawRoute
