import express, { Express, Request, Response } from 'express'
import { catalogController } from '@Controllers/Catalog'

const catalogRoute: Express = express()

catalogRoute.get('/tracks', (request: Request, response: Response): Promise<void> => catalogController.tracks(request, response))
catalogRoute.get('/parts', (request: Request, response: Response): Promise<void> => catalogController.parts(request, response))

export default catalogRoute
