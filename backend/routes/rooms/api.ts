import express, { Express, Request, Response } from 'express'
import { roomController } from '@Controllers/Room'
import { authCheck } from '@Middlewares/Kernel'
import { IAuthRequest } from '@Interfaces/IAuthRequest'

const roomsRoute: Express = express()

roomsRoute.get('/:code', (request: Request, response: Response): Promise<void> => roomController.show(request, response))
roomsRoute.put('/:code/loadout', [authCheck.handle], (request: IAuthRequest, response: Response): Promise<void> => roomController.loadout(request, response))
roomsRoute.post('/:code/start', [authCheck.handle], (request: IAuthRequest, response: Response): Promise<void> => roomController.start(request, response))

export default roomsRoute
