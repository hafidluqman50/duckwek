import express, { Express, Request, Response } from 'express'
import { authController } from '@Controllers/Auth'

const authRoute: Express = express()

authRoute.post('/nonce', (req: Request, res: Response): Promise<void> => authController.nonce(req, res))
authRoute.post('/verify', (req: Request, res: Response): Promise<void> => authController.verify(req, res))

export default authRoute
