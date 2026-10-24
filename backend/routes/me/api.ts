import express, { Express, Response } from 'express'
import { profileController } from '@Controllers/Profile'
import { authCheck } from '@Middlewares/Kernel'
import { IAuthRequest } from '@Interfaces/IAuthRequest'

const meRoute: Express = express()

meRoute.get('/', [authCheck.handle], (req: IAuthRequest, res: Response): Promise<void> => profileController.me(req, res))
meRoute.put('/duck', [authCheck.handle], (req: IAuthRequest, res: Response): Promise<void> => profileController.updateDuck(req, res))

export default meRoute
