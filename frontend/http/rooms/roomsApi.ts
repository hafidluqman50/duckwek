import { api } from '@/http/client'
import type { RoomState } from '@/lib/types'

export const fetchRoom = (code: string) => api<RoomState>(`/api/rooms/${code.toUpperCase()}`, { auth: false })
export const setLoadout = (code: string, partTypeId: number | null) => api(`/api/rooms/${code}/loadout`, { method: 'PUT', body: { partTypeId } })
export const startRace = (code: string) => api<{ raceId: number; field: number }>(`/api/rooms/${code}/start`, { method: 'POST' })
