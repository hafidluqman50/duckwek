import { Exception } from "./Exception"

export class ConflictException extends Exception {
  constructor(message: any, data: any | null = null) {
    super(message, 409, data)
  }
}
