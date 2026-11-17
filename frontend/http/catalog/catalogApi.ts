import { api } from '@/http/client'
import type { Part, Track } from '@/lib/types'
import { registerParts } from '@/components/duck/DuckSvg'

export const fetchTracks = () => api<Track[]>('/api/catalog/tracks', { auth: false })
export const fetchParts = () => api<Part[]>('/api/catalog/parts', { auth: false }).then((parts) => (registerParts(parts), parts))
