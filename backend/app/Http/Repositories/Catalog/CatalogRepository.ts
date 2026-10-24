import { Track } from '@Models/Track'
import { PartType } from '@Models/PartType'

export class CatalogRepository {
  public async tracks(): Promise<Track[]> {
    return Track.findAll({ order: [['id', 'ASC']] })
  }

  public async trackByTokenId(tokenId: number): Promise<Track | null> {
    return Track.findOne({ where: { token_id: tokenId } })
  }

  public async trackById(id: number): Promise<Track | null> {
    return Track.findByPk(id)
  }

  public async parts(): Promise<PartType[]> {
    return PartType.findAll({ order: [['type_id', 'ASC']] })
  }

  public async partByTypeId(typeId: number): Promise<PartType | null> {
    return PartType.findOne({ where: { type_id: typeId } })
  }
}
