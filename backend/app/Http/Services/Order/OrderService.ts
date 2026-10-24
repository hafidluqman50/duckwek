import crypto from 'crypto'
import { keccak256, toHex, type Address, type Hex } from 'viem'
import { env } from '@config/env'
import { joinBatcher } from '@Chain/JoinBatcher'
import { chainPrice } from '@Chain/Prices'
import { NO_PERMIT, relayer, toPermitArg, type OrderArg } from '@Chain/Relayer'
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
const ROOMS_PER_10_MIN = 5 // each room costs the relayer one createRoom transaction

const TEMPLATE_NAME: Record<number, 'balanced' | 'sprint' | 'tank'> = { 0: 'balanced', 1: 'sprint', 2: 'tank' }

export const roomKeyOf = (code: string): Hex => keccak256(toHex(code.toUpperCase()))

/**
 * Paid orders, charged by the Vault under the player's session (the one signature at connect, plan §3.2).
 *  - create_room: 1 USDC circuit rent (50 % circuit owner / 50 % protocol); the host races, so the rent covers the host's entry.
 *  - join_room: 0.10 USDC ticket (50 / 50), batched per room.
 *  - buy_part: part license (85 % creator / 15 % protocol).
 * The price is read from the Vault, the order carries exactly that amount, and nothing can leave the Vault except by the
 * receivers' own withdraw.
 */
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
    for (let i = 0; i < 20; i++) {
      const code = 'WEK-' + Array.from(crypto.randomBytes(3)).map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
      if (!(await this.roomRepository.codeTaken(code))) return code
    }
    throw new ConflictException('Could not allocate a room code')
  }

  private async templateOf(address: string): Promise<number> {
    const duck = await this.duckRepository.byAddress(address)
    return TEMPLATE_ID[duck?.template || 'balanced'] ?? 0
  }

  /** The session of this player, or a 401 that sends the phone back to connect. */
  private async session(payer: string, price: bigint): Promise<AuthNonce> {
    const s = await this.authNonceRepository.activeSession(payer)
    if (!s || !s.signature || s.deadline === null) throw new UnauthorizedException('Session ended, connect again')
    if (BigInt(s.spent) + price > env.sessionCap) throw new UnauthorizedException('Session spending limit reached, connect again')
    return s
  }

  public async create(dto: OrderCreateDTO) {
    if (dto.kind === 'create_room') return this.createRoom(dto)
    if (dto.kind === 'join_room') return this.joinRoom(dto)
    return this.buyPart(dto)
  }

  private order(payer: string, kind: number, ref: bigint, roomKey: Hex, template: number, amount: bigint): OrderArg {
    return { payer: payer as Address, kind, ref, roomKey, template, amount, salt: BigInt('0x' + crypto.randomBytes(16).toString('hex')) }
  }

  /** The permit goes with the first paid order of a session; later orders rely on the allowance it created. */
  private permitOf(s: AuthNonce) {
    return s.permit_used ? NO_PERMIT : toPermitArg(env.sessionCap, BigInt(s.deadline!), s.signature as Hex)
  }

  private async record(dto: OrderCreateDTO, order: OrderArg, s: AuthNonce, roomCode: string | null, label: string) {
    return this.paymentRepository.create({
      kind: dto.kind,
      payer: dto.payer,
      amount: order.amount.toString(),
      ref: order.ref.toString(),
      room_code: roomCode,
      nonce: order.salt.toString(),
      deadline: s.deadline!,
      status: 'pending',
      meta: { label },
    })
  }

  private async settle(payment: Awaited<ReturnType<OrderService['record']>>, s: AuthNonce, amount: bigint, txHash: string) {
    await payment.update({ status: 'confirmed', tx_hash: txHash })
    await this.authNonceRepository.recordSpend(s, amount)
    await this.playerRepository.markFirstSpend(payment.payer)
  }

  private async fail(payment: Awaited<ReturnType<OrderService['record']>>, e: unknown): Promise<never> {
    const msg = (e as any)?.shortMessage || (e as Error).message
    await payment.update({ status: 'failed', error: msg })
    throw new BadRequestException('Payment failed: ' + msg)
  }

  private async createRoom(dto: OrderCreateDTO) {
    const track = await this.catalogRepository.trackByTokenId(dto.trackId!)
    if (!track || track.status !== 'active') throw new BadRequestException('That track is not available yet')
    const recent = await this.paymentRepository.recentPrepared(dto.payer, 'create_room', 10 * 60_000)
    if (recent >= ROOMS_PER_10_MIN) throw new BadRequestException('Too many rooms created, wait a few minutes')
    const price = await chainPrice(KIND.create_room, BigInt(track.token_id!))
    const s = await this.session(dto.payer, price)
    const code = await this.newCode()
    const order = this.order(dto.payer, KIND.create_room, BigInt(track.token_id!), roomKeyOf(code), await this.templateOf(dto.payer), price)
    const label = `Room · ${track.name}`
    const payment = await this.record(dto, order, s, code, label)
    let opened
    try {
      opened = await relayer.createRoom(order, this.permitOf(s))
    } catch (e) {
      return this.fail(payment, e)
    }
    await this.settle(payment, s, price, opened.tx.hash)
    const room = await this.roomRepository.create({
      code,
      room_key: roomKeyOf(code),
      name: dto.roomName,
      host: dto.payer,
      track_id: track.id,
      max_ducks: dto.maxDucks,
      fill_bots: dto.fillBots,
      status: 'lobby',
      chain_room_id: String(opened.chainRoomId),
      create_tx: opened.tx.hash,
    })
    await this.addPlayerFromProfile(room.id, dto.payer, opened.tx.hash, TEMPLATE_NAME[order.template] ?? 'balanced')
    roomEvents.emit('room:changed', room.code)
    return { tx: opened.tx.hash, url: opened.tx.url, kind: dto.kind, label, amount: price.toString(), roomCode: code }
  }

  private async joinRoom(dto: OrderCreateDTO) {
    const room = await this.roomRepository.byCode(dto.roomCode!)
    if (!room || room.status === 'pending') throw new NotFoundException('Room not found')
    if (room.status === 'closed') throw new BadRequestException('This room is closed')
    if (room.status !== 'lobby') throw new BadRequestException('This race already started')
    if (room.host === dto.payer || (await this.roomRepository.player(room.id, dto.payer))) return { alreadyIn: true, roomCode: room.code }
    if ((await this.roomRepository.countPlayers(room.id)) >= room.max_ducks) throw new BadRequestException('Room is full')
    if (!room.chain_room_id) throw new BadRequestException('This room has no on-chain id')
    const price = await chainPrice(KIND.join_room, 0n)
    const s = await this.session(dto.payer, price)
    const key = `${room.code}:${dto.payer}`
    if (this.inflight.has(key)) throw new ConflictException('Payment already pending')
    this.inflight.add(key)
    const label = `Ticket · ${room.code}`
    const order = this.order(dto.payer, KIND.join_room, 0n, room.room_key as Hex, await this.templateOf(dto.payer), price)
    const payment = await this.record(dto, order, s, room.code, label)
    let tx
    try {
      tx = await joinBatcher.submit(Number(room.chain_room_id), order, this.permitOf(s))
    } catch (e) {
      return this.fail(payment, e)
    } finally {
      this.inflight.delete(key)
    }
    await this.settle(payment, s, price, tx.hash)
    await this.addPlayerFromProfile(room.id, dto.payer, tx.hash, TEMPLATE_NAME[order.template] ?? 'balanced')
    roomEvents.emit('room:changed', room.code)
    return { tx: tx.hash, url: tx.url, kind: dto.kind, label, amount: price.toString(), roomCode: room.code }
  }

  private async buyPart(dto: OrderCreateDTO) {
    const part = await this.catalogRepository.partByTypeId(dto.partTypeId!)
    if (!part || part.status !== 'active') throw new BadRequestException('That part is not for sale')
    if (await this.duckRepository.ownsPart(dto.payer, part.type_id)) throw new BadRequestException('You already own that part')
    const price = await chainPrice(KIND.buy_part, BigInt(part.type_id))
    const s = await this.session(dto.payer, price)
    const label = `Part · ${part.name}`
    const order = this.order(dto.payer, KIND.buy_part, BigInt(part.type_id), `0x${'0'.repeat(64)}`, await this.templateOf(dto.payer), price)
    const payment = await this.record(dto, order, s, null, label)
    let bought
    try {
      bought = await relayer.buyPart(order, this.permitOf(s))
    } catch (e) {
      return this.fail(payment, e)
    }
    await this.settle(payment, s, price, bought.tx.hash)
    await this.duckRepository.addLicense({ address: dto.payer, type_id: part.type_id, token_id: bought.tokenId, tx_hash: bought.tx.hash })
    return { tx: bought.tx.hash, url: bought.tx.url, kind: dto.kind, label, amount: price.toString(), partTypeId: part.type_id, tokenId: bought.tokenId }
  }

  /** Snapshot the player's duck into the room. A brand-new player without a duck yet gets a placeholder
   *  that is replaced the moment they keep their duck (duck:updated). */
  private async addPlayerFromProfile(roomId: number, address: string, joinTx: string | null, template: 'balanced' | 'sprint' | 'tank') {
    const duck = await this.duckRepository.byAddress(address)
    await this.roomRepository.addPlayer({
      room_id: roomId,
      address,
      duck_name: duck?.name || 'New duck',
      template, // the template that was recorded on-chain with the order
      body_color: duck?.body_color || '#FFFFFF',
      bill_color: duck?.bill_color || '#FF9F1C',
      cosmetics: duck?.cosmetics || { hat: false, shades: false, scarf: false },
      part_type_id: null,
      join_tx: joinTx,
      joined_on_chain: true,
    })
  }
}
