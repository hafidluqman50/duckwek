export type Pt = [number, number]

export interface TrackGeo {
  closed: boolean
  laps: number
  pts: Pt[]
  cum: number[]
  total: number
  d: string
  turns: { n: string; x: number; y: number }[]
}

export function buildTrackGeometry(raw: number[][], closed: boolean, laps: number, turnIndexes: number[] = []): TrackGeo {
  let pts: Pt[] = raw.map((point) => [point[0], point[1]])
  if (closed && raw.length > 3) {
    pts = []
    const count = raw.length

    for (let index = 0; index < count; index++) {
      const previous = raw[(index - 1 + count) % count], current = raw[index], next = raw[(index + 1) % count], afterNext = raw[(index + 2) % count]

      for (let step = 0; step < 6; step++) {
        const fraction = step / 6, squared = fraction * fraction, cubed = squared * fraction

        pts.push([0, 1].map((axis) => 0.5 * (2 * current[axis] + (-previous[axis] + next[axis]) * fraction + (2 * previous[axis] - 5 * current[axis] + 4 * next[axis] - afterNext[axis]) * squared + (-previous[axis] + 3 * current[axis] - 3 * next[axis] + afterNext[axis]) * cubed)) as Pt)
      }
    }

    pts.push(pts[0])
  }

  const cum = [0]

  for (let index = 1; index < pts.length; index++) cum.push(cum[index - 1] + Math.hypot(pts[index][0] - pts[index - 1][0], pts[index][1] - pts[index - 1][1]))

  const d = 'M ' + pts.map((point) => `${Math.round(point[0])} ${Math.round(point[1])}`).join(' L ') + (closed ? ' Z' : '')
  const turns = turnIndexes.filter((turnIndex) => raw[turnIndex]).map((turnIndex, order) => ({ n: String(order + 1).padStart(2, '0'), x: raw[turnIndex][0], y: raw[turnIndex][1] }))

  return { closed, laps: Math.max(1, laps), pts, cum, total: cum[cum.length - 1] || 1, d, turns }
}

export function pathFractionAt(track: TrackGeo, progress: number): number {
  if (track.closed) {
    const lapsDone = Math.min(progress, 1) * track.laps

    return lapsDone >= track.laps ? 0 : lapsDone - Math.floor(lapsDone)
  }

  return 0.03 + Math.min(progress, 1.04) * 0.93
}

export function pointAtFraction(track: TrackGeo, u: number, lateral = 0) {
  const distance = Math.max(0, Math.min(1, u)) * track.total
  let low = 0, high = track.cum.length - 2

  while (low < high) {
    const middle = (low + high + 1) >> 1

    if (track.cum[middle] <= distance) low = middle
    else high = middle - 1
  }

  const start = track.pts[low], end = track.pts[low + 1] || start
  const segment = track.cum[low + 1] - track.cum[low] || 1
  const fraction = (distance - track.cum[low]) / segment
  const dx = end[0] - start[0], dy = end[1] - start[1], length = Math.hypot(dx, dy) || 1

  return { x: start[0] + dx * fraction + (-dy / length) * lateral, y: start[1] + dy * fraction + (dx / length) * lateral, dx, dy }
}

export const TURNS: Record<string, number[]> = { 'alpine-ring': [3, 8, 11, 17, 20, 24, 27, 30, 35, 37], 'kali-code-sprint': [] }
