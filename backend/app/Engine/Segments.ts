import type { TrackProfile } from '@Models/Track'

export const STEP = 20
const HEADING_VECTORS: [number, number][] = [[100, 0], [71, 71], [0, 100], [-71, 71], [-100, 0], [-71, -71], [0, -100], [71, -71]]
const HEADING_STEPS_BY_TURN = [0, -1, 1, -2, 2, -3, 3]
const HEADING_COUNT = 8
const CLOSED_TOLERANCE = STEP * 100

export const bytesOf = (hex: string): number[] => {
  const digits = hex.replace(/^0x/, '')
  const bytes: number[] = []

  for (let offset = 0; offset + 1 < digits.length; offset += 2) bytes.push(parseInt(digits.slice(offset, offset + 2), 16))

  return bytes
}

export const turnsAndLength = (segments: number[]): { turns: number; lengthM: number } => {
  let turns = 0
  let lengthM = 0

  for (const segment of segments) {
    if (segment >> 4) turns++

    lengthM += (segment & 15) * STEP
  }

  return { turns, lengthM }
}

export function walk(segments: number[]): { xCoordinates: number[]; yCoordinates: number[]; closed: boolean } {
  const xCoordinates = [0]
  const yCoordinates = [0]
  let heading = 0

  for (const segment of segments) {
    heading = (((heading + HEADING_STEPS_BY_TURN[segment >> 4]) % HEADING_COUNT) + HEADING_COUNT) % HEADING_COUNT
    const length = (segment & 15) * STEP
    xCoordinates.push(xCoordinates[xCoordinates.length - 1] + HEADING_VECTORS[heading][0] * length)
    yCoordinates.push(yCoordinates[yCoordinates.length - 1] + HEADING_VECTORS[heading][1] * length)
  }

  const last = segments.length
  const closed = Math.abs(xCoordinates[last] - xCoordinates[0]) <= CLOSED_TOLERANCE && Math.abs(yCoordinates[last] - yCoordinates[0]) <= CLOSED_TOLERANCE

  return { xCoordinates, yCoordinates, closed }
}

type Point = [number, number]

const midpoint = (from: Point, to: Point): Point => [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]

const quadraticCurve = (start: Point, control: Point, end: Point, pointCount = 8): number[][] => {
  const curve: number[][] = []

  for (let pointIndex = 1; pointIndex <= pointCount; pointIndex++) {
    const along = pointIndex / pointCount
    const remaining = 1 - along
    curve.push([
      Math.round(remaining * remaining * start[0] + 2 * remaining * along * control[0] + along * along * end[0]),
      Math.round(remaining * remaining * start[1] + 2 * remaining * along * control[1] + along * along * end[1]),
    ])
  }

  return curve
}

export function layoutPath(segments: number[], width = 1920, height = 1080, margin = 150): { path: number[][]; closed: boolean } {
  const { xCoordinates, yCoordinates, closed } = walk(segments)
  const minX = Math.min(...xCoordinates)
  const maxX = Math.max(...xCoordinates)
  const minY = Math.min(...yCoordinates)
  const maxY = Math.max(...yCoordinates)
  const spanX = Math.max(maxX - minX, 1)
  const spanY = Math.max(maxY - minY, 1)
  const scale = Math.min((width - 2 * margin) / spanX, (height - 2 * margin) / spanY)
  const offsetX = margin + (width - 2 * margin - spanX * scale) / 2
  const offsetY = margin + (height - 2 * margin - spanY * scale) / 2
  const vertices = xCoordinates.map((x, vertexIndex) => [Math.round(offsetX + (x - minX) * scale), Math.round(offsetY + (yCoordinates[vertexIndex] - minY) * scale)] as Point)
  const vertexCount = vertices.length
  const path: number[][] = []

  if (closed && vertexCount > 3) {
    const loopLength = vertexCount - 1
    let current = midpoint(vertices[loopLength - 1], vertices[0])
    path.push([Math.round(current[0]), Math.round(current[1])])

    for (let vertexIndex = 0; vertexIndex < loopLength; vertexIndex++) {
      const next = midpoint(vertices[vertexIndex], vertices[(vertexIndex + 1) % loopLength])
      path.push(...quadraticCurve(current, vertices[vertexIndex], next))
      current = next
    }

    path.pop()

    return { path, closed: true }
  }

  path.push(vertices[0])

  if (vertexCount === 2) return { path: [vertices[0], vertices[1]], closed: false }

  let current = midpoint(vertices[0], vertices[1])
  path.push([Math.round(current[0]), Math.round(current[1])])

  for (let vertexIndex = 1; vertexIndex < vertexCount - 1; vertexIndex++) {
    const next = midpoint(vertices[vertexIndex], vertices[vertexIndex + 1])
    path.push(...quadraticCurve(current, vertices[vertexIndex], next))
    current = next
  }

  path.push(vertices[vertexCount - 1])

  return { path, closed: false }
}

export const sectorsOf = (points: number): number[] => [Math.round(points * 0.33), Math.round(points * 0.66), points - 1]

export function profileOf(turns: number, lengthM: number): TrackProfile {
  const turnsPerKilometre = turns / Math.max(lengthM / 1000, 0.1)
  const roundToThousandths = (value: number) => Math.round(value * 1000) / 1000
  const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

  return {
    speed: roundToThousandths(clamp(1.1 - 0.09 * turnsPerKilometre, 0.5, 1.1)),
    weight: roundToThousandths(clamp(0.07 + 0.1 * turnsPerKilometre, 0.2, 1)),
    boost: 1,
    lapTicks: Math.round(clamp(lengthM / 51.4, 20, 80)),
  }
}
