export class AuthVerifyDTO {
  public address: string
  public signature: `0x${string}`
  constructor(input: { address: string; signature: string }) {
    this.address = input.address.toLowerCase()
    this.signature = input.signature as `0x${string}`
  }
}
