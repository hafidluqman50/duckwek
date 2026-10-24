import { Race, RankRow } from '@Models/Race'
import { RaceTick } from '@Models/RaceTick'

export class RaceRepository {
  public async nextRaceId(roomId: number): Promise<number> {
    return (await Race.count({ where: { room_id: roomId } })) + 1
  }

  public async create(data: { room_id: number; race_id: string; seed: string; start_block: string; start_tx?: string | null }): Promise<Race> {
    return Race.create(data as any)
  }

  public async finish(race: Race, data: { end_block: string; ranking: RankRow[]; podium: string[]; results_root: string; cheers: Record<string, Record<string, number>>; cheers_root: string; status: Race['status'] }): Promise<Race> {
    return race.update(data)
  }

  /** Written after the tick transaction has finished: the chain is first, the database follows. */
  public async addTick(row: { room_id: number; race_id: string; seq: number; step: number; blk: string; positions: string; tx_hash: string | null; included_block: string | null; status: string; gas_limit: number; submit_to_receipt_ms: number }): Promise<RaceTick> {
    return RaceTick.create(row as any)
  }
}
