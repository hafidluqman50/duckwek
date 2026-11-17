import { Exception } from "./Exception"

export class ConflictException extends Exception {
  constructor(message: any, details: any | null = null) {
    super(message, 409, details)
  }
}
