'use client'

import type { GridEntrant } from '@/lib/types'
import { MiniDuck } from '@/components/duck/DuckSvg'
import { GRID_COLS, colName, slotOf } from '@/lib/gridSlot'

/**
 * Phone during the countdown: your grid slot (design: play-phone-grid.dc.html).
 * Shows your row, the row ahead and the row behind (3x3 around you), front at the top.
 */
export function GridSlot({ entrants, myIndex, countdown, code }: { entrants: GridEntrant[]; myIndex: number; countdown: number; code: string }) {
  const me = slotOf(myIndex)
  const rows = [me.row - 1, me.row, me.row + 1]
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#1E1446' }}>
      <div style={{ padding: '18px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2, color: '#C9B8FF' }}>YOUR GRID SLOT</div>
          <div className="stroke-title" style={{ fontFamily: 'var(--font-display)', fontSize: 64, lineHeight: 1, color: '#FFC93C', WebkitTextStroke: '5px #000' }}>P{myIndex + 1}</div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Row {me.row + 1} · {colName(me.col)} · of {entrants.length}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C9B8FF' }}>{code}</div>
        </div>
        <div style={{ width: 104, height: 104, borderRadius: '50%', background: '#FFC93C', color: '#1E1446', border: '5px solid #000', boxShadow: '0 7px 0 #000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 900 }}>GO IN</div>
          <div key={countdown} className="anim-pop" style={{ fontFamily: 'var(--font-display)', fontSize: 56, lineHeight: 0.9 }}>{countdown > 0 ? countdown : 'WEK'}</div>
        </div>
      </div>
      <div style={{ margin: '18px 16px 0', flex: 1, minHeight: 0, position: 'relative', background: '#2A1D5E', border: '5px solid #000', borderRadius: 28, boxShadow: '0 9px 0 #000', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 30, background: 'repeating-conic-gradient(#ffffff 0 25%, #000000 0 50%) 0 0 / 15px 15px', borderBottom: '4px solid #000' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 34, textAlign: 'center', fontSize: 11, fontWeight: 900, letterSpacing: 2, color: '#C9B8FF' }}>{me.row === 0 ? 'START · YOU ARE ON POLE' : 'START · POLE AHEAD'}</div>
        {rows.map((r, ri) =>
          Array.from({ length: GRID_COLS }, (_, k) => {
            const i = r * GRID_COLS + k
            const e = entrants[i]
            if (r < 0 || !e) return null
            const mine = i === myIndex
            return (
              <div key={i} style={{ position: 'absolute', left: 14 + k * 110, top: 60 + ri * 150 + k * 26, width: 96, height: 96 }}>
                <div aria-hidden style={{ position: 'absolute', inset: 0, border: `4px solid ${mine ? '#FFC93C' : '#ffffff'}`, borderBottom: 0, borderRadius: '6px 6px 0 0' }} />
                <div style={{ position: 'absolute', right: 6, bottom: 2, fontFamily: 'var(--font-display)', fontSize: 24, color: '#C9B8FF' }}>{i + 1}</div>
                <div style={{ position: 'absolute', left: 20, top: 14, transform: 'rotate(-90deg)', animation: `dwBob ${(0.9 + k * 0.15).toFixed(2)}s ease-in-out infinite` }}>
                  <MiniDuck color={e.color} width={mine ? 66 : 56} />
                </div>
              </div>
            )
          }),
        )}
        <div style={{ position: 'absolute', left: 14 + me.col * 110 + 20, top: 60 + 150 + me.col * 26 + 100, padding: '2px 10px', border: '3px solid #000', borderRadius: 999, background: '#FFC93C', color: '#1E1446', fontSize: 13, fontWeight: 900 }}>You</div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#C9B8FF' }}>Look up: the projector is flying over the grid.</div>
      </div>
      <div style={{ padding: '18px 16px 22px' }}>
        <button type="button" disabled style={{ width: '100%', height: 64, background: '#3A2E70', color: '#C9B8FF', border: '4px solid #000', borderRadius: 20, fontFamily: 'var(--font-display)', fontSize: 30 }}>CHEER opens at GO</button>
      </div>
    </div>
  )
}
