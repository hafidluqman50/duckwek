import { Request } from 'express'

export interface IAuthRequest extends Request {
  address?: `0x${string}`
}
