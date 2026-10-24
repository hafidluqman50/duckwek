import { CatalogRepository } from '@Repositories/Catalog/CatalogRepository'
import { Track } from '@Models/Track'
import { PartType } from '@Models/PartType'

export interface PublicTrack {
  id: number | null
  slug: string
  name: string
  description: string
  rentPrice: string
  laps: number
  turns: number
  lengthM: number
  closed: boolean
  path: number[][]
  sectors: number[]
  profile: Track['profile']
  platform: boolean
  status: Track['status']
}

export interface PublicPart {
  typeId: number
  name: string
  rarity: string
  slot: string
  speed: number
  weight: number
  boost: number
  price: string
  platform: boolean
  status: PartType['status']
  fit: Record<string, number>
}

/** How well a part suits each track, 1..3 dots. Derived from the same profile the engine uses. */
export const fitFor = (p: { speed: number; weight: number; boost: number }, profile: Track['profile']): number => {
  const score = p.speed * profile.speed - p.weight * profile.weight + p.boost * 0.5 * profile.boost
  return score >= 1.8 ? 3 : score >= 0.6 ? 2 : 1
}

export class CatalogService {
  constructor(public catalogRepository: CatalogRepository) {}

  public toTrack(t: Track): PublicTrack {
    return {
      id: t.token_id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      rentPrice: String(t.rent_price),
      laps: t.laps,
      turns: t.turns,
      lengthM: t.length_m,
      closed: t.closed,
      path: t.path,
      sectors: t.sectors,
      profile: t.profile,
      platform: t.platform,
      status: t.status,
    }
  }

  public async tracks(): Promise<PublicTrack[]> {
    return (await this.catalogRepository.tracks()).map((t) => this.toTrack(t))
  }

  public async parts(): Promise<PublicPart[]> {
    const [parts, tracks] = await Promise.all([this.catalogRepository.parts(), this.catalogRepository.tracks()])
    const active = tracks.filter((t) => t.status === 'active')
    return parts.map((p) => ({
      typeId: p.type_id,
      name: p.name,
      rarity: p.rarity,
      slot: p.slot,
      speed: p.speed,
      weight: p.weight,
      boost: p.boost,
      price: String(p.price),
      platform: p.platform,
      status: p.status,
      fit: Object.fromEntries(active.map((t) => [t.slug, p.fit?.[t.slug] ?? fitFor(p, t.profile)])),
    }))
  }
}
