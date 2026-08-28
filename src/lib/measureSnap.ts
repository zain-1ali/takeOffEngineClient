import type OpenSeadragon from 'openseadragon'
import {
  elementPixelToImagePoint,
  imagePointToScreenPoint,
  type ImagePoint,
} from './osdCoordinates'
import type { MeasureSessionOverlay } from './measureSessionOverlays'
import { detectLocalCorners } from './sheetCornerDetect'

/** Screen-pixel snap radius — zoom-independent (distance measured in CSS px). */
export const MEASURE_SNAP_RADIUS_PX = 12

export type MeasureSnapKind = 'vertex' | 'corner' | 'intersection'

export type MeasureSnapResult = {
  point: ImagePoint
  snapped: boolean
  kind: MeasureSnapKind | null
}

/**
 * Vertices eligible for snap-to-point:
 * - all vertices from visible session overlays (prior traces on this sheet)
 * - current draft vertices except the last (avoid sticky self-snap while extending)
 */
export function collectMeasureSnapCandidates(
  overlays: readonly MeasureSessionOverlay[],
  draftPoints: readonly ImagePoint[],
): ImagePoint[] {
  const out: ImagePoint[] = []
  for (const overlay of overlays) {
    if (!overlay.visible) continue
    for (const p of overlay.points) {
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) out.push(p)
    }
  }
  const draftLimit = Math.max(0, draftPoints.length - 1)
  for (let i = 0; i < draftLimit; i += 1) {
    const p = draftPoints[i]
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) out.push(p)
  }
  return out
}

/** Convert a screen-pixel length to image pixels at the current zoom. */
export function screenPxToImagePx(
  viewer: OpenSeadragon.Viewer,
  screenPx: number,
): number {
  const a = elementPixelToImagePoint(viewer, 0, 0)
  const b = elementPixelToImagePoint(viewer, screenPx, 0)
  const d = Math.hypot(b.x - a.x, b.y - a.y)
  return d > 1e-6 ? d : 1
}

/**
 * Nearest candidate within `thresholdPx` in **screen** space (consistent at any zoom).
 */
export function findNearestSnapPoint(
  viewer: OpenSeadragon.Viewer,
  cursorImage: ImagePoint,
  candidates: readonly ImagePoint[],
  thresholdPx: number = MEASURE_SNAP_RADIUS_PX,
): ImagePoint | null {
  if (candidates.length === 0) return null
  const cursorScreen = imagePointToScreenPoint(viewer, cursorImage)
  let best: ImagePoint | null = null
  let bestDist = thresholdPx
  for (const candidate of candidates) {
    const screen = imagePointToScreenPoint(viewer, candidate)
    const d = Math.hypot(screen.x - cursorScreen.x, screen.y - cursorScreen.y)
    if (d <= bestDist) {
      bestDist = d
      best = candidate
    }
  }
  return best
}

/**
 * Resolve click/cursor with snap lock.
 * Priority: prior traced vertices → PDF artwork corners / line intersections.
 */
export function applyMeasureSnap(
  viewer: OpenSeadragon.Viewer,
  rawImage: ImagePoint,
  overlays: readonly MeasureSessionOverlay[],
  draftPoints: readonly ImagePoint[],
  thresholdPx: number = MEASURE_SNAP_RADIUS_PX,
  sheetImage?: CanvasImageSource & { width: number; height: number } | null,
): MeasureSnapResult {
  const vertex = findNearestSnapPoint(
    viewer,
    rawImage,
    collectMeasureSnapCandidates(overlays, draftPoints),
    thresholdPx,
  )
  if (vertex) {
    return { point: { x: vertex.x, y: vertex.y }, snapped: true, kind: 'vertex' }
  }

  if (sheetImage) {
    const artwork = findNearestArtworkSnap(
      viewer,
      rawImage,
      sheetImage,
      thresholdPx,
    )
    if (artwork) return artwork
  }

  return { point: rawImage, snapped: false, kind: null }
}

function findNearestArtworkSnap(
  viewer: OpenSeadragon.Viewer,
  cursorImage: ImagePoint,
  sheetImage: CanvasImageSource & { width: number; height: number },
  thresholdPx: number,
): MeasureSnapResult | null {
  // Patch ≈ 2.2× snap radius in image space (clamped for perf / tiny zooms).
  const imgRadius = screenPxToImagePx(viewer, thresholdPx)
  const half = Math.round(Math.min(48, Math.max(16, imgRadius * 2.2)))
  const detected = detectLocalCorners(sheetImage, cursorImage, half)
  if (detected.length === 0) return null

  const cursorScreen = imagePointToScreenPoint(viewer, cursorImage)
  let best: (typeof detected)[0] | null = null
  let bestDist = thresholdPx
  for (const c of detected) {
    const screen = imagePointToScreenPoint(viewer, c)
    const d = Math.hypot(screen.x - cursorScreen.x, screen.y - cursorScreen.y)
    if (d <= bestDist) {
      bestDist = d
      best = c
    }
  }
  if (!best) return null
  return {
    point: { x: best.x, y: best.y },
    snapped: true,
    kind: best.source === 'intersection' ? 'intersection' : 'corner',
  }
}
