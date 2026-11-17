import { Request, Response } from 'express'
import { BaseController } from '@Controllers/BaseController'
import { AuthService } from '@Services/Auth/AuthService'
import { AuthNonceRequest } from '@Requests/Auth/AuthNonceRequest'
import { AuthVerifyRequest } from '@Requests/Auth/AuthVerifyRequest'

export class AuthController extends BaseController {
  constructor(public authService: AuthService) {
    super()
  }

  public async nonce(request: Request, response: Response): Promise<void> {
    try {
      const nonceInput = new AuthNonceRequest({ address: String(request.body.address || '') }).toDTO()

      this.ok(response, 'Sign this message to sign in', await this.authService.nonce(nonceInput))
    } catch (error) {
      this.fail(response, error)
    }
  }

  public async verify(request: Request, response: Response): Promise<void> {
    try {
      const verifyInput = new AuthVerifyRequest({ address: String(request.body.address || ''), signature: String(request.body.signature || '') }).toDTO()

      this.ok(response, 'Signed in', await this.authService.verify(verifyInput))
    } catch (error) {
      this.fail(response, error)
    }
  }
}
