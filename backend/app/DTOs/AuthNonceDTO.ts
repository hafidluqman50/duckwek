export class AuthNonceDTO {
  public address: string
  constructor(data: { address: string }) {
    this.address = data.address.toLowerCase()
  }
}
