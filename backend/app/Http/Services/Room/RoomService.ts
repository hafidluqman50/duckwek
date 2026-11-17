import { RoomRepository } from '@Repositories/Room/RoomRepository'
import { DuckRepository } from '@Repositories/Duck/DuckRepository'
import { CatalogService, PublicTrack } from '@Services/Catalog/CatalogService'
import { LoadoutDTO } from '@DTOs/LoadoutDTO'
import { NotFoundException } from '@Exceptions/NotFoundException'
import { ForbiddenException } from '@Exceptions/ForbiddenException'
import { ConflictException } from '@Exceptions/ConflictException'
import { Room } from '@Models/Room'
import { roomEvents } from './RoomEvents'

export interface PublicPlayer {
  address: string
  name: string
  template: string
  bodyColor: string
  billColor: string
  cosmetics: { hat: boolean; shades: boolean; scarf: boolean }
  partTypeId: number | null
  host: boolean
}

export interface RoomState {
  code: string
  name: string
  host: string
  hostName: string
  track: PublicTrack
  maxDucks: number
  fillBots: boolean
  status: string
  players: PublicPlayer[]
  count: number
}

export class RoomService {
  constructor(
    public roomRepository: RoomRepository,
    public duckRepository: DuckRepository,
    public catalogService: CatalogService,
  ) {}

  public async mustGet(code: string): Promise<Room> {
    const room = await this.roomRepository.byCode(code.toUpperCase())
    if (!room || room.status === 'pending') throw new NotFoundException('Room not found')
    return room
  }

  public async state(code: string, liveStatus?: string): Promise<RoomState> {
    const room = await this.mustGet(code)
    const players = await this.roomRepository.players(room.id)
    const host = players.find((p) => p.address === room.host)
    return {
      code: room.code,
      name: room.name,
      host: room.host,
      hostName: host?.duck_name || room.host.slice(0, 6),
      track: this.catalogService.toTrack(room.track!),
      maxDucks: room.max_ducks,
      fillBots: room.fill_bots,
      status: liveStatus || room.status,
      players: players.map((p) => ({
        address: p.address,
        name: p.duck_name,
        template: p.template,
        bodyColor: p.body_color,
        billColor: p.bill_color,
        cosmetics: p.cosmetics,
        partTypeId: p.part_type_id,
        host: p.address === room.host,
      })),
      count: players.length,
    }
  }

  /**
   * The loadout is committed on chain with the join order (plan 0013 §4.3) and fixes what the race uses, so it cannot change after
   * joining. The part is chosen before joining (the equipped part of the duck profile).
   */
  public async setLoadout(dto: LoadoutDTO): Promise<void> {
    const room = await this.mustGet(dto.roomCode)
    const player = await this.roomRepository.player(room.id, dto.address)
    if (!player) throw new ForbiddenException('Join the room first')
    throw new ConflictException('Your loadout was committed on chain when you joined. Equip a part before joining a room.')
  }

  /** Called when a duck profile changes: refresh the snapshot in rooms that are still in the lobby. */
  public async refreshDuckInRooms(address: string): Promise<string[]> {
    const duck = await this.duckRepository.byAddress(address)
    if (!duck) return []
    const { RoomPlayer } = await import('@Models/RoomPlayer')
    const rows = await RoomPlayer.findAll({ where: { address }, include: [{ model: Room, as: 'room' }] })
    const codes: string[] = []
    for (const rp of rows) {
      const room = (rp as any).room as Room | undefined
      if (!room || room.status !== 'lobby') continue
      // Only the looks follow the profile: the template and the part were committed on chain at join and stay as they were.
      await rp.update({ duck_name: duck.name, body_color: duck.body_color, bill_color: duck.bill_color, cosmetics: duck.cosmetics })
      codes.push(room.code)
    }
    return codes
  }
}
