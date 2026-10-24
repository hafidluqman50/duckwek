import express, { Express, Request, Response } from 'express'
import { catalogController } from '@Controllers/Catalog'

const catalogRoute: Express = express()

catalogRoute.get('/tracks', (req: Request, res: Response): Promise<void> => catalogController.tracks(req, res))
catalogRoute.get('/parts', (req: Request, res: Response): Promise<void> => catalogController.parts(req, res))

export default catalogRoute
