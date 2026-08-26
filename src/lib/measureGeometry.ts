import {
  segmentLengthPx,
  toRealLength,
  type ImagePoint,
} from './measurementMath'

/** Convert a calibrated real-world length into metres (schedule geometry units). */
export function lengthToMetres(value: number, unit: string | null | undefined): number {
  const u = (unit || 'm').toLowerCase()
  if (u === 'ft' || u === 'feet') return value * 0.3048
  if (u === 'in' || u === 'inch' || u === 'inches') return value * 0.0254
  return value
}

/**
 * Extract the two plan side lengths (px) from a traced polygon.
 * For a 4-corner rectangle uses adjacent edges; otherwise axis-aligned bounds.
 */
export function polygonSideLengthsPx(
  points: readonly ImagePoint[],
): { aPx: number; bPx: number } | null {
  if (points.length < 3) return null

  if (points.length >= 4) {
    const quad = points.slice(0, 4)
    const aPx = segmentLengthPx(quad[0], quad[1])
    const bPx = segmentLengthPx(quad[1], quad[2])
    if (aPx > 0 && bPx > 0) return { aPx, bPx }
  }

  let minX = points[0].x
  let maxX = points[0].x
  let minY = points[0].y
  let maxY = points[0].y
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const aPx = Math.abs(maxX - minX)
  const bPx = Math.abs(maxY - minY)
  if (!(aPx > 0) || !(bPx > 0)) return null
  return { aPx, bPx }
}

/** Real-world side lengths in metres for an AREA pair fill. */
export function polygonPairMetres(
  points: readonly ImagePoint[],
  calibrationScale: number,
  calibrationUnit: string | null | undefined,
): { a: number; b: number } | null {
  const sides = polygonSideLengthsPx(points)
  if (!sides || !(calibrationScale > 0)) return null
  const aReal = toRealLength(sides.aPx, calibrationScale)
  const bReal = toRealLength(sides.bPx, calibrationScale)
  return {
    a: round3(lengthToMetres(aReal, calibrationUnit)),
    b: round3(lengthToMetres(bReal, calibrationUnit)),
  }
}

export function linearMetres(
  points: readonly ImagePoint[],
  calibrationScale: number,
  calibrationUnit: string | null | undefined,
): number | null {
  if (points.length < 2 || !(calibrationScale > 0)) return null
  let px = 0
  for (let i = 0; i < points.length - 1; i += 1) {
    px += segmentLengthPx(points[i], points[i + 1])
  }
  if (!(px > 0)) return null
  return round3(lengthToMetres(toRealLength(px, calibrationScale), calibrationUnit))
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
