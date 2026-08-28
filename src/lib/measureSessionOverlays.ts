import type { ImagePoint } from './measurementMath'
import { LAYER_PALETTE_SWATCHES } from './layerColorPalette'

/** @deprecated Prefer nextMeasureOverlayColor — kept for call sites expecting a default. */
export const MEASURE_OVERLAY_COLOR = LAYER_PALETTE_SWATCHES[13] // #c2410c

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
