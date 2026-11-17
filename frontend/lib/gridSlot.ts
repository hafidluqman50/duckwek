/**
 * MotoGP-style starting grid geometry (visual only, design: stage-motogp-grid.dc.html).
 * Order is the join order `e.i`, rows of 3, pole = index 0 next to the start line.
 */
export const GRID_COLS = 3
export const ROW_STEP = 190 // px between rows on the 1800x660 stage asphalt (x steps back per row)
export const COL_STEP = 55 // px each column is pushed back (diagonal stagger)
export const LANE_STEP = 190 // px between the 3 columns (y)
export const POLE_X = 1450 // x of row 1 in asphalt coordinates (the start line is at 1630)
export const TOP_PAD = 70

export function slotOf(i: number): { row: number; col: number; x: number; y: number } {
  const row = Math.floor(i / GRID_COLS)
  const col = i % GRID_COLS
  return { row, col, x: POLE_X - row * ROW_STEP - col * COL_STEP, y: TOP_PAD + col * LANE_STEP }
}

export const rowsOf = (n: number): number => Math.ceil(n / GRID_COLS)
export const colName = (col: number): string => (col === 0 ? 'left' : col === 1 ? 'middle' : 'right')

/**
 * Camera offset in rows (0 = pole in view) for the flyover: out to the last row and back to pole,
 * finished before the last `HOLD` seconds so 3-2-1 is shown from pole. `left` = seconds to GO, `total` = countdown length.
 */
export const HOLD = 3
export function flyProgress(total: number, left: number): number {
  const span = total - HOLD
  if (span <= 0) return 0
  const t = Math.min(1, Math.max(0, (total - left) / span))
  const tri = t < 0.5 ? t * 2 : (1 - t) * 2
  return tri * tri * (3 - 2 * tri) // smoothstep
}
