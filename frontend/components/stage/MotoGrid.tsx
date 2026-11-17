'use client'

import { useEffect, useRef } from 'react'
import type { GridEntrant } from '@/lib/types'
import { spriteForColor } from '@/components/stage/sprites'
import { GRID_COLS, POLE_X, ROW_STEP, flyProgress, countGridRows, gridSlotAt } from '@/lib/gridSlot'

const VIEW_WIDTH = 1788
const VIEW_HEIGHT = 648
const VISIBLE_ROWS = 8
export const needsGridFlyover = (entrantCount: number) => entrantCount > VISIBLE_ROWS * GRID_COLS
const DISPLAY = "'Lilita One', sans-serif"

export function MotoGrid({ entrants, countdown, total, cameraRef }: { entrants: GridEntrant[]; countdown: number; total: number; cameraRef: React.RefObject<HTMLDivElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const countdownRef = useRef({ countdown, at: 0 })
  const rows = countGridRows(entrants.length)
  const maxShift = Math.max(0, rows - VISIBLE_ROWS) * ROW_STEP
  const hasCameraFlyover = needsGridFlyover(entrants.length)

  useEffect(() => {
    countdownRef.current = { countdown, at: performance.now() }
  }, [countdown])

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) return

    const context = canvas.getContext('2d')!
    const devicePixelRatio = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = VIEW_WIDTH * devicePixelRatio
    canvas.height = VIEW_HEIGHT * devicePixelRatio
    let animationFrame = 0

    const draw = (now: number) => {
      const { countdown: secondsLeft, at } = countdownRef.current
      const left = Math.max(0, secondsLeft - Math.min(1, (now - at) / 1000))
      const shift = hasCameraFlyover ? flyProgress(total, left) * maxShift : 0

      if (cameraRef.current) {
        const fraction = maxShift ? shift / maxShift : 0
        cameraRef.current.style.left = `${(1 - fraction) * 100}%`
        cameraRef.current.style.transform = `translateX(-${(1 - fraction) * 100}%)`
      }

      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      context.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
      context.textBaseline = 'alphabetic'

      for (const entrant of entrants) {
        const slot = gridSlotAt(entrant.i)
        const x = slot.x + shift

        if (x < -170 || x > VIEW_WIDTH + 20) continue

        context.strokeStyle = '#ffffff'
        context.lineWidth = 5
        context.lineJoin = 'round'
        context.beginPath()
        context.moveTo(x + 150, slot.y + 2.5)
        context.lineTo(x + 2.5, slot.y + 2.5)
        context.lineTo(x + 2.5, slot.y + 137.5)
        context.lineTo(x + 150, slot.y + 137.5)
        context.stroke()
        context.fillStyle = 'rgba(201,184,255,0.75)'
        context.font = `40px ${DISPLAY}`
        context.fillText(String(entrant.i + 1), x + 10, slot.y + 134)
        const bob = Math.sin(now / 1000 * (5.2 + (entrant.i % 5) * 0.4) + entrant.i) * 4
        context.drawImage(spriteForColor(entrant.color), x + 44, slot.y + 30 + bob, 96, 80)

        if (entrant.human) {
          const label = `P${entrant.i + 1} · ${entrant.name}`
          context.font = `900 18px Rubik, sans-serif`
          const labelWidth = Math.min(190, context.measureText(label).width + 24)
          context.fillStyle = '#ffffff'
          context.strokeStyle = '#000000'
          context.lineWidth = 4
          context.beginPath()
          context.roundRect(x + 30, slot.y - 14, labelWidth, 30, 15)
          context.fill()
          context.stroke()
          context.fillStyle = '#1E1446'
          context.fillText(label.length > 22 ? label.slice(0, 21) + '…' : label, x + 42, slot.y + 7)
        }
      }

      context.fillStyle = '#C9B8FF'
      context.font = `900 16px Rubik, sans-serif`

      for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
        const x = POLE_X - rowIndex * ROW_STEP - 70 + shift

        if (x > -80 && x < VIEW_WIDTH) context.fillText(`ROW ${rowIndex + 1}`, x, 50)
      }

      animationFrame = requestAnimationFrame(draw)
    }

    animationFrame = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(animationFrame)
  }, [entrants, total, hasCameraFlyover, maxShift, rows, cameraRef])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} aria-label="Starting grid" role="img" style={{ position: 'absolute', left: 0, top: 0, width: VIEW_WIDTH, height: VIEW_HEIGHT }} />
    </div>
  )
}

export function GridMinimap({ entrants, cameraRef }: { entrants: GridEntrant[]; cameraRef: React.RefObject<HTMLDivElement | null> }) {
  const rows = countGridRows(entrants.length)
  const windowPercent = (VISIBLE_ROWS / rows) * 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 900, letterSpacing: 3, color: '#C9B8FF' }}>
        <span>BACK OF THE GRID</span><span>WHOLE FIELD · ROWS OF 3 · JOIN ORDER</span><span>POLE →</span>
      </div>
      <div style={{ position: 'relative', height: 70, background: '#120B2E', border: '5px solid #000000', borderRadius: 22, display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', padding: '0 14px' }}>
        <div style={{ position: 'relative', flex: 1, height: '100%', display: 'flex', flexDirection: 'row-reverse', alignItems: 'center' }}>
          {Array.from({ length: rows }, (_, rowIndex) => (
            <div key={rowIndex} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
              {[0, 1, 2].map((columnIndex) => {
                const entrant = entrants[rowIndex * 3 + columnIndex]

                return <span key={columnIndex} style={{ width: 9, height: 9, borderRadius: '50%', background: entrant ? entrant.color : '#2A1D5E', marginLeft: columnIndex * 5 }} />
              })}
            </div>
          ))}
          <div ref={cameraRef} aria-hidden style={{ position: 'absolute', top: -8, bottom: -8, width: `${windowPercent}%`, right: 0, left: '100%', transform: 'translateX(-100%)', border: '5px solid #FFC93C', borderRadius: 16, pointerEvents: 'none' }} />
        </div>
      </div>
    </div>
  )
}
