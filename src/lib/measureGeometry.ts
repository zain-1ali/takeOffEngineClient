import {
  arcFrom3Points,
  bezierLengthPx,
  circleAreaPx2,
  circleFrom3Points,
  circleFromCenterRadius,
  polygonAreaPx2,
  polygonPerimeterPx,
  segmentLengthPx,
  toRealArea,
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

/** Closed polygon perimeter in metres (same edge cycle as shoelace). */
export function perimeterMetres(
  points: readonly ImagePoint[],
  calibrationScale: number,
  calibrationUnit: string | null | undefined,
): number | null {
  if (points.length < 3 || !(calibrationScale > 0)) return null
  const px = polygonPerimeterPx(points)
  if (!(px > 0)) return null
  return round3(lengthToMetres(toRealLength(px, calibrationScale), calibrationUnit))
}

/** Convert calibrated area into m². */
export function areaToMetres2(
  value: number,
  unit: string | null | undefined,
): number {
  const u = (unit || 'm').toLowerCase()
  if (u === 'ft' || u === 'feet') return value * 0.3048 * 0.3048
  if (u === 'in' || u === 'inch' || u === 'inches') return value * 0.0254 * 0.0254
  return value
}

/**
 * Full-circle area in m² from center+rim (2 pts) or 3 circumference points.
 */
export function circleAreaMetres2(
  points: readonly ImagePoint[],
  calibrationScale: number,
  calibrationUnit: string | null | undefined,
): number | null {
  if (!(calibrationScale > 0)) return null
  const solved =
    points.length >= 3
      ? circleFrom3Points(points[0], points[1], points[2])
      : points.length >= 2
        ? circleFromCenterRadius(points[0], points[1])
        : null
  if (!solved) return null
  const areaPx2 = circleAreaPx2(solved.radiusPx)
  const areaReal = toRealArea(areaPx2, calibrationScale)
  return round3(areaToMetres2(areaReal, calibrationUnit))
}

/** Radius in metres for a solved circle (2- or 3-point). */
export function circleRadiusMetres(
  points: readonly ImagePoint[],
  calibrationScale: number,
  calibrationUnit: string | null | undefined,
): number | null {
  if (!(calibrationScale > 0)) return null
  const solved =
    points.length >= 3
      ? circleFrom3Points(points[0], points[1], points[2])
      : points.length >= 2
        ? circleFromCenterRadius(points[0], points[1])
        : null
  if (!solved) return null
  return round3(
    lengthToMetres(toRealLength(solved.radiusPx, calibrationScale), calibrationUnit),
  )
}

/** Arc length in metres from start → through → end. */
export function arcLengthMetres(
  points: readonly ImagePoint[],
  calibrationScale: number,
  calibrationUnit: string | null | undefined,
): number | null {
  if (points.length < 3 || !(calibrationScale > 0)) return null
  const arc = arcFrom3Points(points[0], points[1], points[2])
  if (!arc) return null
  return round3(
    lengthToMetres(toRealLength(arc.lengthPx, calibrationScale), calibrationUnit),
  )
}

/** Polygon area in m² (shoelace × scale²). */
export function polygonAreaMetres2(
  points: readonly ImagePoint[],
  calibrationScale: number,
  calibrationUnit: string | null | undefined,
): number | null {
  if (points.length < 3 || !(calibrationScale > 0)) return null
  const areaPx2 = polygonAreaPx2(points)
  if (!(areaPx2 > 0)) return null
  return round3(
    areaToMetres2(toRealArea(areaPx2, calibrationScale), calibrationUnit),
  )
}

/**
 * Curved-path length in metres from Bézier control clicks.
 * See bezierLengthPx for the sampling approximation note.
 */
export function curvedPathMetres(
  controls: readonly ImagePoint[],
  calibrationScale: number,
  calibrationUnit: string | null | undefined,
  sampleCount = 64,
): number | null {
  if (controls.length < 2 || !(calibrationScale > 0)) return null
  const px = bezierLengthPx(controls, sampleCount)
  if (!(px > 0)) return null
  return round3(
    lengthToMetres(toRealLength(px, calibrationScale), calibrationUnit),
  )
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
