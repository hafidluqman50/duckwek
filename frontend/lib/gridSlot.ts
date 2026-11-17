export const GRID_COLS = 3
export const ROW_STEP = 190
export const COL_STEP = 55
export const LANE_STEP = 190
export const POLE_X = 1450
export const TOP_PAD = 70

export function gridSlotAt(index: number): { row: number; col: number; x: number; y: number } {
  const row = Math.floor(index / GRID_COLS)
  const col = index % GRID_COLS

  return { row, col, x: POLE_X - row * ROW_STEP - col * COL_STEP, y: TOP_PAD + col * LANE_STEP }
}

export const countGridRows = (count: number): number => Math.ceil(count / GRID_COLS)
export const gridColumnName = (col: number): string => (col === 0 ? 'left' : col === 1 ? 'middle' : 'right')

export const HOLD = 3
export function flyProgress(total: number, left: number): number {
  const span = total - HOLD

  if (span <= 0) return 0

  const progress = Math.min(1, Math.max(0, (total - left) / span))
  const triangle = progress < 0.5 ? progress * 2 : (1 - progress) * 2

  return triangle * triangle * (3 - 2 * triangle)
}
