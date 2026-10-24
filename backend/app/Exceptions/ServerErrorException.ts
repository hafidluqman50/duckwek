import { Exception } from "./Exception"

export class ServerErrorException extends Exception {
  constructor(message: any, data: any | null = null) {
    super(message, 500, data)
  }
}
