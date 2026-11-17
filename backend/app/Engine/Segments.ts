// Track layout format (plan 0013 §12 G4), the same one smart-contract/src/render/SegmentLib.sol reads. One byte per segment:
//   high nibble = turn applied before the segment: 0 straight, 1 left 45, 2 right 45, 3 left 90, 4 right 90, 5 left 135, 6 right 135
//   low nibble  = length in steps of STEP metres (1..15)
// The walk starts heading east. Everything the engine and the UI need about a circuit (turns, length, centreline, sectors,
// profile) is derived from these bytes, so a race can be replayed from the on-chain layout alone (plan 0013 DoD 5).
import type { TrackProfile } from '@Models/Track'

export const STEP = 20 // metres per length unit
const VEC: [number, number][] = [[100, 0], [71, 71], [0, 100], [-71, 71], [-100, 0], [-71, -71], [0, -100], [71, -71]]
const TURN_STEPS = [0, -1, 1, -2, 2, -3, 3] // heading steps by turn nibble (positive = clockwise on screen)

export const bytesOf = (hex: string): number[] => {
  const h = hex.replace(/^0x/, '')
  const out: number[] = []
  for (let i = 0; i + 1 < h.length; i += 2) out.push(parseInt(h.slice(i, i + 2), 16))
  return out
}

export const turnsAndLength = (seg: number[]): { turns: number; lengthM: number } => {
  let turns = 0
  let lengthM = 0
  for (const b of seg) {
    if (b >> 4) turns++
    lengthM += (b & 15) * STEP
  }
  return { turns, lengthM }
}

export function walk(seg: number[]): { xs: number[]; ys: number[]; closed: boolean } {
  const xs = [0]
  const ys = [0]
  let h = 0
  for (const b of seg) {
    h = (((h + TURN_STEPS[b >> 4]) % 8) + 8) % 8
    const len = (b & 15) * STEP
    xs.push(xs[xs.length - 1] + VEC[h][0] * len)
    ys.push(ys[ys.length - 1] + VEC[h][1] * len)
  }
  const lim = STEP * 100
  const n = seg.length
  return { xs, ys, closed: Math.abs(xs[n] - xs[0]) <= lim && Math.abs(ys[n] - ys[0]) <= lim }
}

/** The smoothed centreline in the 1920x1080 design space the UI draws tracks in (corner vertices become quadratic curves). */
export function layoutPath(seg: number[], W = 1920, H = 1080, margin = 150): { path: number[][]; closed: boolean } {
  const { xs, ys, closed } = walk(seg)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const w = Math.max(maxX - minX, 1), h = Math.max(maxY - minY, 1)
  const k = Math.min((W - 2 * margin) / w, (H - 2 * margin) / h)
  const offX = margin + (W - 2 * margin - w * k) / 2
  const offY = margin + (H - 2 * margin - h * k) / 2
  const P = xs.map((x, i) => [Math.round(offX + (x - minX) * k), Math.round(offY + (ys[i] - minY) * k)] as [number, number])
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const quad = (p0: [number, number], c: [number, number], p1: [number, number], per = 8): number[][] => {
    const o: number[][] = []
    for (let i = 1; i <= per; i++) {
      const t = i / per, u = 1 - t
      o.push([Math.round(u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0]), Math.round(u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1])])
    }
    return o
  }
  const n = P.length
  const out: number[][] = []
  if (closed && n > 3) {
    const m = n - 1 // the last vertex is the start again
    let cur = mid(P[m - 1], P[0])
    out.push([Math.round(cur[0]), Math.round(cur[1])])
    for (let i = 0; i < m; i++) {
      const next = mid(P[i], P[(i + 1) % m])
      out.push(...quad(cur, P[i], next))
      cur = next
    }
    out.pop() // the curve ends where it began: the UI closes the loop itself
    return { path: out, closed: true }
  }
  out.push(P[0])
  if (n === 2) return { path: [P[0], P[1]], closed: false }
  let cur = mid(P[0], P[1])
  out.push([Math.round(cur[0]), Math.round(cur[1])])
  for (let i = 1; i < n - 1; i++) {
    const next = mid(P[i], P[i + 1])
    out.push(...quad(cur, P[i], next))
    cur = next
  }
  out.push(P[n - 1])
  return { path: out, closed: false }
}

/** Index of the path point where each sector ends (sector 1, 2, 3). */
export const sectorsOf = (points: number): number[] => [Math.round(points * 0.33), Math.round(points * 0.66), points - 1]

/**
 * The engine profile of a circuit, derived from its layout so it is reproducible from the chain (plan 0013 G4):
 * more turns per kilometre make a twisty track (weight acts like grip, top speed counts less). Calibrated so that the
 * 1800 m / 6 turn sprint gives the profile the engine was tuned on (speed 0.8, weight 0.4, boost 1, 35 ticks per lap).
 */
export function profileOf(turns: number, lengthM: number): TrackProfile {
  const d = turns / Math.max(lengthM / 1000, 0.1)
  const r3 = (x: number) => Math.round(x * 1000) / 1000
  const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
  return {
    speed: r3(clamp(1.1 - 0.09 * d, 0.5, 1.1)),
    weight: r3(clamp(0.07 + 0.1 * d, 0.2, 1)),
    boost: 1,
    lapTicks: Math.round(clamp(lengthM / 51.4, 20, 80)),
  }
}
