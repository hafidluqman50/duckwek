'use client'

import { useEffect, useRef, useState } from 'react'
import { watchRoom } from '@/http/realtime/socket'
import { fetchRoom } from '@/http/rooms/roomsApi'
import type { Grid, RaceResult, RoomState, Settled, Tick } from './types'

export type LivePhase = 'idle' | 'countdown' | 'race' | 'photo' | 'result'

export interface Hatched { address: string }

export function useRoomLive(code: string | null, options: { photoMs?: number } = {}) {
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
  const eventCounter = useRef(0)
  const photoMs = options.photoMs ?? 2600

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

    fetchRoom(code).then((fetchedRoom) => alive && setRoom(fetchedRoom)).catch((failure) => alive && setError(failure.message))

    const unsubscribe = watchRoom(code, {
      'room:state': (roomState: RoomState) => setRoom(roomState),
      'room:error': (payload: { message: string }) => setError(payload.message),
      'race:grid': (nextGrid: Grid) => {
        setGrid(nextGrid)
        setTick(null)
        setResult(null)
        setSettled(null)
        setHatched([])
        setCountdown(nextGrid.countdown)
        setPhase(nextGrid.countdown > 0 ? 'countdown' : 'race')
      },
      'race:aborted': () => {
        setPhase('idle')
        setGrid(null)
        setCountdown(0)
      },
      'race:countdown': (payload: { n: number }) => setCountdown(payload.n),
      'race:go': () => {
        setCountdown(0)
        setPhase('race')
      },
      'race:tick': (nextTick: Tick) => {
        const now = performance.now()

        if (lastTickAt.current) setBlockGap(Math.round(now - lastTickAt.current))

        lastTickAt.current = now
        setTick(nextTick)
        setPhase((current) => (current === 'countdown' || current === 'idle' ? 'race' : current))

        if (nextTick.ev?.length) {
          setEvents((list) => [...list.slice(-4), ...nextTick.ev.map((raceEvent) => ({ id: ++eventCounter.current, text: raceEvent.type === 'leader' ? `${raceEvent.name} takes the lead!` : raceEvent.type === 'boost' ? `${raceEvent.name} BOOST!` : raceEvent.name }))])
        }
      },
      'race:result': (raceResult: RaceResult) => {
        setResult(raceResult)
        setPhase('photo')
        setTimeout(() => setPhase((current) => (current === 'photo' ? 'result' : current)), photoMs)
      },
      'race:settled': (nextSettled: Settled) => setSettled(nextSettled),
      'duck:hatched': (hatchedDuck: Hatched) => setHatched((list) => [...list, hatchedDuck]),
      'race:cheer': (cheer: { name: string }) => setCheers((list) => [...list.slice(-11), { id: ++eventCounter.current, name: cheer.name }]),
    })

    return () => {
      alive = false
      unsubscribe()
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
