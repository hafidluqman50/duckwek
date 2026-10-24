import { Response, NextFunction } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { env } from '@config/env'
import { IAuthRequest } from '@Interfaces/IAuthRequest'

export const verifyToken = (token: string): `0x${string}` | null => {
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload
    return typeof decoded.address === 'string' ? (decoded.address.toLowerCase() as `0x${string}`) : null
  } catch {
    return null
  }
}

export class AuthenticationMiddleware {
  public handle(req: IAuthRequest, res: Response, next: NextFunction): void {
    const header = req.headers['authorization']
    if (!header) {
      res.status(401).send({ status: false, message: 'Error', data: { errors: 'Unauthorized' } })
      return
    }
    const [scheme, token] = String(header).split(' ')
    if (scheme !== 'Bearer' || !token) {
      res.status(403).send({ status: false, message: 'Error', data: { errors: 'Incorrect Format Token!' } })
      return
    }
    const address = verifyToken(token)
    if (!address) {
      res.status(401).send({ status: false, message: 'Error', data: { errors: 'Session expired, sign in again' } })
      return
    }
    req.address = address
    next()
  }
}
