export class Exception extends Error {
  public statusCode: number
  public data: any | null

  constructor(message: any, statusCode: number, data: any | null) {
    super(message)
    this.statusCode = statusCode
    this.data = data
  }
}
