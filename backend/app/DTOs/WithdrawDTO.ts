import { IWithdrawPrepare, IWithdrawSubmit } from '@Interfaces/IWithdraw'

export class WithdrawPrepareDTO {
  public owner: `0x${string}`
  public to: `0x${string}`
  public amount: bigint | null
  constructor(data: IWithdrawPrepare) {
    this.owner = data.owner.toLowerCase() as `0x${string}`
    this.to = (data.to || data.owner).toLowerCase() as `0x${string}`
    this.amount = data.amount ? BigInt(data.amount) : null
  }
}

export class WithdrawSubmitDTO {
  public owner: `0x${string}`
  public withdrawal: { owner: `0x${string}`; to: `0x${string}`; amount: bigint; nonce: bigint; deadline: bigint }
  public signature: `0x${string}`
  constructor(data: IWithdrawSubmit) {
    this.owner = data.owner.toLowerCase() as `0x${string}`
    this.withdrawal = {
      owner: data.withdrawal.owner as `0x${string}`,
      to: data.withdrawal.to as `0x${string}`,
      amount: BigInt(data.withdrawal.amount),
      nonce: BigInt(data.withdrawal.nonce),
      deadline: BigInt(data.withdrawal.deadline),
    }
    this.signature = data.signature as `0x${string}`
  }
}
