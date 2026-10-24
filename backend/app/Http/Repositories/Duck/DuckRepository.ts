import { Duck } from '@Models/Duck'
import { Title } from '@Models/Title'
import { PartLicense } from '@Models/PartLicense'

export class DuckRepository {
  public async byAddress(address: string): Promise<Duck | null> {
    return Duck.findOne({ where: { address } })
  }

  public async upsert(address: string, data: Partial<Duck>): Promise<Duck> {
    const existing = await this.byAddress(address)
    if (existing) return existing.update(data)
    return Duck.create({ address, ...(data as any) })
  }

  public async titles(address: string): Promise<Title[]> {
    return Title.findAll({ where: { address }, order: [['id', 'DESC']], limit: 50 })
  }

  public async addTitle(row: { address: string; room_code: string; race_id: string; rank: number; title: string; tx_hash: string | null }): Promise<Title> {
    return Title.create(row)
  }

  public async licenses(address: string): Promise<PartLicense[]> {
    return PartLicense.findAll({ where: { address }, order: [['id', 'ASC']] })
  }

  public async ownsPart(address: string, typeId: number): Promise<boolean> {
    return (await PartLicense.count({ where: { address, type_id: typeId } })) > 0
  }

  public async addLicense(row: { address: string; type_id: number; token_id: string; tx_hash: string }): Promise<PartLicense> {
    return PartLicense.create(row)
  }
}
