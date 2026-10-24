import { decodeErrorResult, encodeFunctionData, parseEventLogs, parseSignature, type Abi, type Address, type Hex } from 'viem'
import { env } from '@config/env'
import { addresses, operator, publicClient, sendClient, txUrl } from './Contracts'
import { duckAbi, raceAbi, vaultAbi } from './abis'

export interface TxResult {
  hash: Hex
  url: string
  blockNumber: number
  gasUsed: bigint
  logs: any[]
}

export interface TickResult {
  /** Step of the race, from the contract: block.number - startBlock. */
  n: number
  hash: Hex
  includedBlock: number
  gasLimit: number
  ms: number
}

export interface OrderArg {
  payer: Address
  kind: number
  ref: bigint
  roomKey: Hex
  template: number
  amount: bigint
  salt: bigint
}

/** The payer's permit as stored at sign-in. `deadline: 0n` means "no permit, the allowance already exists". */
export interface PermitArg {
  value: bigint
  deadline: bigint
  v: number
  r: Hex
  s: Hex
}
export const NO_PERMIT: PermitArg = { value: 0n, deadline: 0n, v: 0, r: `0x${'0'.repeat(64)}`, s: `0x${'0'.repeat(64)}` }

export const toPermitArg = (value: bigint, deadline: bigint, signature: Hex): PermitArg => {
  const sig = parseSignature(signature)
  return { value, deadline, v: Number(sig.v ?? BigInt(27 + (sig.yParity ?? 0))), r: sig.r, s: sig.s }
}

// Monad charges the gas LIMIT; estimateGas of the real payload plus 10 % never failed in measurements (0 % passed too).
const GAS_MARGIN = 110n
const JOIN_BATCH_EXTRA_GAS = 60_000n
const FEES = { maxFeePerGas: 150_000_000_000n, maxPriorityFeePerGas: 2_000_000_000n }

/** Human readable revert reason from the Vault errors (used when a join fails inside joinBatch). */
export const revertReason = (data: Hex): string => {
  try {
    return decodeErrorResult({ abi: vaultAbi, data }).errorName
  } catch {
    return 'reverted'
  }
}

/**
 * Relayer (operator key). Pays gas for every write so players never hold MON. One nonce counter serves every room, and
 * every write is sent with eth_sendRawTransactionSync (the receipt comes back in the same call).
 */
class Relayer {
  private nonce: number | null = null
  private nonceLock: Promise<unknown> = Promise.resolve()

  private takeNonce(): Promise<number> {
    const p = this.nonceLock.then(async () => {
      if (this.nonce === null) this.nonce = await publicClient.getTransactionCount({ address: operator.address, blockTag: 'pending' })
      return this.nonce++
    })
    this.nonceLock = p.catch(() => undefined)
    return p
  }

  private resync(): void {
    this.nonce = null
  }

  /** Sign and send one transaction with eth_sendRawTransactionSync: the receipt comes back in the same call. */
  private async sendTx(to: Address, data: Hex, gas: bigint) {
    const nonce = await this.takeNonce()
    try {
      const raw = await operator.signTransaction({ type: 'eip1559', chainId: env.chainId, to, data, gas, nonce, value: 0n, ...FEES } as any)
      const rc: any = await sendClient.request({ method: 'eth_sendRawTransactionSync', params: [raw] } as any)
      return {
        transactionHash: rc.transactionHash as Hex,
        status: rc.status === '0x1' || rc.status === 'success' ? 'success' : 'reverted',
        blockNumber: BigInt(rc.blockNumber),
        gasUsed: BigInt(rc.gasUsed),
        logs: (rc.logs || []) as any[],
      }
    } catch (e) {
      this.resync()
      throw e
    }
  }

  /** simulate (revert reasons) + estimateGas + send. Used for the few writes of a race; ticks use `tick` below. */
  async write(label: string, to: Address, abi: Abi, functionName: string, args: unknown[], extraGas = 0n): Promise<TxResult> {
    let lastErr: unknown
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // Fees are passed explicitly: viem would otherwise ask the node for them (extra calls, extra CU) before every simulate and estimate.
        await publicClient.simulateContract({ account: operator, address: to, abi, functionName, args, ...FEES } as any)
        const est = await publicClient.estimateContractGas({ account: operator, address: to, abi, functionName, args, ...FEES } as any)
        const rc: any = await this.sendTx(to, encodeFunctionData({ abi, functionName, args } as any), (est * GAS_MARGIN) / 100n + extraGas)
        if (rc.status !== 'success') throw new Error(`reverted ${rc.transactionHash}`)
        console.log(`[chain] ${label} ok ${rc.transactionHash} gas=${rc.gasUsed}`)
        return { hash: rc.transactionHash, url: txUrl(rc.transactionHash), blockNumber: Number(rc.blockNumber), gasUsed: rc.gasUsed, logs: rc.logs }
      } catch (e) {
        lastErr = e
        const msg = (e as any)?.shortMessage || (e as Error)?.message
        console.warn(`[chain] ${label} attempt ${attempt} failed: ${msg}`)
        // Business reverts (wrong status, bad order ...) will not succeed on retry.
        if (/revert|WrongStatus|BadKind|RoomKeyUsed|LengthMismatch|BatchTooLarge|DuplicatePodium|NotOperator|WrongAmount|AlreadyJoined|RoomFull/i.test(msg)) break
        await new Promise((r) => setTimeout(r, 400 * attempt))
      }
    }
    throw lastErr
  }

  /** Opens a room on-chain; the room id comes from the RoomCreated event of this very receipt (reading state can be stale). */
  async createRoom(order: OrderArg, permit: PermitArg): Promise<{ tx: TxResult; chainRoomId: number }> {
    const tx = await this.write('createRoom', addresses.race, raceAbi, 'createRoom', [order, permit])
    const ev = parseEventLogs({ abi: raceAbi, logs: tx.logs, eventName: 'RoomCreated' })[0]
    if (!ev) throw new Error('RoomCreated event not found in the createRoom receipt')
    return { tx, chainRoomId: Number(ev.args.roomId) }
  }

  /**
   * Every join runs inside a try/catch. EIP-150 gives a nested call at most 63/64 of the remaining gas, and estimateGas of such a
   * loop lands a little below what the last join needs (measured: a batch of 1 reverted with out of gas at estimate x 1.1). A fixed
   * margin covers it; Monad charges the limit, so it is kept small (60k gas = 0.006 MON).
   */
  joinBatch(chainRoomId: number, orders: OrderArg[], permits: PermitArg[]) {
    return this.write(`joinBatch(${orders.length})`, addresses.race, raceAbi, 'joinBatch', [BigInt(chainRoomId), orders, permits], JOIN_BATCH_EXTRA_GAS)
  }

  /** Starts the race on-chain. The seed and the start block come from the Started event of this receipt. */
  async start(chainRoomId: number, players: number, participantsRoot: Hex): Promise<{ tx: TxResult; seed: Hex; startBlock: number }> {
    const tx = await this.write('start', addresses.race, raceAbi, 'start', [BigInt(chainRoomId), players, participantsRoot])
    const ev = parseEventLogs({ abi: raceAbi, logs: tx.logs, eventName: 'Started' })[0]
    if (!ev) throw new Error('Started event not found in the start receipt')
    return { tx, seed: ev.args.seed, startBlock: Number(ev.args.startBlock) }
  }

  finalize(chainRoomId: number, standingRoot: Hex, podium: [Address, Address, Address]) {
    return this.write('finalize', addresses.race, raceAbi, 'finalize', [BigInt(chainRoomId), standingRoot, podium])
  }

  /** One part purchase straight through the Vault (a license NFT is minted to the payer). */
  async buyPart(order: OrderArg, permit: PermitArg): Promise<{ tx: TxResult; tokenId: string }> {
    const withPermit = permit.deadline !== 0n
    const tx = await this.write('buyPart', addresses.vault, vaultAbi, withPermit ? 'permitAndSpend' : 'spend', withPermit ? [order, permit] : [order])
    const ev = parseEventLogs({ abi: vaultAbi, logs: tx.logs, eventName: 'PartPurchased' })[0]
    if (!ev) throw new Error('PartPurchased event not found in the receipt')
    return { tx, tokenId: String(ev.args.tokenId) }
  }

  /** First-time achievements awarded by this finalize (kind 0 winner, 1 runner-up, 2 third). */
  achievements(tx: TxResult): { address: string; kind: number }[] {
    return parseEventLogs({ abi: raceAbi, logs: tx.logs, eventName: 'AchievementAwarded' }).map((ev) => ({ address: String(ev.args.player).toLowerCase(), kind: Number(ev.args.kind) }))
  }

  /** Mint the duck into the player's own wallet. One per wallet, enforced on chain (`AlreadyHatched`). */
  async hatch(to: Address, d: { name: string; template: number; bodyColor: number; billColor: number; cosmetics: number }): Promise<{ tx: TxResult; tokenId: string }> {
    if (!addresses.duck) throw new Error('DUCK_NFT is not configured')
    const tx = await this.write('hatch', addresses.duck, duckAbi, 'hatch', [to, d])
    const ev = parseEventLogs({ abi: duckAbi, logs: tx.logs, eventName: 'DuckHatched' })[0]
    if (!ev) throw new Error('DuckHatched event not found in the receipt')
    return { tx, tokenId: String(ev.args.tokenId) }
  }

  withdraw(w: { owner: Address; to: Address; amount: bigint; nonce: bigint; deadline: bigint }, signature: Hex) {
    return this.write('withdraw', addresses.vault, vaultAbi, 'withdrawWithSig', [w, signature])
  }

  /**
   * One transaction per race step: send, nothing else (no simulate, no estimateGas: fixed gas limit, plan Q-11).
   * The step `n` comes from the Tick log of the inline receipt. Never throws: the race must not stop because a tick failed to land.
   */
  async tick(chainRoomId: number): Promise<TickResult | null> {
    const t0 = Date.now()
    const data = encodeFunctionData({ abi: raceAbi, functionName: 'tick', args: [BigInt(chainRoomId)] })
    try {
      const rc = await this.sendTx(addresses.race, data, env.tickGas)
      if (rc.status !== 'success') {
        console.warn(`[chain] tick reverted room=${chainRoomId} tx=${rc.transactionHash}`)
        return null
      }
      const ev = parseEventLogs({ abi: raceAbi, logs: rc.logs, eventName: 'Tick' })[0]
      if (!ev) {
        console.warn(`[chain] tick without Tick log room=${chainRoomId} tx=${rc.transactionHash}`)
        return null
      }
      return { n: Number(ev.args.n), hash: rc.transactionHash, includedBlock: Number(rc.blockNumber), gasLimit: Number(env.tickGas), ms: Date.now() - t0 }
    } catch (e) {
      console.warn(`[chain] tick failed room=${chainRoomId}:`, (e as any)?.shortMessage || (e as Error)?.message)
      return null
    }
  }
}

export const relayer = new Relayer()
