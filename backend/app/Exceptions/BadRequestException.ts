import { Exception } from "./Exception"

export class BadRequestException extends Exception {
  constructor(message: any, data: any | null = null) {
    super(message, 400, data)
  }
}
