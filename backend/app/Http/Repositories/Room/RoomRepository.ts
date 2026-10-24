import { Room } from '@Models/Room'
import { RoomPlayer } from '@Models/RoomPlayer'
import { Track } from '@Models/Track'

export class RoomRepository {
  public async byCode(code: string): Promise<Room | null> {
    return Room.findOne({ where: { code }, include: [{ model: Track, as: 'track' }] })
  }

  public async codeTaken(code: string): Promise<boolean> {
    return (await Room.count({ where: { code } })) > 0
  }

  public async create(data: { code: string; room_key: string; name: string; host: string; track_id: number; max_ducks: number; fill_bots: boolean; status: Room['status']; chain_room_id?: string | null; create_tx?: string | null }): Promise<Room> {
    return Room.create(data as any)
  }

  public async players(roomId: number): Promise<RoomPlayer[]> {
    return RoomPlayer.findAll({ where: { room_id: roomId }, order: [['id', 'ASC']] })
  }

  public async player(roomId: number, address: string): Promise<RoomPlayer | null> {
    return RoomPlayer.findOne({ where: { room_id: roomId, address } })
  }

  public async addPlayer(data: Partial<RoomPlayer> & { room_id: number; address: string; duck_name: string }): Promise<RoomPlayer> {
    const existing = await this.player(data.room_id, data.address)
    if (existing) return existing.update(data)
    return RoomPlayer.create(data as any)
  }

  public async countPlayers(roomId: number): Promise<number> {
    return RoomPlayer.count({ where: { room_id: roomId } })
  }
}
