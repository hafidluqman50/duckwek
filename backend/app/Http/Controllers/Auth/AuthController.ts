import { Request, Response } from 'express'
import { BaseController } from '@Controllers/BaseController'
import { AuthService } from '@Services/Auth/AuthService'
import { AuthNonceRequest } from '@Requests/Auth/AuthNonceRequest'
import { AuthVerifyRequest } from '@Requests/Auth/AuthVerifyRequest'

export class AuthController extends BaseController {
  constructor(public authService: AuthService) {
    super()
  }

  public async nonce(req: Request, res: Response): Promise<void> {
    try {
      const dto = new AuthNonceRequest({ address: String(req.body.address || '') }).toDTO()
      this.ok(res, 'Sign this message to sign in', await this.authService.nonce(dto))
    } catch (e) {
      this.fail(res, e)
    }
  }

  public async verify(req: Request, res: Response): Promise<void> {
    try {
      const dto = new AuthVerifyRequest({ address: String(req.body.address || ''), signature: String(req.body.signature || '') }).toDTO()
      this.ok(res, 'Signed in', await this.authService.verify(dto))
    } catch (e) {
      this.fail(res, e)
    }
  }
}
