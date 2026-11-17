import express, { Express, Request, Response } from 'express'
import { authController } from '@Controllers/Auth'

const authRoute: Express = express()

authRoute.post('/nonce', (request: Request, response: Response): Promise<void> => authController.nonce(request, response))
authRoute.post('/verify', (request: Request, response: Response): Promise<void> => authController.verify(request, response))

export default authRoute
