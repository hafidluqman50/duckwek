import { decodeErrorResult, encodeFunctionData, parseEventLogs, parseSignature, type Abi, type Address, type Hex } from 'viem'
import { env } from '@config/env'
import { addresses, operator, publicClient, sendClient, txUrl } from './Contracts'
import { raceAbi, vaultAbi } from './abis'

export interface TxResult {
  hash: Hex
  url: string
  blockNumber: number
  gasUsed: bigint
  logs: any[]
}

export interface TickResult {
  step: number
  hash: Hex
  includedBlock: number
  gasLimit: number
  durationMs: number
}

export interface LoadoutArg {
  template: number
  partBySlot: readonly [number, number, number]
}
export const NO_PART = 0xffff
export const EMPTY_LOADOUT: LoadoutArg = { template: 0, partBySlot: [NO_PART, NO_PART, NO_PART] }

export interface OrderArg {
  payer: Address
  kind: number
  ref: bigint
  roomKey: Hex
  loadout: LoadoutArg
  amount: bigint
  salt: bigint
}

export interface PermitArg {
  value: bigint
  deadline: bigint
  v: number
  r: Hex
  s: Hex
}
export const NO_PERMIT: PermitArg = { value: 0n, deadline: 0n, v: 0, r: `0x${'0'.repeat(64)}`, s: `0x${'0'.repeat(64)}` }

export const toPermitArg = (value: bigint, deadline: bigint, signature: Hex): PermitArg => {
  const parsed = parseSignature(signature)

  return { value, deadline, v: Number(parsed.v ?? BigInt(27 + (parsed.yParity ?? 0))), r: parsed.r, s: parsed.s }
}

const GAS_MARGIN = 110n
const JOIN_BATCH_EXTRA_GAS = 60_000n
const FEES = { maxFeePerGas: 150_000_000_000n, maxPriorityFeePerGas: 2_000_000_000n }

export const revertReason = (data: Hex): string => {
  try {
    return decodeErrorResult({ abi: vaultAbi, data }).errorName
  } catch {
    return 'reverted'
  }
}

class Relayer {
  private nonce: number | null = null
  private nonceLock: Promise<unknown> = Promise.resolve()

  private takeNonce(): Promise<number> {
    const nextNonce = this.nonceLock.then(async () => {
      if (this.nonce === null) this.nonce = await publicClient.getTransactionCount({ address: operator.address, blockTag: 'pending' })

      return this.nonce++
    })
    this.nonceLock = nextNonce.catch(() => undefined)

    return nextNonce
  }

  private resync(): void {
    this.nonce = null
  }

  private async sendTx(to: Address, data: Hex, gas: bigint) {
    const nonce = await this.takeNonce()

    try {
      const raw = await operator.signTransaction({ type: 'eip1559', chainId: env.chainId, to, data, gas, nonce, value: 0n, ...FEES } as any)
      const receipt: any = await sendClient.request({ method: 'eth_sendRawTransactionSync', params: [raw] } as any)

      return {
        transactionHash: receipt.transactionHash as Hex,
        status: receipt.status === '0x1' || receipt.status === 'success' ? 'success' : 'reverted',
        blockNumber: BigInt(receipt.blockNumber),
        gasUsed: BigInt(receipt.gasUsed),
        logs: (receipt.logs || []) as any[],
      }
    } catch (error) {
      this.resync()

      throw error
    }
  }

  async write(label: string, to: Address, abi: Abi, functionName: string, args: unknown[], extraGas = 0n): Promise<TxResult> {
    let lastError: unknown

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await publicClient.simulateContract({ account: operator, address: to, abi, functionName, args, ...FEES } as any)
        const estimatedGas = await publicClient.estimateContractGas({ account: operator, address: to, abi, functionName, args, ...FEES } as any)
        const receipt: any = await this.sendTx(to, encodeFunctionData({ abi, functionName, args } as any), (estimatedGas * GAS_MARGIN) / 100n + extraGas)

        if (receipt.status !== 'success') throw new Error(`reverted ${receipt.transactionHash}`)

        console.log(`[chain] ${label} ok ${receipt.transactionHash} gas=${receipt.gasUsed}`)

        return { hash: receipt.transactionHash, url: txUrl(receipt.transactionHash), blockNumber: Number(receipt.blockNumber), gasUsed: receipt.gasUsed, logs: receipt.logs }
      } catch (error) {
        lastError = error
        const message = (error as any)?.shortMessage || (error as Error)?.message
        console.warn(`[chain] ${label} attempt ${attempt} failed: ${message}`)

        if (/revert|WrongStatus|BadKind|RoomKeyUsed|LengthMismatch|BatchTooLarge|DuplicatePodium|NotOperator|WrongAmount|AlreadyJoined|RoomFull/i.test(message)) break

        await new Promise((resolve) => setTimeout(resolve, 400 * attempt))
      }
    }

    throw lastError
  }

  async createRoom(order: OrderArg, permit: PermitArg): Promise<{ tx: TxResult; chainRoomId: number }> {
    const transaction = await this.write('createRoom', addresses.race, raceAbi, 'createRoom', [order, permit])
    const event = parseEventLogs({ abi: raceAbi, logs: transaction.logs, eventName: 'RoomCreated' })[0]

    if (!event) throw new Error('RoomCreated event not found in the createRoom receipt')

    return { tx: transaction, chainRoomId: Number(event.args.roomId) }
  }

  joinBatch(chainRoomId: number, orders: OrderArg[], permits: PermitArg[]) {
    return this.write(`joinBatch(${orders.length})`, addresses.race, raceAbi, 'joinBatch', [BigInt(chainRoomId), orders, permits], JOIN_BATCH_EXTRA_GAS)
  }

  async start(chainRoomId: number, players: number, participantsRoot: Hex, engineVersion: Hex): Promise<{ tx: TxResult; seed: Hex; startBlock: number }> {
    const transaction = await this.write('start', addresses.race, raceAbi, 'start', [BigInt(chainRoomId), players, participantsRoot, engineVersion])
    const event = parseEventLogs({ abi: raceAbi, logs: transaction.logs, eventName: 'Started' })[0]

    if (!event) throw new Error('Started event not found in the start receipt')

    return { tx: transaction, seed: event.args.seed, startBlock: Number(event.args.startBlock) }
  }

  finalize(chainRoomId: number, standingRoot: Hex, podium: [Address, Address, Address]) {
    return this.write('finalize', addresses.race, raceAbi, 'finalize', [BigInt(chainRoomId), standingRoot, podium])
  }

  async buyPart(order: OrderArg, permit: PermitArg): Promise<{ tx: TxResult; tokenId: string }> {
    const withPermit = permit.deadline !== 0n
    const transaction = await this.write('buyPart', addresses.vault, vaultAbi, withPermit ? 'permitAndSpend' : 'spend', withPermit ? [order, permit] : [order])
    const event = parseEventLogs({ abi: vaultAbi, logs: transaction.logs, eventName: 'PartPurchased' })[0]

    if (!event) throw new Error('PartPurchased event not found in the receipt')

    return { tx: transaction, tokenId: String(event.args.tokenId) }
  }

  achievements(transaction: TxResult): { address: string; kind: number }[] {
    return parseEventLogs({ abi: raceAbi, logs: transaction.logs, eventName: 'AchievementAwarded' }).map((event) => ({ address: String(event.args.player).toLowerCase(), kind: Number(event.args.kind) }))
  }

  withdraw(withdrawal: { owner: Address; to: Address; amount: bigint; nonce: bigint; deadline: bigint }, signature: Hex) {
    return this.write('withdraw', addresses.vault, vaultAbi, 'withdrawWithSig', [withdrawal, signature])
  }

  async tick(chainRoomId: number): Promise<TickResult | null> {
    const startedAt = Date.now()
    const data = encodeFunctionData({ abi: raceAbi, functionName: 'tick', args: [BigInt(chainRoomId)] })

    try {
      const receipt = await this.sendTx(addresses.race, data, env.tickGas)

      if (receipt.status !== 'success') {
        console.warn(`[chain] tick reverted room=${chainRoomId} tx=${receipt.transactionHash}`)

        return null
      }

      const event = parseEventLogs({ abi: raceAbi, logs: receipt.logs, eventName: 'Tick' })[0]

      if (!event) {
        console.warn(`[chain] tick without Tick log room=${chainRoomId} tx=${receipt.transactionHash}`)

        return null
      }

      return { step: Number(event.args.n), hash: receipt.transactionHash, includedBlock: Number(receipt.blockNumber), gasLimit: Number(env.tickGas), durationMs: Date.now() - startedAt }
    } catch (error) {
      console.warn(`[chain] tick failed room=${chainRoomId}:`, (error as any)?.shortMessage || (error as Error)?.message)

      return null
    }
  }
}

export const relayer = new Relayer()
