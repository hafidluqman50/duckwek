'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { useRoomLive } from '@/lib/useRoomLive'
import { buildTrackGeometry, pointAtFraction, pathFractionAt, TURNS, type TrackGeo } from '@/lib/track'
import type { GridEntrant } from '@/lib/types'
import { DuckSvg, MiniDuck } from '@/components/duck/DuckSvg'
import { sound } from '@/lib/sound'
import { APP_URL } from '@/lib/config'
import { SoundButton } from '@/components/play/Shell'
import { spriteForColor } from '@/components/stage/sprites'
import { MotoGrid, GridMinimap, needsGridFlyover } from '@/components/stage/MotoGrid'

const STAGE_WIDTH = 1920, STAGE_HEIGHT = 1080
const DISPLAY = "'Lilita One', sans-serif"
const MONO = "'JetBrains Mono', monospace"
const CHECKER = 'repeating-conic-gradient(#ffffff 0 25%, #000000 0 50%)'

function useFitScale() {
  const [scale, setScale] = useState(0.5)

  useEffect(() => {
    const updateScale = () => setScale(Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT))
    updateScale()
    window.addEventListener('resize', updateScale)

    return () => window.removeEventListener('resize', updateScale)
  }, [])

  return scale
}

const CONFETTI_COLORS = ['#FFC93C', '#ffffff', '#FF7AB6', '#4ED1C5', '#1E1446', '#B8F35A']
const CONFETTI = Array.from({ length: 30 }, (_, index) => ({ left: (index * 263) % 1900, width: 18 + (index % 3) * 10, color: CONFETTI_COLORS[index % CONFETTI_COLORS.length], duration: (2.6 + (index % 5) * 0.5).toFixed(1), delay: ((index * 0.37) % 3).toFixed(2) }))
const RAYS = Array.from({ length: 16 }, (_, index) => {
  const startAngle = (index / 16) * Math.PI * 2, endAngle = startAngle + Math.PI / 16

  return `M960 420 L${Math.round(960 + 2200 * Math.cos(startAngle))} ${Math.round(420 + 2200 * Math.sin(startAngle))} L${Math.round(960 + 2200 * Math.cos(endAngle))} ${Math.round(420 + 2200 * Math.sin(endAngle))} Z`
}).join(' ')
const LETTERS_FIRST_LINE = 'ABSOLUTE'.split('').map((character, index) => ({ character, popDelay: (0.35 + index * 0.07).toFixed(2), waveDelay: (1.2 + index * 0.09).toFixed(2) }))
const LETTERS_SECOND_LINE = 'MARVELOUS'.split('').map((character, index) => ({ character, popDelay: (0.95 + index * 0.07).toFixed(2), waveDelay: (1.9 + index * 0.09).toFixed(2) }))
const PHOTO_SPECS = [{ width: 460, top: 340, beak: 1135 }, { width: 380, top: 180, beak: 1060 }, { width: 300, top: 40, beak: 980 }]
const PODIUM = { height: [230, 150, 100], duckWidth: [220, 150, 130], delay: [1.5, 1.7, 1.9], bob: [0.9, 1.3, 1.5] }

const pill = (background: string, color: string): React.CSSProperties => ({ padding: '3px 10px', border: '3px solid #000000', borderRadius: 999, fontSize: 18, fontWeight: 800, background, color })
const letterStyle = (color: string, shadow: number): React.CSSProperties => ({ display: 'inline-block', fontFamily: DISPLAY, fontSize: 190, lineHeight: 0.95, color, WebkitTextStroke: '10px #000000', paintOrder: 'stroke fill', textShadow: `0 ${shadow}px 0 #000000` })

const LAG_STEPS = 3
const STEP_MS = 300
const KEPT_SAMPLES = 14

interface Sample { step: number; positions: Float64Array }

function RaceLayer({ geometry, entrants, positions, step, energies, isCrowded, topThree }: { geometry: TrackGeo; entrants: GridEntrant[]; positions: number[]; step: number; energies: number[]; isCrowded: boolean; topThree: { index: number; label: string }[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const tagElements = useRef(new Map<number, HTMLDivElement>())
  const playback = useRef({ samples: [] as Sample[], position: 0, stepMs: STEP_MS, receivedAt: 0 })
  const energyRef = useRef<number[]>([])
  const duckWidth = isCrowded ? 30 : 38

  useEffect(() => {
    energyRef.current = energies
  }, [energies])

  useEffect(() => {
    const state = playback.current
    const now = performance.now()
    const last = state.samples[state.samples.length - 1]

    if (last && step <= last.step) return

    if (!last) state.position = Math.max(0, step - LAG_STEPS)
    else {
      const gap = (now - state.receivedAt) / (step - last.step)

      if (gap > 80 && gap < 1500) state.stepMs = state.stepMs * 0.7 + gap * 0.3
    }

    state.samples.push({ step, positions: Float64Array.from(positions) })

    if (state.samples.length > KEPT_SAMPLES) state.samples.shift()

    state.receivedAt = now
  }, [positions, step])

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) return

    const context = canvas.getContext('2d')!
    let animationFrame = 0
    let previousFrameAt = performance.now()
    let pixelsPerDesignPixel = 1

    const fitCanvas = () => {
      const bounds = canvas.getBoundingClientRect()
      pixelsPerDesignPixel = Math.max(0.25, (bounds.width / STAGE_WIDTH) * (window.devicePixelRatio || 1))
      canvas.width = Math.round(STAGE_WIDTH * pixelsPerDesignPixel)
      canvas.height = Math.round(STAGE_HEIGHT * pixelsPerDesignPixel)
    }

    fitCanvas()
    const resizeObserver = new ResizeObserver(fitCanvas)
    resizeObserver.observe(canvas)
    const items: { x: number; y: number; flip: boolean; color: string; boosted: boolean; phase: number }[] = entrants.map((entrant, entrantIndex) => ({ x: 0, y: 0, flip: false, color: entrant.color, boosted: false, phase: (entrantIndex * 37) % 45 / 100 }))

    const frame = (now: number) => {
      const state = playback.current
      const elapsed = Math.min(100, now - previousFrameAt)
      previousFrameAt = now
      const samples = state.samples

      if (samples.length) {
        const latest = samples[samples.length - 1].step
        const speed = 1 + Math.max(-0.5, Math.min(0.35, (latest - LAG_STEPS - state.position) * 0.3))
        state.position = Math.min(latest, state.position + (elapsed / state.stepMs) * speed)
        let upperIndex = samples.length - 1

        while (upperIndex > 0 && samples[upperIndex - 1].step >= state.position) upperIndex--

        const upper = samples[upperIndex]
        const lower = upperIndex > 0 ? samples[upperIndex - 1] : null
        const fraction = lower ? (state.position - lower.step) / (upper.step - lower.step) : upper.step > 0 ? state.position / upper.step : 1
        const currentEnergies = energyRef.current

        entrants.forEach((entrant, itemIndex) => {
          const gridIndex = entrant.i

          if (gridIndex >= upper.positions.length) return

          const from = lower ? lower.positions[gridIndex] : 0
          const progress = from + (upper.positions[gridIndex] - from) * Math.max(0, Math.min(1, fraction))
          const lateral = entrant.human ? ((gridIndex * 29) % 30) - 15 : ((gridIndex * 53) % 70) - 35
          const point = pointAtFraction(geometry, pathFractionAt(geometry, progress / 10000), lateral)
          const item = items[itemIndex]
          item.x = point.x
          item.y = point.y
          item.flip = point.dx < 0
          item.boosted = entrant.human && (currentEnergies[gridIndex] ?? 0) > 25
          const tagElement = tagElements.current.get(gridIndex)

          if (tagElement) tagElement.style.transform = `translate3d(${(point.x - 30).toFixed(1)}px, ${(point.y - duckWidth * 0.62 - 42).toFixed(1)}px, 0)`
        })
      }

      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      const drawOrder = items.map((_, itemIndex) => itemIndex).sort((first, second) => items[first].y - items[second].y)

      for (const itemIndex of drawOrder) {
        const item = items[itemIndex]

        if (item.x === 0 && item.y === 0) continue

        const size = item.boosted ? duckWidth * 1.45 : duckWidth
        const bob = Math.sin((now / 1000 + item.phase) * Math.PI * 2 / 0.45)
        context.setTransform(pixelsPerDesignPixel, 0, 0, pixelsPerDesignPixel, 0, 0)
        context.translate(item.x, item.y - bob * 2)
        context.rotate((bob * 4 * Math.PI) / 180)

        if (item.flip) context.scale(-1, 1)

        if (item.boosted) {
          context.shadowColor = '#FFC93C'
          context.shadowBlur = 18 * pixelsPerDesignPixel
        } else context.shadowBlur = 0

        context.drawImage(spriteForColor(item.color), -size / 2, -size * 0.62, size, size * (100 / 120))
      }

      animationFrame = requestAnimationFrame(frame)
    }

    animationFrame = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
    }
  }, [geometry, entrants, duckWidth])

  const offScreen = 'translate3d(-300px, -300px, 0)'

  return (
    <>
      <canvas ref={canvasRef} data-ducks aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: STAGE_WIDTH, height: STAGE_HEIGHT }} />
      {topThree.map((leader) => (
        <div key={'t' + leader.index} ref={(element) => { if (element) tagElements.current.set(leader.index, element); else tagElements.current.delete(leader.index) }} style={{ position: 'absolute', left: 0, top: 0, zIndex: 2000, padding: '4px 12px', border: '4px solid #000000', borderRadius: 999, fontSize: 20, fontWeight: 900, whiteSpace: 'nowrap', background: '#ffffff', color: '#1E1446', transform: offScreen, willChange: 'transform' }}>{leader.label}</div>
      ))}
    </>
  )
}

export function StagePage({ code }: { code: string }) {
  const scale = useFitScale()
  const live = useRoomLive(code, { photoMs: 3200 })
  const { room, grid, tick, phase, result, settled, countdown } = live
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [armed, setArmed] = useState(false)
  const [photoGo, setPhotoGo] = useState(false)
  const cameraRef = useRef<HTMLDivElement | null>(null)
  const joinUrl = `${APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/join/${code}`

  useEffect(() => {
    QRCode.toDataURL(joinUrl, { margin: 1, width: 420, color: { dark: '#1E1446', light: '#ffffff' } }).then(setQrDataUrl).catch(() => undefined)
  }, [joinUrl])

  const geometry = useMemo(() => (room ? buildTrackGeometry(room.track.path, room.track.closed, room.track.laps, TURNS[room.track.slug] || []) : null), [room])

  useEffect(() => {
    sound.setVolume(0.9)
  }, [])

  useEffect(() => {
    sound.music(phase === 'race' ? 'race' : phase === 'idle' ? 'lobby' : null)
  }, [phase, armed])

  useEffect(() => {
    if (phase === 'countdown') sound.play(countdown > 0 ? 'beep' : 'go')
  }, [phase, countdown])

  const previousPhase = useRef(phase)

  useEffect(() => {
    if (previousPhase.current === 'countdown' && phase === 'race') sound.play('go')

    if (phase === 'photo') sound.play('shutter')

    if (phase === 'result') {
      sound.play('fanfare')
      sound.play('crowd')
    }

    previousPhase.current = phase
  }, [phase])

  useEffect(() => {
    if (tick && tick.b % 2 === 0) sound.play('splash')
  }, [tick])

  useEffect(() => {
    if (phase !== 'result') return

    const resetTimeout = setTimeout(() => live.reset(), 25_000)

    return () => clearTimeout(resetTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    if (phase !== 'photo') return

    const slideTimeout = setTimeout(() => setPhotoGo(true), 80)

    return () => {
      clearTimeout(slideTimeout)
      setPhotoGo(false)
    }
  }, [phase])

  const playersRef = useRef(0)

  useEffect(() => {
    if (room && room.count > playersRef.current && playersRef.current > 0) sound.play('join')

    if (room) playersRef.current = room.count
  }, [room])

  if (!room || !geometry) {
    return (
      <main style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1E1446', color: '#fff', fontFamily: DISPLAY, fontSize: 40 }}>
        {live.error ? `${code}: ${live.error}` : 'Loading stage…'}
      </main>
    )
  }

  const trackName = room.track.name.toUpperCase()
  const lapsLabel = `${room.track.laps} ${room.track.laps > 1 ? 'LAPS' : 'LAP'}`
  const trackMeta = `${(room.track.lengthM / 1000).toFixed(1)} km · ${room.track.turns} turns · ${room.track.laps} ${room.track.laps > 1 ? 'laps' : 'lap'}`
  const entrants = grid?.entrants || []
  const positions = tick?.p || entrants.map(() => 0)
  const standings = positions.map((progress, index) => ({ index, progress })).sort((first, second) => second.progress - first.progress)
  const leadProgress = standings[0]?.progress ?? 0
  const currentLap = Math.min(room.track.laps, Math.floor(Math.min(leadProgress / 10000, 1) * room.track.laps) + 1)
  const isCrowded = entrants.length > 100
  const finish = (() => {
    const point = pointAtFraction(geometry, geometry.closed ? 0 : 0.96, 0)

    return { x: Math.round(point.x - 15), y: Math.round(point.y - 75), angle: Math.round(Math.atan2(point.dy, point.dx) * 180 / Math.PI) }
  })()
  const rankingRows = result?.ranking || []
  const minted = !!settled?.ok

  return (
    <main onPointerDown={() => { sound.unlock(); setArmed(true) }} style={{ height: '100dvh', overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'center', flex: 'none', overflow: 'hidden', background: '#1E1446', color: '#fff', fontFamily: 'var(--font-sans)' }}>
        <div style={{ position: 'absolute', right: 24, bottom: 24, zIndex: 5000, display: 'flex', alignItems: 'center', gap: 10 }}>
          {!armed && <span style={{ fontSize: 18, fontWeight: 800, color: '#C9B8FF' }}>click once to enable sound</span>}
          <SoundButton dark />
        </div>

        {phase === 'idle' && (
          <div style={{ position: 'absolute', inset: 0, background: '#1E1446' }}>
            <div aria-hidden style={{ position: 'absolute', right: -260, top: 120, width: 1100, height: 1100, borderRadius: '50%', background: '#836EF9', animation: 'dwPulse 4s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', left: 110, top: 70, width: 1040, display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <span style={{ padding: '10px 22px', borderRadius: 999, background: '#FFC93C', color: '#1E1446', border: '4px solid #000000', fontFamily: MONO, fontSize: 34, fontWeight: 700 }}>{code}</span>
                <span style={{ fontSize: 30, fontWeight: 800, color: '#C9B8FF' }}>hosted by {room.hostName}</span>
              </div>
              <div style={{ fontFamily: DISPLAY, fontSize: 110, lineHeight: 0.92, color: '#ffffff', textShadow: '0 10px 0 #836EF9' }}>{room.name}</div>
              <div style={{ display: 'flex', gap: 22, alignItems: 'stretch' }}>
                <div style={{ flex: 1, background: '#2A1D5E', border: '5px solid #000000', borderRadius: 32, boxShadow: '0 10px 0 #000000', padding: '20px 28px', display: 'flex', gap: 22, alignItems: 'center' }}>
                  <svg viewBox="-60 40 1800 960" width="300" height="160" aria-hidden>
                    <path d={geometry.d} fill="none" stroke="#000000" strokeWidth="90" strokeLinecap="round" strokeLinejoin="round" />
                    <path d={geometry.d} fill="none" stroke="#836EF9" strokeWidth="66" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 3, color: '#C9B8FF' }}>TRACK</div>
                    <div style={{ fontFamily: DISPLAY, fontSize: 56, lineHeight: 1, color: '#FFC93C' }}>{room.track.name}</div>
                    <div style={{ fontSize: 24, fontWeight: 800 }}>{trackMeta}</div>
                  </div>
                </div>
                <div style={{ width: 260, background: '#FFC93C', color: '#1E1446', border: '5px solid #000000', borderRadius: 32, boxShadow: '0 10px 0 #000000', padding: '20px 26px' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 3 }}>RACERS</div>
                  <div style={{ fontFamily: DISPLAY, fontSize: 100, lineHeight: 1 }}>{room.count}</div>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>of {room.maxDucks}</div>
                </div>
              </div>
            </div>
            <div style={{ position: 'absolute', left: 1260, top: 110, width: 540, display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'dwFloatR 3s ease-in-out infinite' }}>
              <div style={{ background: '#FFC93C', color: '#1E1446', fontFamily: DISPLAY, fontSize: 50, padding: '10px 36px 16px', border: '6px solid #000000', borderBottom: 'none', borderRadius: '28px 28px 0 0' }}>SCAN · HATCH · RACE</div>
              <div style={{ background: '#ffffff', border: '6px solid #000000', borderRadius: 32, boxShadow: '0 16px 0 #000000', padding: 28 }}>
                {qrDataUrl ? <img src={qrDataUrl} width={420} height={420} alt={`QR code to join ${code}`} style={{ display: 'block' }} /> : <div style={{ width: 420, height: 420 }} />}
              </div>
              <div style={{ marginTop: 22, fontFamily: MONO, fontSize: 22, fontWeight: 700, color: '#1E1446', whiteSpace: 'nowrap' }}>{joinUrl.replace(/^https?:\/\//, '')}</div>
            </div>
            <div style={{ position: 'absolute', left: 110, bottom: 56, width: 1700, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 3, color: '#C9B8FF' }}>DUCKS IN THE ROOM</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, overflow: 'hidden' }}>
                {room.players.slice(-12).map((player, index) => (
                  <div key={player.address} style={{ flex: 'none', animation: 'dwChip .45s cubic-bezier(.2,1.4,.4,1) both', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 120 }}>
                    <div style={{ animation: `dwBob 1.3s ease-in-out ${((index * 0.13) % 1).toFixed(2)}s infinite` }}><DuckSvg {...player} width={96} /></div>
                    <div style={{ ...pill(player.host ? '#FFC93C' : '#2A1D5E', player.host ? '#1E1446' : '#ffffff'), maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {phase === 'countdown' && grid && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <div style={{ position: 'absolute', left: 110, top: 44 }}>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 4, color: '#C9B8FF' }}>{code} · {trackName} · {lapsLabel} · {entrants.length} DUCKS</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 96, lineHeight: 1, color: '#FFC93C', textShadow: '0 8px 0 #836EF9' }}>STARTING GRID</div>
            </div>
            <div style={{ position: 'absolute', right: 110, top: 34, width: 160, height: 160, borderRadius: '50%', background: '#FFC93C', color: '#1E1446', border: '6px solid #000000', boxShadow: '0 10px 0 #000000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'dwPulse 1s ease-in-out infinite' }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>GO IN</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 96, lineHeight: 0.9 }}>{countdown}</div>
            </div>
            {needsGridFlyover(entrants.length) && (
              <div style={{ position: 'absolute', right: 300, top: 92, padding: '10px 22px', background: '#ffffff', color: '#1E1446', border: '5px solid #000000', borderRadius: 999, boxShadow: '0 6px 0 #000000', fontSize: 26, fontWeight: 900 }}>CAMERA · ROWS 1–8 → BACK OF THE GRID</div>
            )}
            <div style={{ position: 'absolute', left: 60, top: 230, width: 1800, height: 660, background: '#2A1D5E', border: '6px solid #000000', borderRadius: 40, boxShadow: '0 14px 0 #000000', overflow: 'hidden' }}>
              <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 26, background: 'repeating-linear-gradient(90deg, #F25F5C 0 60px, #ffffff 60px 120px)', borderBottom: '5px solid #000000' }} />
              <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 26, background: 'repeating-linear-gradient(90deg, #ffffff 0 60px, #F25F5C 60px 120px)', borderTop: '5px solid #000000' }} />
              <div aria-hidden style={{ position: 'absolute', left: 1630, top: 26, bottom: 26, width: 48, background: `${CHECKER} 0 0 / 24px 24px`, borderLeft: '5px solid #000000', borderRight: '5px solid #000000' }} />
              <div aria-hidden style={{ position: 'absolute', left: 1700, top: 300, transform: 'rotate(90deg)', transformOrigin: 'left top', fontFamily: DISPLAY, fontSize: 34, color: '#FFC93C', whiteSpace: 'nowrap' }}>START</div>
              <MotoGrid entrants={entrants} countdown={countdown} total={grid.countdown} cameraRef={cameraRef} />
            </div>
            {needsGridFlyover(entrants.length) && (
              <div style={{ position: 'absolute', left: 110, right: 110, top: 926 }}>
                <GridMinimap entrants={entrants} cameraRef={cameraRef} />
              </div>
            )}
          </div>
        )}

        {phase === 'race' && grid && (
          <div style={{ animation: 'dwShake .55s ease-out .05s both', position: 'absolute', inset: 0, background: '#241858' }}>
            <svg viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`} width={STAGE_WIDTH} height={STAGE_HEIGHT} style={{ position: 'absolute', left: 0, top: 0 }} aria-hidden>
              <path d={geometry.d} fill="none" stroke="#000000" strokeWidth="150" strokeLinecap="round" strokeLinejoin="round" />
              <path d={geometry.d} fill="none" stroke="#836EF9" strokeWidth="134" strokeLinecap="round" strokeLinejoin="round" />
              <path d={geometry.d} fill="none" stroke="#9D8CFB" strokeWidth="80" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
              <path d={geometry.d} fill="none" stroke="#ffffff" strokeWidth="4" strokeDasharray="26 44" opacity="0.5" style={{ animation: 'dwFlow 1s linear infinite' }} />
            </svg>
            <div aria-hidden style={{ position: 'absolute', left: finish.x, top: finish.y, width: 30, height: 150, transform: `rotate(${finish.angle}deg)`, background: `${CHECKER} 0 0 / 30px 30px`, border: '4px solid #000000' }} />
            {geometry.turns.map((turn) => (
              <div key={turn.n} aria-hidden style={{ position: 'absolute', left: Math.round(turn.x + 48), top: Math.round(turn.y - 72), width: 44, height: 44, borderRadius: '50%', background: '#1E1446', border: '3px solid #ffffff', color: '#ffffff', fontSize: 18, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{turn.n}</div>
            ))}
            <RaceLayer geometry={geometry} entrants={entrants} positions={positions} step={tick?.n ?? tick?.t ?? 0} energies={tick?.en ?? []} isCrowded={isCrowded} topThree={standings.slice(0, 3).map((standing, placeIndex) => ({ index: standing.index, label: `${placeIndex + 1} ${entrants[standing.index]?.name ?? ''}` }))} />
            <div style={{ position: 'absolute', left: 40, top: 30, zIndex: 3000, background: '#1E1446', border: '5px solid #000000', borderRadius: 28, boxShadow: '0 8px 0 #000000', padding: '16px 26px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 3, color: '#C9B8FF' }}>{code} · {trackName}</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 44, color: '#FFC93C' }}>LAP {currentLap} / {room.track.laps}</div>
              <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700 }}>BLOCK #{tick?.b?.toLocaleString('en-US') ?? '—'}</div>
            </div>
            <div style={{ position: 'absolute', right: 40, top: 30, zIndex: 3000, width: 400, background: '#ffffff', color: '#1E1446', border: '5px solid #000000', borderRadius: 28, boxShadow: '0 8px 0 #000000', overflow: 'hidden' }}>
              <div style={{ background: '#FFC93C', borderBottom: '5px solid #000000', padding: '10px 22px', fontFamily: DISPLAY, fontSize: 34 }}>TOP 3</div>
              {standings.slice(0, 3).map((standing, placeIndex) => (
                <div key={standing.index} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 22px', borderBottom: '3px solid #E6E0FF' }}>
                  <div style={{ fontFamily: DISPLAY, fontSize: 36, width: 28 }}>{placeIndex + 1}</div>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', border: '4px solid #000000', background: entrants[standing.index]?.color }} />
                  <div style={{ flex: 1, fontSize: 24, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entrants[standing.index]?.name}</div>
                  <div style={{ fontFamily: MONO, fontSize: 18 }}>{placeIndex === 0 ? 'LEAD' : '+' + ((leadProgress - standing.progress) / 100).toFixed(1)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === 'photo' && result && (
          <div style={{ position: 'absolute', inset: 0, background: '#1E1446' }}>
            <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 50, background: '#ffffff', pointerEvents: 'none', animation: 'dwFlash .7s ease-out forwards' }} />
            <div style={{ position: 'absolute', left: 96, top: 40, fontFamily: DISPLAY, fontSize: 96, color: '#FFC93C', textShadow: '0 8px 0 #836EF9' }}>PHOTO FINISH</div>
            <div style={{ position: 'absolute', left: 96, top: 170, width: 1728, height: 780, background: '#836EF9', border: '8px solid #000000', borderRadius: 40, boxShadow: '0 16px 0 #000000', overflow: 'hidden' }}>
              <div aria-hidden style={{ position: 'absolute', left: 1060, top: 0, width: 56, height: 780, background: `${CHECKER} 0 0 / 56px 56px`, borderLeft: '6px solid #000000', borderRight: '6px solid #000000' }} />
              {[2, 1, 0].map((slotIndex) => {
                const row = rankingRows[slotIndex]

                if (!row) return null

                const spec = PHOTO_SPECS[slotIndex]
                const left = spec.beak - spec.width * 0.99

                return (
                  <div key={row.rank} style={{ position: 'absolute', left: Math.round(photoGo ? left : left - 900), top: spec.top, width: spec.width, transition: 'left 1.6s cubic-bezier(.2,.7,.3,1)' }}>
                    <MiniDuck color={row.color} width="100%" stroke={4} eye={3.5} style={{ animation: 'dwBob 1.8s ease-in-out infinite' }} />
                    <div style={{ position: 'absolute', right: '100%', top: '48%', marginRight: 12, padding: '6px 16px', color: '#1E1446', border: '4px solid #000000', borderRadius: 999, fontSize: 26, fontWeight: 900, whiteSpace: 'nowrap', background: slotIndex === 0 ? '#FFC93C' : '#ffffff' }}>{slotIndex + 1} · {row.name}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {phase === 'result' && result && (
          <div style={{ animation: 'dwShake .6s ease-out 1.25s both', position: 'absolute', inset: 0, background: '#836EF9', color: '#1E1446' }}>
            <svg viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`} width={STAGE_WIDTH} height={STAGE_HEIGHT} style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '960px 420px', animation: 'dwSpin 24s linear infinite' }} aria-hidden>
              <path d={RAYS} fill="#9682FA" />
            </svg>
            <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 50, background: '#ffffff', pointerEvents: 'none', animation: 'dwFlash .6s ease-out forwards' }} />
            {CONFETTI.map((piece, index) => (
              <div key={index} aria-hidden style={{ position: 'absolute', left: piece.left, top: 0, zIndex: 10, width: piece.width, height: 16, background: piece.color, border: '3px solid #000000', animation: `dwFall ${piece.duration}s linear ${piece.delay}s infinite both` }} />
            ))}
            <div style={{ position: 'absolute', left: 0, top: 52, width: 1920, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 20 }}>
              <div style={{ padding: '10px 28px', background: '#1E1446', color: '#ffffff', borderRadius: 999, fontSize: 28, fontWeight: 900, letterSpacing: 4 }}>{code} · {trackName} · {(rankingRows[0]?.name || '').toUpperCase()}</div>
              <div role="heading" aria-level={1} aria-label="Absolute Marvelous" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'rotate(-2deg)' }}>
                <div style={{ display: 'flex' }}>
                  {LETTERS_FIRST_LINE.map((letter, index) => <span key={index} aria-hidden style={{ display: 'inline-block', animation: `dwPop .55s cubic-bezier(.2,1.5,.4,1) ${letter.popDelay}s both` }}><span style={{ ...letterStyle('#FFC93C', 14), animation: `dwWave 1.4s ease-in-out ${letter.waveDelay}s infinite` }}>{letter.character}</span></span>)}
                </div>
                <div style={{ display: 'flex' }}>
                  {LETTERS_SECOND_LINE.map((letter, index) => <span key={index} aria-hidden style={{ display: 'inline-block', animation: `dwPop .55s cubic-bezier(.2,1.5,.4,1) ${letter.popDelay}s both` }}><span style={{ ...letterStyle('#ffffff', 14), animation: `dwWave 1.4s ease-in-out ${letter.waveDelay}s infinite` }}>{letter.character}</span></span>)}
                </div>
              </div>
            </div>
            <div style={{ position: 'absolute', left: 560, bottom: 0, width: 800, height: 560, display: 'flex', alignItems: 'flex-end' }}>
              {[1, 0, 2].map((slotIndex) => {
                const row = rankingRows[slotIndex]

                if (!row) return <div key={slotIndex} style={{ flex: 1 }} />

                return (
                  <div key={slotIndex} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', animation: `dwRise .7s cubic-bezier(.2,.9,.3,1.1) ${PODIUM.delay[slotIndex]}s both` }}>
                    <div style={{ width: PODIUM.duckWidth[slotIndex], animation: `dwWave ${PODIUM.bob[slotIndex]}s ease-in-out infinite` }}><MiniDuck color={row.color} width="100%" stroke={5} eye={4} /></div>
                    <div style={{ margin: '4px 0 10px', padding: '6px 18px', background: '#ffffff', border: '4px solid #000000', borderRadius: 999, fontSize: 24, fontWeight: 900, whiteSpace: 'nowrap' }}>{row.name}</div>
                    <div style={{ width: '100%', height: PODIUM.height[slotIndex], background: slotIndex === 0 ? '#FFC93C' : '#ffffff', border: '6px solid #000000', borderBottom: 'none', borderRadius: '20px 20px 0 0', display: 'flex', justifyContent: 'center', paddingTop: 12, boxSizing: 'border-box', fontFamily: DISPLAY, fontSize: 96, lineHeight: 1 }}>{slotIndex + 1}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ position: 'absolute', right: 80, bottom: 80, width: 430, zIndex: 20, background: '#ffffff', border: '6px solid #000000', borderRadius: 32, boxShadow: '0 12px 0 #000000', padding: 24, display: 'flex', flexDirection: 'column', gap: 10, animation: 'dwSlideR .6s cubic-bezier(.2,.9,.3,1.15) 1.6s both' }}>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 3, color: '#5B4AB8' }}>ON-CHAIN · MONAD</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>Titles: <span style={{ display: 'inline-block', animation: minted ? 'dwPop .5s cubic-bezier(.2,1.5,.4,1) both' : 'dwBlink .7s ease-in-out infinite' }}>{minted ? 'MINTED' : 'MINTING…'}</span></div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>No prize pool. Titles are won, never bought.</div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
