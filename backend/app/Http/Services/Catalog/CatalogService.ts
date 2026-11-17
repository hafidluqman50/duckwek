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
  layoutVersion: number
  holder: string | null
  path: number[][]
  sectors: number[]
  profile: Track['profile']
  platform: boolean
  status: Track['status']
}

export interface PublicPart {
  typeId: number
  name: string
  slot: string
  speed: number
  weight: number
  boost: number
  color: string
  stats: Record<string, number>
  price: string
  creator: string
  platform: boolean
  status: PartType['status']
  fit: Record<string, number>
}

export const fitFor = (part: { speed: number; weight: number; boost: number }, profile: Track['profile']): number => {
  const score = part.speed * profile.speed - part.weight * profile.weight + part.boost * 0.5 * profile.boost

  return score >= 1.8 ? 3 : score >= 0.6 ? 2 : 1
}

export class CatalogService {
  constructor(public catalogRepository: CatalogRepository) {}

  public toTrack(track: Track): PublicTrack {
    return {
      id: track.token_id,
      slug: track.slug,
      name: track.name,
      description: track.description,
      rentPrice: String(track.rent_price),
      laps: track.laps,
      turns: track.turns,
      lengthM: track.length_m,
      closed: track.closed,
      layoutVersion: track.layout_version,
      holder: track.holder,
      path: track.path,
      sectors: track.sectors,
      profile: track.profile,
      platform: track.platform,
      status: track.status,
    }
  }

  public async tracks(): Promise<PublicTrack[]> {
    return (await this.catalogRepository.tracks()).map((track) => this.toTrack(track))
  }

  public async parts(): Promise<PublicPart[]> {
    const [parts, tracks] = await Promise.all([this.catalogRepository.parts(), this.catalogRepository.tracks()])
    const active = tracks.filter((track) => track.status === 'active')

    return parts.map((part) => ({
      typeId: part.type_id,
      name: part.name,
      slot: part.slot,
      speed: part.speed,
      weight: part.weight,
      boost: part.boost,
      color: '#' + part.color.toString(16).padStart(6, '0').toUpperCase(),
      stats: part.stats,
      price: String(part.price),
      creator: part.creator,
      platform: part.platform,
      status: part.status,
      fit: Object.fromEntries(active.map((track) => [track.slug, part.fit?.[track.slug] ?? fitFor(part, track.profile)])),
    }))
  }
}
