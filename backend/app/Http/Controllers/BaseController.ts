import { Response } from 'express'
import { Exception } from '@Exceptions/Exception'

export abstract class BaseController {
  protected ok(res: Response, message: string, data: unknown, status = 200): void {
    res.status(status).json({ status: true, message, data })
  }

  protected fail(res: Response, error: unknown): void {
    if (error instanceof Exception) {
      res.status(error.statusCode).json({ status: false, message: error.message, data: error.data })
    } else {
      console.error(error)
      res.status(500).json({ status: false, message: (error as Error).message })
    }
  }
}
