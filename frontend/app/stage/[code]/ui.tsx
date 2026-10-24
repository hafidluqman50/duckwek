'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { useRoomLive } from '@/lib/useRoomLive'
import { buildTrack, pointAt, uOf, TURNS, type TrackGeo } from '@/lib/track'
import type { GridEntrant } from '@/lib/types'
import { DuckSvg, MiniDuck } from '@/components/duck/DuckSvg'
import { sound } from '@/lib/sound'
import { APP_URL } from '@/lib/config'
import { SoundButton } from '@/components/play/Shell'

// Projector (1920x1080, scaled to the screen). Every number below comes from the stage section of Prototype3.dc.html.
const W = 1920, H = 1080
const DISPLAY = "'Lilita One', sans-serif"
const MONO = "'JetBrains Mono', monospace"
const CHECKER = 'repeating-conic-gradient(#ffffff 0 25%, #000000 0 50%)'

function useFit() {
  const [s, setS] = useState(0.5)
  useEffect(() => {
    const f = () => setS(Math.min(window.innerWidth / W, window.innerHeight / H))
    f()
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  return s
}

const CONFETTI_COLORS = ['#FFC93C', '#ffffff', '#FF7AB6', '#4ED1C5', '#1E1446', '#B8F35A']
const CONFETTI = Array.from({ length: 30 }, (_, j) => ({ x: (j * 263) % 1900, w: 18 + (j % 3) * 10, c: CONFETTI_COLORS[j % CONFETTI_COLORS.length], d: (2.6 + (j % 5) * 0.5).toFixed(1), dl: ((j * 0.37) % 3).toFixed(2) }))
const RAYS = Array.from({ length: 16 }, (_, q) => {
  const a0 = (q / 16) * Math.PI * 2, a1 = a0 + Math.PI / 16
  return `M960 420 L${Math.round(960 + 2200 * Math.cos(a0))} ${Math.round(420 + 2200 * Math.sin(a0))} L${Math.round(960 + 2200 * Math.cos(a1))} ${Math.round(420 + 2200 * Math.sin(a1))} Z`
}).join(' ')
const LETTERS_A = 'ABSOLUTE'.split('').map((c, i) => ({ c, d: (0.35 + i * 0.07).toFixed(2), w: (1.2 + i * 0.09).toFixed(2) }))
const LETTERS_B = 'MARVELOUS'.split('').map((c, i) => ({ c, d: (0.95 + i * 0.07).toFixed(2), w: (1.9 + i * 0.09).toFixed(2) }))
const PHOTO_SPECS = [{ w: 460, t: 340, beak: 1135 }, { w: 380, t: 180, beak: 1060 }, { w: 300, t: 40, beak: 980 }]
const PODIUM = { h: [230, 150, 100], dw: [220, 150, 130], dl: [1.5, 1.7, 1.9], bob: [0.9, 1.3, 1.5] }

const pill = (bg: string, fg: string): React.CSSProperties => ({ padding: '3px 10px', border: '3px solid #000000', borderRadius: 999, fontSize: 18, fontWeight: 800, background: bg, color: fg })
const letter = (color: string, shadow: number): React.CSSProperties => ({ display: 'inline-block', fontFamily: DISPLAY, fontSize: 190, lineHeight: 0.95, color, WebkitTextStroke: '10px #000000', paintOrder: 'stroke fill', textShadow: `0 ${shadow}px 0 #000000` })

// ---- smooth movement ------------------------------------------------------------------------------------------------
// Positions arrive once per tick, unevenly (about every 0.3 to 0.7 s, sometimes two steps at once). Drawing them as they come made the
// ducks move and then wait. The projector therefore plays the race back a little behind the chain: it keeps the ticks it received,
// measured in race steps, and moves a playback position through them at the speed steps really arrive, interpolating linearly between
// two ticks. A controller nudges that speed (at most -50 % / +35 %) to stay LAG_STEPS behind the newest tick, so a late tick does not
// stall the ducks and an early one does not make them jump. Frames update the elements directly, not React state.
const LAG_STEPS = 3
const STEP_MS = 300
const KEEP = 14

interface Sample { n: number; p: Float64Array }

// The ducks are drawn on ONE canvas. 200 SVG elements, each with its own animation and compositor layer, plus a React render of all of
// them at every tick, dropped the frame rate to about 40 fps with frames of 80 to 170 ms exactly when a tick arrived (measured with
// __tests__/stage/perf.mjs). A canvas draws 200 ducks in about a millisecond and nothing in React touches them between ticks.
const DUCK_BODY = '10,60 30,40 70,38 100,50 95,75 60,88 25,84'
const DUCK_HEAD = '70,40 72,18 88,8 102,16 104,36 92,46'
const DUCK_BILL = '102,20 119,27 102,34'
const SPRITE_PX = 3 // sprite resolution per design unit: sharp up to the largest duck on a 4K screen
const sprites = new Map<string, HTMLCanvasElement>()
const poly = (ctx: CanvasRenderingContext2D, pts: string) => {
  const a = pts.split(' ').map((q) => q.split(',').map(Number))
  ctx.beginPath()
  ctx.moveTo(a[0][0], a[0][1])
  for (let k = 1; k < a.length; k++) ctx.lineTo(a[k][0], a[k][1])
  ctx.closePath()
}
/** One duck in its colour, drawn once into its own small canvas (the same polygons as MiniDuck, stroke 7). */
function spriteOf(color: string): HTMLCanvasElement {
  let c = sprites.get(color)
  if (c) return c
  c = document.createElement('canvas')
  c.width = 120 * SPRITE_PX
  c.height = 100 * SPRITE_PX
  const ctx = c.getContext('2d')!
  ctx.scale(SPRITE_PX, SPRITE_PX)
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 7
  ctx.fillStyle = color
  poly(ctx, DUCK_BODY); ctx.fill(); ctx.stroke()
  poly(ctx, DUCK_HEAD); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#FF9F1C'
  ctx.lineWidth = 6
  poly(ctx, DUCK_BILL); ctx.fill(); ctx.stroke()
  sprites.set(color, c)
  return c
}

function RaceLayer({ geo, ents, p, n, en, big, top3 }: { geo: TrackGeo; ents: GridEntrant[]; p: number[]; n: number; en: number[]; big: boolean; top3: { i: number; label: string }[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const tagEls = useRef(new Map<number, HTMLDivElement>())
  const pb = useRef({ samples: [] as Sample[], play: 0, stepMs: STEP_MS, at: 0 })
  const energy = useRef<number[]>([])
  const w = big ? 30 : 38

  useEffect(() => { energy.current = en }, [en])

  useEffect(() => {
    const b = pb.current
    const now = performance.now()
    const last = b.samples[b.samples.length - 1]
    if (last && n <= last.n) return // a tick that landed late: that step is already known
    if (!last) b.play = Math.max(0, n - LAG_STEPS)
    else {
      const gap = (now - b.at) / (n - last.n) // how often a step really arrives
      if (gap > 80 && gap < 1500) b.stepMs = b.stepMs * 0.7 + gap * 0.3
    }
    b.samples.push({ n, p: Float64Array.from(p) })
    if (b.samples.length > KEEP) b.samples.shift()
    b.at = now
  }, [p, n])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let prev = performance.now()
    let px = 1 // canvas pixels per design pixel (the stage is scaled to the screen)
    const fit = () => {
      const r = canvas.getBoundingClientRect()
      px = Math.max(0.25, (r.width / W) * (window.devicePixelRatio || 1))
      canvas.width = Math.round(W * px)
      canvas.height = Math.round(H * px)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(canvas)
    const items: { x: number; y: number; flip: boolean; color: string; boosted: boolean; phase: number }[] = ents.map((e, k) => ({ x: 0, y: 0, flip: false, color: e.color, boosted: false, phase: (k * 37) % 45 / 100 }))
    const frame = (now: number) => {
      const b = pb.current
      const dt = Math.min(100, now - prev)
      prev = now
      const sm = b.samples
      if (sm.length) {
        const latest = sm[sm.length - 1].n
        const speed = 1 + Math.max(-0.5, Math.min(0.35, (latest - LAG_STEPS - b.play) * 0.3))
        b.play = Math.min(latest, b.play + (dt / b.stepMs) * speed)
        // the two ticks around the playback position (before the first one, ducks come from the line)
        let hi = sm.length - 1
        while (hi > 0 && sm[hi - 1].n >= b.play) hi--
        const B = sm[hi]
        const A = hi > 0 ? sm[hi - 1] : null
        const f = A ? (b.play - A.n) / (B.n - A.n) : B.n > 0 ? b.play / B.n : 1
        const en = energy.current
        ents.forEach((e, k) => {
          const i = e.i
          if (i >= B.p.length) return
          const a = A ? A.p[i] : 0
          const v = a + (B.p[i] - a) * Math.max(0, Math.min(1, f))
          const lat = e.human ? ((i * 29) % 30) - 15 : ((i * 53) % 70) - 35
          const pt = pointAt(geo, uOf(geo, v / 10000), lat)
          const it = items[k]
          it.x = pt.x
          it.y = pt.y
          it.flip = pt.dx < 0
          it.boosted = e.human && (en[i] ?? 0) > 25
          const tg = tagEls.current.get(i)
          if (tg) tg.style.transform = `translate3d(${(pt.x - 30).toFixed(1)}px, ${(pt.y - w * 0.62 - 42).toFixed(1)}px, 0)`
        })
      }
      // draw: lower on the screen is in front; a cheered human duck is bigger and glows
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const order = items.map((_, k) => k).sort((a, b2) => items[a].y - items[b2].y)
      for (const k of order) {
        const it = items[k]
        if (it.x === 0 && it.y === 0) continue
        const size = it.boosted ? w * 1.45 : w
        const bob = Math.sin((now / 1000 + it.phase) * Math.PI * 2 / 0.45) // the same 0.45 s rocking as before
        ctx.setTransform(px, 0, 0, px, 0, 0)
        ctx.translate(it.x, it.y - bob * 2)
        ctx.rotate((bob * 4 * Math.PI) / 180)
        if (it.flip) ctx.scale(-1, 1)
        if (it.boosted) {
          ctx.shadowColor = '#FFC93C'
          ctx.shadowBlur = 18 * px
        } else ctx.shadowBlur = 0
        ctx.drawImage(spriteOf(it.color), -size / 2, -size * 0.62, size, size * (100 / 120))
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [geo, ents, w])

  const away = 'translate3d(-300px, -300px, 0)'
  return (
    <>
      <canvas ref={canvasRef} data-ducks aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }} />
      {top3.map((t) => (
        <div key={'t' + t.i} ref={(el) => { if (el) tagEls.current.set(t.i, el); else tagEls.current.delete(t.i) }} style={{ position: 'absolute', left: 0, top: 0, zIndex: 2000, padding: '4px 12px', border: '4px solid #000000', borderRadius: 999, fontSize: 20, fontWeight: 900, whiteSpace: 'nowrap', background: '#ffffff', color: '#1E1446', transform: away, willChange: 'transform' }}>{t.label}</div>
      ))}
    </>
  )
}

export function StagePage({ code }: { code: string }) {
  const scale = useFit()
  const live = useRoomLive(code, { photoMs: 3200 })
  const { room, grid, tick, phase, result, settled, countdown } = live
  const [qr, setQr] = useState('')
  const [armed, setArmed] = useState(false)
  const [photoGo, setPhotoGo] = useState(false)
  const joinUrl = `${APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/join/${code}`

  useEffect(() => {
    QRCode.toDataURL(joinUrl, { margin: 1, width: 420, color: { dark: '#1E1446', light: '#ffffff' } }).then(setQr).catch(() => undefined)
  }, [joinUrl])

  const geo = useMemo(() => (room ? buildTrack(room.track.path, room.track.closed, room.track.laps, TURNS[room.track.slug] || []) : null), [room])

  // Projector sound is louder and owns the music
  useEffect(() => { sound.setVolume(0.9) }, [])
  useEffect(() => { sound.music(phase === 'race' ? 'race' : phase === 'idle' ? 'lobby' : null) }, [phase, armed])
  useEffect(() => { if (phase === 'countdown') sound.play(countdown > 0 ? 'beep' : 'go') }, [phase, countdown])
  const prev = useRef(phase)
  useEffect(() => {
    if (prev.current === 'countdown' && phase === 'race') sound.play('go')
    if (phase === 'photo') sound.play('shutter')
    if (phase === 'result') { sound.play('fanfare'); sound.play('crowd') }
    prev.current = phase
  }, [phase])
  useEffect(() => { if (tick && tick.b % 2 === 0) sound.play('splash') }, [tick])
  useEffect(() => {
    if (phase !== 'result') return
    const t = setTimeout(() => live.reset(), 25_000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])
  // The photo-finish ducks slide in: first render off screen, then the transition runs.
  useEffect(() => {
    if (phase !== 'photo') return
    const t = setTimeout(() => setPhotoGo(true), 80)
    return () => {
      clearTimeout(t)
      setPhotoGo(false)
    }
  }, [phase])
  const playersRef = useRef(0)
  useEffect(() => {
    if (room && room.count > playersRef.current && playersRef.current > 0) sound.play('join')
    if (room) playersRef.current = room.count
  }, [room])

  if (!room || !geo) {
    return (
      <main style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1E1446', color: '#fff', fontFamily: DISPLAY, fontSize: 40 }}>
        {live.error ? `${code}: ${live.error}` : 'Loading stage…'}
      </main>
    )
  }

  const trackName = room.track.name.toUpperCase()
  const lapsLabel = `${room.track.laps} ${room.track.laps > 1 ? 'LAPS' : 'LAP'}`
  const trackMeta = `${(room.track.lengthM / 1000).toFixed(1)} km · ${room.track.turns} turns · ${room.track.laps} ${room.track.laps > 1 ? 'laps' : 'lap'}`
  const ents = grid?.entrants || []
  const p = tick?.p || ents.map(() => 0)
  const order = p.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v)
  const lead = order[0]?.v ?? 0
  const lapNow = Math.min(room.track.laps, Math.floor(Math.min(lead / 10000, 1) * room.track.laps) + 1)
  const big = ents.length > 100 // a full room: smaller ducks on the grid and on the track so all 200 fit
  const dense = big
  const finish = (() => {
    const s = pointAt(geo, geo.closed ? 0 : 0.96, 0)
    return { x: Math.round(s.x - 15), y: Math.round(s.y - 75), a: Math.round(Math.atan2(s.dy, s.dx) * 180 / Math.PI) }
  })()
  const rk = result?.ranking || []
  const minted = !!settled?.ok

  return (
    <main onPointerDown={() => { sound.unlock(); setArmed(true) }} style={{ height: '100dvh', overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'center', flex: 'none', overflow: 'hidden', background: '#1E1446', color: '#fff', fontFamily: 'var(--font-sans)' }}>
        <div style={{ position: 'absolute', right: 24, bottom: 24, zIndex: 5000, display: 'flex', alignItems: 'center', gap: 10 }}>
          {!armed && <span style={{ fontSize: 18, fontWeight: 800, color: '#C9B8FF' }}>click once to enable sound</span>}
          <SoundButton dark />
        </div>

        {/* LOBBY */}
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
                    <path d={geo.d} fill="none" stroke="#000000" strokeWidth="90" strokeLinecap="round" strokeLinejoin="round" />
                    <path d={geo.d} fill="none" stroke="#836EF9" strokeWidth="66" strokeLinecap="round" strokeLinejoin="round" />
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
                {qr ? <img src={qr} width={420} height={420} alt={`QR code to join ${code}`} style={{ display: 'block' }} /> : <div style={{ width: 420, height: 420 }} />}
              </div>
              <div style={{ marginTop: 22, fontFamily: MONO, fontSize: 22, fontWeight: 700, color: '#1E1446', whiteSpace: 'nowrap' }}>{joinUrl.replace(/^https?:\/\//, '')}</div>
            </div>
            <div style={{ position: 'absolute', left: 110, bottom: 56, width: 1700, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 3, color: '#C9B8FF' }}>DUCKS IN THE ROOM</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, overflow: 'hidden' }}>
                {room.players.slice(-12).map((pl, i) => (
                  <div key={pl.address} style={{ flex: 'none', animation: 'dwChip .45s cubic-bezier(.2,1.4,.4,1) both', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 120 }}>
                    <div style={{ animation: `dwBob 1.3s ease-in-out ${((i * 0.13) % 1).toFixed(2)}s infinite` }}><DuckSvg {...pl} width={96} /></div>
                    <div style={{ ...pill(pl.host ? '#FFC93C' : '#2A1D5E', pl.host ? '#1E1446' : '#ffffff'), maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STARTING GRID */}
        {phase === 'countdown' && grid && (
          <div style={{ position: 'absolute', inset: 0, padding: '56px 120px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 26 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 4, color: '#C9B8FF' }}>{code} · {trackName} · {lapsLabel}</div>
                <div style={{ fontFamily: DISPLAY, fontSize: 96, color: '#FFC93C', textShadow: '0 8px 0 #836EF9' }}>STARTING GRID</div>
              </div>
              <div style={{ width: 160, height: 160, borderRadius: '50%', background: '#FFC93C', color: '#1E1446', border: '6px solid #000000', boxShadow: '0 10px 0 #000000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'dwPulse 1s ease-in-out infinite' }}>
                <div style={{ fontSize: 18, fontWeight: 900 }}>GO IN</div>
                <div style={{ fontFamily: DISPLAY, fontSize: 96, lineHeight: 0.9 }}>{countdown}</div>
              </div>
            </div>
            <div style={{ position: 'relative', flex: 1, background: '#836EF9', border: '6px solid #000000', borderRadius: 40, boxShadow: '0 14px 0 #000000', padding: '20px 36px 16px 120px', overflow: 'hidden', animation: 'dwEnter .6s both' }}>
              <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 84, background: 'repeating-conic-gradient(#ffffff 0 25%, #1E1446 0 50%) 0 0 / 42px 42px', borderRight: '6px solid #000000' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(20, minmax(0, 1fr))', columnGap: 6, rowGap: 2 }}>
                {ents.map((e) => (
                  <div key={e.i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <MiniDuck color={e.color} width={dense ? 40 : 58} style={{ height: dense ? 33 : 48, animation: `dwChip .4s cubic-bezier(.2,1.4,.4,1) ${((e.i % 20) * 0.03 + Math.floor(e.i / 20) * 0.05).toFixed(2)}s both, dwBob 1.2s ease-in-out ${((e.i % 20) * 0.06).toFixed(2)}s infinite` }} />
                    <div style={{ padding: '0 6px', borderRadius: 999, fontSize: dense ? 11 : 13, fontWeight: 900, whiteSpace: 'nowrap', maxWidth: 76, overflow: 'hidden', textOverflow: 'ellipsis', color: '#1E1446', background: e.human ? '#ffffff' : 'transparent', border: e.human ? '3px solid #000000' : '0' }}>{e.human ? e.name : String(e.i + 1)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RACE */}
        {phase === 'race' && grid && (
          <div style={{ animation: 'dwShake .55s ease-out .05s both', position: 'absolute', inset: 0, background: '#241858' }}>
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }} aria-hidden>
              <path d={geo.d} fill="none" stroke="#000000" strokeWidth="150" strokeLinecap="round" strokeLinejoin="round" />
              <path d={geo.d} fill="none" stroke="#836EF9" strokeWidth="134" strokeLinecap="round" strokeLinejoin="round" />
              <path d={geo.d} fill="none" stroke="#9D8CFB" strokeWidth="80" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
              <path d={geo.d} fill="none" stroke="#ffffff" strokeWidth="4" strokeDasharray="26 44" opacity="0.5" style={{ animation: 'dwFlow 1s linear infinite' }} />
            </svg>
            <div aria-hidden style={{ position: 'absolute', left: finish.x, top: finish.y, width: 30, height: 150, transform: `rotate(${finish.a}deg)`, background: `${CHECKER} 0 0 / 30px 30px`, border: '4px solid #000000' }} />
            {geo.turns.map((t) => (
              <div key={t.n} aria-hidden style={{ position: 'absolute', left: Math.round(t.x + 48), top: Math.round(t.y - 72), width: 44, height: 44, borderRadius: '50%', background: '#1E1446', border: '3px solid #ffffff', color: '#ffffff', fontSize: 18, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.n}</div>
            ))}
            <RaceLayer geo={geo} ents={ents} p={p} n={tick?.n ?? tick?.t ?? 0} en={tick?.en ?? []} big={big} top3={order.slice(0, 3).map((o, ti) => ({ i: o.i, label: `${ti + 1} ${ents[o.i]?.name ?? ''}` }))} />
            <div style={{ position: 'absolute', left: 40, top: 30, zIndex: 3000, background: '#1E1446', border: '5px solid #000000', borderRadius: 28, boxShadow: '0 8px 0 #000000', padding: '16px 26px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 3, color: '#C9B8FF' }}>{code} · {trackName}</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 44, color: '#FFC93C' }}>LAP {lapNow} / {room.track.laps}</div>
              <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700 }}>BLOCK #{tick?.b?.toLocaleString('en-US') ?? '—'}</div>
            </div>
            <div style={{ position: 'absolute', right: 40, top: 30, zIndex: 3000, width: 400, background: '#ffffff', color: '#1E1446', border: '5px solid #000000', borderRadius: 28, boxShadow: '0 8px 0 #000000', overflow: 'hidden' }}>
              <div style={{ background: '#FFC93C', borderBottom: '5px solid #000000', padding: '10px 22px', fontFamily: DISPLAY, fontSize: 34 }}>TOP 3</div>
              {order.slice(0, 3).map((o, i) => (
                <div key={o.i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 22px', borderBottom: '3px solid #E6E0FF' }}>
                  <div style={{ fontFamily: DISPLAY, fontSize: 36, width: 28 }}>{i + 1}</div>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', border: '4px solid #000000', background: ents[o.i]?.color }} />
                  <div style={{ flex: 1, fontSize: 24, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ents[o.i]?.name}</div>
                  <div style={{ fontFamily: MONO, fontSize: 18 }}>{i === 0 ? 'LEAD' : '+' + ((lead - o.v) / 100).toFixed(1)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PHOTO FINISH */}
        {phase === 'photo' && result && (
          <div style={{ position: 'absolute', inset: 0, background: '#1E1446' }}>
            <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 50, background: '#ffffff', pointerEvents: 'none', animation: 'dwFlash .7s ease-out forwards' }} />
            <div style={{ position: 'absolute', left: 96, top: 40, fontFamily: DISPLAY, fontSize: 96, color: '#FFC93C', textShadow: '0 8px 0 #836EF9' }}>PHOTO FINISH</div>
            <div style={{ position: 'absolute', left: 96, top: 170, width: 1728, height: 780, background: '#836EF9', border: '8px solid #000000', borderRadius: 40, boxShadow: '0 16px 0 #000000', overflow: 'hidden' }}>
              <div aria-hidden style={{ position: 'absolute', left: 1060, top: 0, width: 56, height: 780, background: `${CHECKER} 0 0 / 56px 56px`, borderLeft: '6px solid #000000', borderRight: '6px solid #000000' }} />
              {[2, 1, 0].map((k) => {
                const r = rk[k]
                if (!r) return null
                const sp = PHOTO_SPECS[k]
                const left = sp.beak - sp.w * 0.99
                return (
                  <div key={r.rank} style={{ position: 'absolute', left: Math.round(photoGo ? left : left - 900), top: sp.t, width: sp.w, transition: 'left 1.6s cubic-bezier(.2,.7,.3,1)' }}>
                    <MiniDuck color={r.color} width="100%" stroke={4} eye={3.5} style={{ animation: 'dwBob 1.8s ease-in-out infinite' }} />
                    <div style={{ position: 'absolute', right: '100%', top: '48%', marginRight: 12, padding: '6px 16px', color: '#1E1446', border: '4px solid #000000', borderRadius: 999, fontSize: 26, fontWeight: 900, whiteSpace: 'nowrap', background: k === 0 ? '#FFC93C' : '#ffffff' }}>{k + 1} · {r.name}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* WINNER */}
        {phase === 'result' && result && (
          <div style={{ animation: 'dwShake .6s ease-out 1.25s both', position: 'absolute', inset: 0, background: '#836EF9', color: '#1E1446' }}>
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '960px 420px', animation: 'dwSpin 24s linear infinite' }} aria-hidden>
              <path d={RAYS} fill="#9682FA" />
            </svg>
            <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 50, background: '#ffffff', pointerEvents: 'none', animation: 'dwFlash .6s ease-out forwards' }} />
            {CONFETTI.map((c, j) => (
              <div key={j} aria-hidden style={{ position: 'absolute', left: c.x, top: 0, zIndex: 10, width: c.w, height: 16, background: c.c, border: '3px solid #000000', animation: `dwFall ${c.d}s linear ${c.dl}s infinite both` }} />
            ))}
            <div style={{ position: 'absolute', left: 0, top: 52, width: 1920, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 20 }}>
              <div style={{ padding: '10px 28px', background: '#1E1446', color: '#ffffff', borderRadius: 999, fontSize: 28, fontWeight: 900, letterSpacing: 4 }}>{code} · {trackName} · {(rk[0]?.name || '').toUpperCase()}</div>
              <div role="heading" aria-level={1} aria-label="Absolute Marvelous" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'rotate(-2deg)' }}>
                <div style={{ display: 'flex' }}>
                  {LETTERS_A.map((l, i) => <span key={i} aria-hidden style={{ display: 'inline-block', animation: `dwPop .55s cubic-bezier(.2,1.5,.4,1) ${l.d}s both` }}><span style={{ ...letter('#FFC93C', 14), animation: `dwWave 1.4s ease-in-out ${l.w}s infinite` }}>{l.c}</span></span>)}
                </div>
                <div style={{ display: 'flex' }}>
                  {LETTERS_B.map((l, i) => <span key={i} aria-hidden style={{ display: 'inline-block', animation: `dwPop .55s cubic-bezier(.2,1.5,.4,1) ${l.d}s both` }}><span style={{ ...letter('#ffffff', 14), animation: `dwWave 1.4s ease-in-out ${l.w}s infinite` }}>{l.c}</span></span>)}
                </div>
              </div>
            </div>
            <div style={{ position: 'absolute', left: 560, bottom: 0, width: 800, height: 560, display: 'flex', alignItems: 'flex-end' }}>
              {[1, 0, 2].map((k) => {
                const r = rk[k]
                if (!r) return <div key={k} style={{ flex: 1 }} />
                return (
                  <div key={k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', animation: `dwRise .7s cubic-bezier(.2,.9,.3,1.1) ${PODIUM.dl[k]}s both` }}>
                    <div style={{ width: PODIUM.dw[k], animation: `dwWave ${PODIUM.bob[k]}s ease-in-out infinite` }}><MiniDuck color={r.color} width="100%" stroke={5} eye={4} /></div>
                    <div style={{ margin: '4px 0 10px', padding: '6px 18px', background: '#ffffff', border: '4px solid #000000', borderRadius: 999, fontSize: 24, fontWeight: 900, whiteSpace: 'nowrap' }}>{r.name}</div>
                    <div style={{ width: '100%', height: PODIUM.h[k], background: k === 0 ? '#FFC93C' : '#ffffff', border: '6px solid #000000', borderBottom: 'none', borderRadius: '20px 20px 0 0', display: 'flex', justifyContent: 'center', paddingTop: 12, boxSizing: 'border-box', fontFamily: DISPLAY, fontSize: 96, lineHeight: 1 }}>{k + 1}</div>
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
