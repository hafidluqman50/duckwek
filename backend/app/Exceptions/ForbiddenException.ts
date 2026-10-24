import { Exception } from "./Exception"

export class ForbiddenException extends Exception {
  constructor(message: any, data: any | null = null) {
    super(message, 403, data)
  }
}
