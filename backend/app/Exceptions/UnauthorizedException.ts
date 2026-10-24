import { Exception } from "./Exception"

export class UnauthorizedException extends Exception {
  constructor(message: any, data: any | null = null) {
    super(message, 401, data)
  }
}
