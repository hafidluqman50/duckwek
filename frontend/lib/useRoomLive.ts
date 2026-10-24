'use client'

import { useEffect, useRef, useState } from 'react'
import { watchRoom } from '@/http/realtime/socket'
import { fetchRoom } from '@/http/rooms/roomsApi'
import type { Grid, RaceResult, RoomState, Settled, Tick } from './types'

export type LivePhase = 'idle' | 'countdown' | 'race' | 'photo' | 'result'

export interface Hatched { address: string; tokenId: string; tx: string; url: string | null; name: string }

/** Everything a phone or the projector needs about one room, live over socket.io. */
export function useRoomLive(code: string | null, opts: { photoMs?: number } = {}) {
  const [room, setRoom] = useState<RoomState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [grid, setGrid] = useState<Grid | null>(null)
  const [tick, setTick] = useState<Tick | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [phase, setPhase] = useState<LivePhase>('idle')
  const [result, setResult] = useState<RaceResult | null>(null)
  const [settled, setSettled] = useState<Settled | null>(null)
  const [hatched, setHatched] = useState<Hatched[]>([])
  const [events, setEvents] = useState<{ id: number; text: string }[]>([])
  const [blockGap, setBlockGap] = useState<number | null>(null)
  const [cheers, setCheers] = useState<{ id: number; name: string }[]>([])
  const lastTickAt = useRef(0)
  const evId = useRef(0)
  const photoMs = opts.photoMs ?? 2600

  // A different room (or none) starts from a clean state, so a stale room never shows under the next screen.
  const [seenCode, setSeenCode] = useState(code)
  if (seenCode !== code) {
    setSeenCode(code)
    setRoom(null)
    setError(null)
    setGrid(null)
    setTick(null)
    setResult(null)
    setSettled(null)
    setHatched([])
    setEvents([])
    setCountdown(0)
    setPhase('idle')
  }

  useEffect(() => {
    if (!code) return
    let alive = true
    fetchRoom(code).then((r) => alive && setRoom(r)).catch((e) => alive && setError(e.message))
    const off = watchRoom(code, {
      'room:state': (s: RoomState) => setRoom(s),
      'room:error': (m: { message: string }) => setError(m.message),
      'race:grid': (g: Grid) => {
        setGrid(g)
        setTick(null)
        setResult(null)
        setSettled(null)
        setHatched([])
        setCountdown(g.countdown)
        setPhase(g.countdown > 0 ? 'countdown' : 'race')
      },
      'race:aborted': () => {
        setPhase('idle')
        setGrid(null)
        setCountdown(0)
      },
      'race:countdown': (m: { n: number }) => setCountdown(m.n),
      'race:go': () => {
        setCountdown(0)
        setPhase('race')
      },
      'race:tick': (t: Tick) => {
        const now = performance.now()
        if (lastTickAt.current) setBlockGap(Math.round(now - lastTickAt.current))
        lastTickAt.current = now
        setTick(t)
        setPhase((p) => (p === 'countdown' || p === 'idle' ? 'race' : p))
        if (t.ev?.length) {
          setEvents((list) => [...list.slice(-4), ...t.ev.map((e) => ({ id: ++evId.current, text: e.type === 'leader' ? `${e.name} takes the lead!` : e.type === 'boost' ? `${e.name} BOOST!` : e.name }))])
        }
      },
      'race:result': (r: RaceResult) => {
        setResult(r)
        setPhase('photo')
        setTimeout(() => setPhase((p) => (p === 'photo' ? 'result' : p)), photoMs)
      },
      'race:settled': (s: Settled) => setSettled(s),
      'duck:hatched': (h: Hatched) => setHatched((l) => [...l, h]),
      'race:cheer': (c: { name: string }) => setCheers((l) => [...l.slice(-11), { id: ++evId.current, name: c.name }]),
    })
    return () => {
      alive = false
      off()
    }
  }, [code, photoMs])

  const reset = () => {
    setPhase('idle')
    setResult(null)
    setSettled(null)
    setGrid(null)
    setTick(null)
  }

  return { room, error, grid, tick, countdown, phase, result, settled, hatched, events, blockGap, cheers, reset }
}
