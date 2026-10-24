import express, { Express, Request, Response } from 'express'
import { roomController } from '@Controllers/Room'
import { authCheck } from '@Middlewares/Kernel'
import { IAuthRequest } from '@Interfaces/IAuthRequest'

const roomsRoute: Express = express()

roomsRoute.get('/:code', (req: Request, res: Response): Promise<void> => roomController.show(req, res))
roomsRoute.put('/:code/loadout', [authCheck.handle], (req: IAuthRequest, res: Response): Promise<void> => roomController.loadout(req, res))
roomsRoute.post('/:code/start', [authCheck.handle], (req: IAuthRequest, res: Response): Promise<void> => roomController.start(req, res))

export default roomsRoute
