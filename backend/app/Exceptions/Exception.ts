export class Exception extends Error {
  public statusCode: number
  public data: any | null

  constructor(message: any, statusCode: number, details: any | null) {
    super(message)
    this.statusCode = statusCode
    this.data = details
  }
}
