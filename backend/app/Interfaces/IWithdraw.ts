export interface IWithdrawPrepare {
  owner: string
  to?: string
  amount?: string
}

export interface IWithdrawSubmit {
  owner: string
  withdrawal: { owner: string; to: string; amount: string; nonce: string; deadline: string }
  signature: string
}
