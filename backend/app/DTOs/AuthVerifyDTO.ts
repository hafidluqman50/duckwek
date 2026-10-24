export class AuthVerifyDTO {
  public address: string
  public signature: `0x${string}`
  constructor(data: { address: string; signature: string }) {
    this.address = data.address.toLowerCase()
    this.signature = data.signature as `0x${string}`
  }
}
