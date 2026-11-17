import express, { Express, Response } from 'express'
import { profileController } from '@Controllers/Profile'
import { authCheck } from '@Middlewares/Kernel'
import { IAuthRequest } from '@Interfaces/IAuthRequest'

const meRoute: Express = express()

meRoute.get('/', [authCheck.handle], (request: IAuthRequest, response: Response): Promise<void> => profileController.me(request, response))
meRoute.put('/duck', [authCheck.handle], (request: IAuthRequest, response: Response): Promise<void> => profileController.updateDuck(request, response))

export default meRoute
