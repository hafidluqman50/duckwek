import { Exception } from "./Exception"

export class ForbiddenException extends Exception {
  constructor(message: any, details: any | null = null) {
    super(message, 403, details)
  }
}
