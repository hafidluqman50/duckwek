import { Exception } from "./Exception"

export class ServerErrorException extends Exception {
  constructor(message: any, details: any | null = null) {
    super(message, 500, details)
  }
}
