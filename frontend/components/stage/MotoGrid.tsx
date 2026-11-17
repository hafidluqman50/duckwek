'use client'

import { useEffect, useRef } from 'react'
import type { GridEntrant } from '@/lib/types'
import { spriteOf } from '@/components/stage/sprites'
import { GRID_COLS, POLE_X, ROW_STEP, flyProgress, rowsOf, slotOf } from '@/lib/gridSlot'

const VIEW_W = 1788 // inner width of the 1800px asphalt card
const VIEW_H = 648
const VISIBLE_ROWS = 8 // rows in the camera window (design: ROWS 1-8)
export const hasFlyover = (n: number) => n > VISIBLE_ROWS * GRID_COLS // <= 24 entrants: no flyover, just show the grid
const DISPLAY = "'Lilita One', sans-serif"

/**
 * Starting grid on ONE canvas (200 DOM ducks dropped the stage to ~40 fps, see sprites.ts).
 * Only slots inside the camera window are drawn. The flyover is a single x offset on the world:
 * pole -> last row -> pole, finished before the 3-2-1 so the countdown is read from pole.
 * `countdown` is the integer from race:countdown; the in-between time is interpolated from when it last changed.
 */
export function MotoGrid({ entrants, countdown, total, camRef }: { entrants: GridEntrant[]; countdown: number; total: number; camRef: React.RefObject<HTMLDivElement | null> }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const cdRef = useRef({ countdown, at: 0 })
  const rows = rowsOf(entrants.length)
  const maxShift = Math.max(0, rows - VISIBLE_ROWS) * ROW_STEP
  const fly = hasFlyover(entrants.length)

  useEffect(() => { cdRef.current = { countdown, at: performance.now() } }, [countdown])

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = VIEW_W * dpr
    cv.height = VIEW_H * dpr
    let raf = 0
    const draw = (now: number) => {
      const { countdown: c, at } = cdRef.current
      const left = Math.max(0, c - Math.min(1, (now - at) / 1000)) // seconds to GO, continuous
      const shift = fly ? flyProgress(total, left) * maxShift : 0
      if (camRef.current) {
        const frac = maxShift ? shift / maxShift : 0
        camRef.current.style.left = `${(1 - frac) * 100}%`
        camRef.current.style.transform = `translateX(-${(1 - frac) * 100}%)`
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, VIEW_W, VIEW_H)
      ctx.textBaseline = 'alphabetic'
      for (const e of entrants) {
        const s = slotOf(e.i)
        const x = s.x + shift
        if (x < -170 || x > VIEW_W + 20) continue
        // painted slot box: open toward the start line
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 5
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(x + 150, s.y + 2.5)
        ctx.lineTo(x + 2.5, s.y + 2.5)
        ctx.lineTo(x + 2.5, s.y + 137.5)
        ctx.lineTo(x + 150, s.y + 137.5)
        ctx.stroke()
        ctx.fillStyle = 'rgba(201,184,255,0.75)'
        ctx.font = `40px ${DISPLAY}`
        ctx.fillText(String(e.i + 1), x + 10, s.y + 134)
        const bob = Math.sin(now / 1000 * (5.2 + (e.i % 5) * 0.4) + e.i) * 4
        ctx.drawImage(spriteOf(e.color), x + 44, s.y + 30 + bob, 96, 80)
        if (e.human) {
          const label = `P${e.i + 1} · ${e.name}`
          ctx.font = `900 18px Rubik, sans-serif`
          const w = Math.min(190, ctx.measureText(label).width + 24)
          ctx.fillStyle = '#ffffff'
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 4
          ctx.beginPath()
          ctx.roundRect(x + 30, s.y - 14, w, 30, 15)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = '#1E1446'
          ctx.fillText(label.length > 22 ? label.slice(0, 21) + '…' : label, x + 42, s.y + 7)
        }
      }
      // row tags
      ctx.fillStyle = '#C9B8FF'
      ctx.font = `900 16px Rubik, sans-serif`
      for (let r = 0; r < rows; r++) {
        const x = POLE_X - r * ROW_STEP - 70 + shift
        if (x > -80 && x < VIEW_W) ctx.fillText(`ROW ${r + 1}`, x, 50)
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [entrants, total, fly, maxShift, rows, camRef])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={ref} aria-label="Starting grid" role="img" style={{ position: 'absolute', left: 0, top: 0, width: VIEW_W, height: VIEW_H }} />
    </div>
  )
}

/** Whole field, 3 dots per row, pole on the right; the yellow window is the camera. */
export function GridMinimap({ entrants, camRef }: { entrants: GridEntrant[]; camRef: React.RefObject<HTMLDivElement | null> }) {
  const rows = rowsOf(entrants.length)
  const win = (VISIBLE_ROWS / rows) * 100
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 900, letterSpacing: 3, color: '#C9B8FF' }}>
        <span>BACK OF THE GRID</span><span>WHOLE FIELD · ROWS OF 3 · JOIN ORDER</span><span>POLE →</span>
      </div>
      <div style={{ position: 'relative', height: 70, background: '#120B2E', border: '5px solid #000000', borderRadius: 22, display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', padding: '0 14px' }}>
        <div style={{ position: 'relative', flex: 1, height: '100%', display: 'flex', flexDirection: 'row-reverse', alignItems: 'center' }}>
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
              {[0, 1, 2].map((k) => {
                const e = entrants[r * 3 + k]
                return <span key={k} style={{ width: 9, height: 9, borderRadius: '50%', background: e ? e.color : '#2A1D5E', marginLeft: k * 5 }} />
              })}
            </div>
          ))}
          <div ref={camRef} aria-hidden style={{ position: 'absolute', top: -8, bottom: -8, width: `${win}%`, right: 0, left: '100%', transform: 'translateX(-100%)', border: '5px solid #FFC93C', borderRadius: 16, pointerEvents: 'none' }} />
        </div>
      </div>
    </div>
  )
}
