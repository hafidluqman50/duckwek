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

/** Smooth a closed polygon with Catmull-Rom (Alpine Ring) or use an open path as-is (Kali Code). */
export function buildTrack(raw: number[][], closed: boolean, laps: number, turnIdx: number[] = []): TrackGeo {
  let pts: Pt[] = raw.map((p) => [p[0], p[1]])
  if (closed && raw.length > 3) {
    pts = []
    const n = raw.length
    for (let i = 0; i < n; i++) {
      const p0 = raw[(i - 1 + n) % n], p1 = raw[i], p2 = raw[(i + 1) % n], p3 = raw[(i + 2) % n]
      for (let k = 0; k < 6; k++) {
        const t = k / 6, t2 = t * t, t3 = t2 * t
        pts.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)) as Pt)
      }
    }
    pts.push(pts[0])
  }
  const cum = [0]
  for (let j = 1; j < pts.length; j++) cum.push(cum[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]))
  const d = 'M ' + pts.map((p) => `${Math.round(p[0])} ${Math.round(p[1])}`).join(' L ') + (closed ? ' Z' : '')
  const turns = turnIdx.filter((i) => raw[i]).map((ix, q) => ({ n: String(q + 1).padStart(2, '0'), x: raw[ix][0], y: raw[ix][1] }))
  return { closed, laps: Math.max(1, laps), pts, cum, total: cum[cum.length - 1] || 1, d, turns }
}

/** Race progress (0..1 over all laps) → position along the drawn path. */
export function uOf(t: TrackGeo, p: number): number {
  if (t.closed) {
    const x = Math.min(p, 1) * t.laps
    return x >= t.laps ? 0 : x - Math.floor(x)
  }
  return 0.03 + Math.min(p, 1.04) * 0.93
}

export function pointAt(t: TrackGeo, u: number, lateral = 0) {
  const L = Math.max(0, Math.min(1, u)) * t.total
  let lo = 0, hi = t.cum.length - 2
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (t.cum[mid] <= L) lo = mid
    else hi = mid - 1
  }
  const a = t.pts[lo], b = t.pts[lo + 1] || a
  const seg = t.cum[lo + 1] - t.cum[lo] || 1
  const f = (L - t.cum[lo]) / seg
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1
  return { x: a[0] + dx * f + (-dy / len) * lateral, y: a[1] + dy * f + (dx / len) * lateral, dx, dy }
}

// Turn markers (index in the raw centerline) for the projector
export const TURNS: Record<string, number[]> = { 'alpine-ring': [3, 8, 11, 17, 20, 24, 27, 30, 35, 37], 'kali-code-sprint': [] }
