import crypto from 'crypto'
import { keccak256, toHex, type Address, type Hex } from 'viem'
import { env } from '@config/env'
import { joinBatcher } from '@Chain/JoinBatcher'
import { chainPrice } from '@Chain/Prices'
import { EMPTY_LOADOUT, NO_PART, NO_PERMIT, relayer, toPermitArg, type LoadoutArg, type OrderArg } from '@Chain/Relayer'
import { KIND, TEMPLATE_ID } from '@Chain/TypedData'
import { PaymentRepository } from '@Repositories/Payment/PaymentRepository'
import { RoomRepository } from '@Repositories/Room/RoomRepository'
import { CatalogRepository } from '@Repositories/Catalog/CatalogRepository'
import { DuckRepository } from '@Repositories/Duck/DuckRepository'
import { AuthNonceRepository } from '@Repositories/Auth/AuthNonceRepository'
import { PlayerRepository } from '@Repositories/Auth/PlayerRepository'
import { OrderCreateDTO } from '@DTOs/OrderCreateDTO'
import { BadRequestException } from '@Exceptions/BadRequestException'
import { NotFoundException } from '@Exceptions/NotFoundException'
import { ConflictException } from '@Exceptions/ConflictException'
import { UnauthorizedException } from '@Exceptions/UnauthorizedException'
import { roomEvents } from '@Services/Room/RoomEvents'
import { AuthNonce } from '@Models/AuthNonce'

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const ROOMS_PER_10_MIN = 5

const TEMPLATE_NAME: Record<number, 'balanced' | 'sprint' | 'tank'> = { 0: 'balanced', 1: 'sprint', 2: 'tank' }
const SLOT_INDEX: Record<string, number> = { wings: 0, tail: 1, bill: 2 }

export const roomKeyOf = (code: string): Hex => keccak256(toHex(code.toUpperCase()))

export class OrderService {
  private inflight = new Set<string>()

  constructor(
    public paymentRepository: PaymentRepository,
    public roomRepository: RoomRepository,
    public catalogRepository: CatalogRepository,
    public duckRepository: DuckRepository,
    public authNonceRepository: AuthNonceRepository,
    public playerRepository: PlayerRepository,
  ) {}

  private async newCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = 'WEK-' + Array.from(crypto.randomBytes(3)).map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')

      if (!(await this.roomRepository.codeTaken(code))) return code
    }

    throw new ConflictException('Could not allocate a room code')
  }

  private async loadoutOf(address: string): Promise<{ arg: LoadoutArg; partTypeId: number | null }> {
    const duck = await this.duckRepository.byAddress(address)
    const template = TEMPLATE_ID[duck?.template || 'balanced'] ?? 0
    const partBySlot: [number, number, number] = [NO_PART, NO_PART, NO_PART]
    let partTypeId: number | null = null

    if (duck?.equipped_part_type_id !== null && duck?.equipped_part_type_id !== undefined) {
      const part = await this.catalogRepository.partByTypeId(duck.equipped_part_type_id)

      if (part && (await this.duckRepository.ownsPart(address, part.type_id))) {
        partBySlot[SLOT_INDEX[part.slot]] = part.type_id
        partTypeId = part.type_id
      }
    }

    return { arg: { template, partBySlot }, partTypeId }
  }

  private async session(payer: string, price: bigint): Promise<AuthNonce> {
    const session = await this.authNonceRepository.activeSession(payer)

    if (!session || !session.signature || session.deadline === null) throw new UnauthorizedException('Session ended, connect again')

    if (BigInt(session.spent) + price > BigInt(session.session_cap)) throw new UnauthorizedException('Session spending limit reached')

    return session
  }

  public async create(orderInput: OrderCreateDTO) {
    if (orderInput.kind === 'create_room') return this.createRoom(orderInput)

    if (orderInput.kind === 'join_room') return this.joinRoom(orderInput)

    return this.buyPart(orderInput)
  }

  private order(payer: string, kind: number, ref: bigint, roomKey: Hex, loadout: LoadoutArg, amount: bigint): OrderArg {
    return { payer: payer as Address, kind, ref, roomKey, loadout, amount, salt: BigInt('0x' + crypto.randomBytes(16).toString('hex')) }
  }

  private permitOf(session: AuthNonce) {
    return session.permit_used ? NO_PERMIT : toPermitArg(BigInt(session.session_cap), BigInt(session.deadline!), session.signature as Hex)
  }

  private async record(orderInput: OrderCreateDTO, order: OrderArg, session: AuthNonce, roomCode: string | null, label: string) {
    return this.paymentRepository.create({
      kind: orderInput.kind,
      payer: orderInput.payer,
      amount: order.amount.toString(),
      ref: order.ref.toString(),
      room_code: roomCode,
      nonce: order.salt.toString(),
      deadline: session.deadline!,
      status: 'pending',
      meta: { label },
    })
  }

  private async settle(payment: Awaited<ReturnType<OrderService['record']>>, session: AuthNonce, amount: bigint, txHash: string) {
    await payment.update({ status: 'confirmed', tx_hash: txHash })
    await this.authNonceRepository.recordSpend(session, amount)
    await this.playerRepository.markFirstSpend(payment.payer)
  }

  private async fail(payment: Awaited<ReturnType<OrderService['record']>>, error: unknown): Promise<never> {
    const message = (error as any)?.shortMessage || (error as Error).message
    await payment.update({ status: 'failed', error: message })

    throw new BadRequestException('Payment failed: ' + message)
  }

  private async createRoom(orderInput: OrderCreateDTO) {
    const track = await this.catalogRepository.trackByTokenId(orderInput.trackId!)

    if (!track || track.status !== 'active') throw new BadRequestException('That track is not available yet')

    const recent = await this.paymentRepository.recentPrepared(orderInput.payer, 'create_room', 10 * 60_000)

    if (recent >= ROOMS_PER_10_MIN) throw new BadRequestException('Too many rooms created, wait a few minutes')

    const price = await chainPrice(KIND.create_room, BigInt(track.token_id!))
    const session = await this.session(orderInput.payer, price)
    const code = await this.newCode()
    const loadout = await this.loadoutOf(orderInput.payer)
    const order = this.order(orderInput.payer, KIND.create_room, BigInt(track.token_id!), roomKeyOf(code), loadout.arg, price)
    const label = `Room · ${track.name}`
    const payment = await this.record(orderInput, order, session, code, label)
    let opened

    try {
      opened = await relayer.createRoom(order, this.permitOf(session))
    } catch (error) {
      return this.fail(payment, error)
    }

    await this.settle(payment, session, price, opened.tx.hash)
    const room = await this.roomRepository.create({
      code,
      room_key: roomKeyOf(code),
      name: orderInput.roomName,
      host: orderInput.payer,
      track_id: track.id,
      max_ducks: orderInput.maxDucks,
      fill_bots: orderInput.fillBots,
      status: 'lobby',
      chain_room_id: String(opened.chainRoomId),
      create_tx: opened.tx.hash,
    })
    await this.addPlayerFromProfile(room.id, orderInput.payer, opened.tx.hash, TEMPLATE_NAME[loadout.arg.template] ?? 'balanced', loadout.partTypeId)
    roomEvents.emit('room:changed', room.code)

    return { tx: opened.tx.hash, url: opened.tx.url, kind: orderInput.kind, label, amount: price.toString(), roomCode: code }
  }

  private async joinRoom(orderInput: OrderCreateDTO) {
    const room = await this.roomRepository.byCode(orderInput.roomCode!)

    if (!room || room.status === 'pending') throw new NotFoundException('Room not found')

    if (room.status === 'closed') throw new BadRequestException('This room is closed')

    if (room.status !== 'lobby') throw new BadRequestException('This race already started')

    if (room.host === orderInput.payer || (await this.roomRepository.player(room.id, orderInput.payer))) return { alreadyIn: true, roomCode: room.code }

    if ((await this.roomRepository.countPlayers(room.id)) >= room.max_ducks) throw new BadRequestException('Room is full')

    if (!room.chain_room_id) throw new BadRequestException('This room has no on-chain id')

    const price = await chainPrice(KIND.join_room, 0n)
    const session = await this.session(orderInput.payer, price)
    const key = `${room.code}:${orderInput.payer}`

    if (this.inflight.has(key)) throw new ConflictException('Payment already pending')

    this.inflight.add(key)
    const label = `Ticket · ${room.code}`
    const loadout = await this.loadoutOf(orderInput.payer)
    const order = this.order(orderInput.payer, KIND.join_room, 0n, room.room_key as Hex, loadout.arg, price)
    const payment = await this.record(orderInput, order, session, room.code, label)
    let transaction

    try {
      transaction = await joinBatcher.submit(Number(room.chain_room_id), order, this.permitOf(session))
    } catch (error) {
      return this.fail(payment, error)
    } finally {
      this.inflight.delete(key)
    }

    await this.settle(payment, session, price, transaction.hash)
    await this.addPlayerFromProfile(room.id, orderInput.payer, transaction.hash, TEMPLATE_NAME[loadout.arg.template] ?? 'balanced', loadout.partTypeId)
    roomEvents.emit('room:changed', room.code)

    return { tx: transaction.hash, url: transaction.url, kind: orderInput.kind, label, amount: price.toString(), roomCode: room.code }
  }

  private async buyPart(orderInput: OrderCreateDTO) {
    const part = await this.catalogRepository.partByTypeId(orderInput.partTypeId!)

    if (!part || part.status !== 'active') throw new BadRequestException('That part is not for sale')

    if (await this.duckRepository.ownsPart(orderInput.payer, part.type_id)) throw new BadRequestException('You already own that part')

    const price = await chainPrice(KIND.buy_part, BigInt(part.type_id))
    const session = await this.session(orderInput.payer, price)
    const label = `Part · ${part.name}`
    const order = this.order(orderInput.payer, KIND.buy_part, BigInt(part.type_id), `0x${'0'.repeat(64)}`, EMPTY_LOADOUT, price)
    const payment = await this.record(orderInput, order, session, null, label)
    let bought

    try {
      bought = await relayer.buyPart(order, this.permitOf(session))
    } catch (error) {
      return this.fail(payment, error)
    }

    await this.settle(payment, session, price, bought.tx.hash)
    await this.duckRepository.addLicense({ address: orderInput.payer, type_id: part.type_id, token_id: bought.tokenId, tx_hash: bought.tx.hash })

    return { tx: bought.tx.hash, url: bought.tx.url, kind: orderInput.kind, label, amount: price.toString(), partTypeId: part.type_id, tokenId: bought.tokenId }
  }

  private async addPlayerFromProfile(roomId: number, address: string, joinTx: string | null, template: 'balanced' | 'sprint' | 'tank', partTypeId: number | null) {
    const duck = await this.duckRepository.byAddress(address)
    await this.roomRepository.addPlayer({
      room_id: roomId,
      address,
      duck_name: duck?.name || 'New duck',
      template,
      body_color: duck?.body_color || '#FFFFFF',
      bill_color: duck?.bill_color || '#FF9F1C',
      cosmetics: duck?.cosmetics || { hat: false, shades: false, scarf: false },
      part_type_id: partTypeId,
      join_tx: joinTx,
      joined_on_chain: true,
    })
  }
}
