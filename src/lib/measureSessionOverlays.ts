import type { ImagePoint } from './measurementMath'
import { LAYER_PALETTE_SWATCHES } from './layerColorPalette'

/** @deprecated Prefer nextMeasureOverlayColor — kept for call sites expecting a default. */
export const MEASURE_OVERLAY_COLOR = LAYER_PALETTE_SWATCHES[13] // #c2410c

/** Image-space nudge when pasting a duplicated measurement. */
export const MEASURE_PASTE_OFFSET_PX = 48

/** Next distinct overlay color from the shared Layers palette. */
export function nextMeasureOverlayColor(existingOverlayCount: number): string {
  const i =
    ((existingOverlayCount % LAYER_PALETTE_SWATCHES.length) +
      LAYER_PALETTE_SWATCHES.length) %
    LAYER_PALETTE_SWATCHES.length
  return LAYER_PALETTE_SWATCHES[i]
}

export type MeasureOverlayKind =
  | 'LINEAR'
  | 'AREA'
  | 'COUNT'
  | 'CIRCLE'
  | 'ANGLE'
  | 'CURVED'
  | 'DEDUCTION'

export type MeasureSessionOverlay = {
  id: string
  kind: MeasureOverlayKind
  /** User-editable display name. */
  name: string
  /** Primary value (e.g. area "12.40 m²", length "4.20 m", count "3"). */
  valueLabel: string
  /**
   * Closed perimeter for AREA / RECTANGLE (and circumference for CIRCLE).
   * Shown as its own labeled field — not merged into valueLabel.
   */
  perimeterLabel?: string | null
  points: ImagePoint[]
  /** Stroke/fill from LAYER_PALETTE_SWATCHES (or user override). */
  color: string
  visible: boolean
}

/** Snapshot for copy/paste — value + geometry, not a live link to the source. */
export type MeasureClipboard = {
  kind: MeasureOverlayKind
  valueLabel: string
  perimeterLabel: string | null
  points: ImagePoint[]
  /** Name of the source measurement (used to build “(copy)” labels). */
  sourceName: string
}

export function defaultOverlayName(
  kind: MeasureOverlayKind,
  index: number,
): string {
  const labels: Record<MeasureOverlayKind, string> = {
    LINEAR: 'Linear',
    AREA: 'Area',
    COUNT: 'Count',
    CIRCLE: 'Circle',
    ANGLE: 'Angle',
    CURVED: 'Curved path',
    DEDUCTION: 'Deduction',
  }
  return `${labels[kind]} ${index}`
}

/** Strip prior “(copy)” / “(copy N)” suffixes, then tag as a duplicate. */
export function duplicateOverlayName(
  sourceName: string,
  copyIndex = 1,
): string {
  const base = sourceName.replace(/\s+\(copy(?:\s+\d+)?\)\s*$/i, '').trim()
  const label = base || 'Measurement'
  return copyIndex <= 1 ? `${label} (copy)` : `${label} (copy ${copyIndex})`
}

export function snapshotOverlayForClipboard(
  overlay: MeasureSessionOverlay,
): MeasureClipboard {
  return {
    kind: overlay.kind,
    valueLabel: overlay.valueLabel,
    perimeterLabel: overlay.perimeterLabel ?? null,
    points: overlay.points.map((p) => ({ ...p })),
    sourceName: overlay.name,
  }
}

/** Independent duplicate: same value/type, points nudged — not live-linked. */
export function pasteOverlayFromClipboard(
  clipboard: MeasureClipboard,
  existingOverlayCount: number,
  copyIndex: number,
  newId: string,
): MeasureSessionOverlay {
  const dx = MEASURE_PASTE_OFFSET_PX * copyIndex
  const dy = MEASURE_PASTE_OFFSET_PX * copyIndex
  return {
    id: newId,
    kind: clipboard.kind,
    name: duplicateOverlayName(clipboard.sourceName, copyIndex),
    valueLabel: clipboard.valueLabel,
    perimeterLabel: clipboard.perimeterLabel,
    points: clipboard.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    color: nextMeasureOverlayColor(existingOverlayCount),
    visible: true,
  }
}

export function overlayKindFromMeasure(
  type: string,
  mode?: string,
): MeasureOverlayKind {
  if (type === 'COUNT' || mode === 'COUNT') return 'COUNT'
  if (type === 'CIRCLE' || mode === 'CIRCLE') return 'CIRCLE'
  if (type === 'ANGLE' || mode === 'ANGLE') return 'ANGLE'
  if (type === 'CURVED_PATH' || mode === 'CURVED_PATH') return 'CURVED'
  if (type === 'DEDUCTION' || mode === 'DEDUCTION') return 'DEDUCTION'
  if (type === 'AREA' || mode === 'AREA' || mode === 'RECTANGLE') return 'AREA'
  if (type === 'ARC' || mode === 'ARC') return 'CURVED'
  return 'LINEAR'
}
