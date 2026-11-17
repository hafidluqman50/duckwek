import { Response } from 'express'
import { Exception } from '@Exceptions/Exception'

export abstract class BaseController {
  protected ok(response: Response, message: string, payload: unknown, status = 200): void {
    response.status(status).json({ status: true, message, data: payload })
  }

  protected fail(response: Response, error: unknown): void {
    if (error instanceof Exception) {
      response.status(error.statusCode).json({ status: false, message: error.message, data: error.data })
    } else {
      console.error(error)
      response.status(500).json({ status: false, message: (error as Error).message })
    }
  }
}
