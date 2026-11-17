export class AuthNonceDTO {
  public address: string
  constructor(input: { address: string }) {
    this.address = input.address.toLowerCase()
  }
}
