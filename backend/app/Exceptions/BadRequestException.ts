import { Exception } from "./Exception"

export class BadRequestException extends Exception {
  constructor(message: any, details: any | null = null) {
    super(message, 400, details)
  }
}
