import { Exception } from "./Exception"

export class NotFoundException extends Exception {
  constructor(message: any, details: any | null = null) {
    super(message, 404, details)
  }
}
