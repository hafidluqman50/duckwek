import { IWithdrawPrepare, IWithdrawSubmit } from '@Interfaces/IWithdraw'

export class WithdrawPrepareDTO {
  public owner: `0x${string}`
  public to: `0x${string}`
  public amount: bigint | null
  constructor(input: IWithdrawPrepare) {
    this.owner = input.owner.toLowerCase() as `0x${string}`
    this.to = (input.to || input.owner).toLowerCase() as `0x${string}`
    this.amount = input.amount ? BigInt(input.amount) : null
  }
}

export class WithdrawSubmitDTO {
  public owner: `0x${string}`
  public withdrawal: { owner: `0x${string}`; to: `0x${string}`; amount: bigint; nonce: bigint; deadline: bigint }
  public signature: `0x${string}`
  constructor(input: IWithdrawSubmit) {
    this.owner = input.owner.toLowerCase() as `0x${string}`
    this.withdrawal = {
      owner: input.withdrawal.owner as `0x${string}`,
      to: input.withdrawal.to as `0x${string}`,
      amount: BigInt(input.withdrawal.amount),
      nonce: BigInt(input.withdrawal.nonce),
      deadline: BigInt(input.withdrawal.deadline),
    }
    this.signature = input.signature as `0x${string}`
  }
}
