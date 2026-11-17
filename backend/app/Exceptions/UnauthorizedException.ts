import { Exception } from "./Exception"

export class UnauthorizedException extends Exception {
  constructor(message: any, details: any | null = null) {
    super(message, 401, details)
  }
}
