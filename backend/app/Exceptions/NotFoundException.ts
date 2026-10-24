import { Exception } from "./Exception"

export class NotFoundException extends Exception {
  constructor(message: any, data: any | null = null) {
    super(message, 404, data)
  }
}
