import type { ImagePoint } from './measurementMath'

/** Darker orange for plan overlays — readable on white PDFs. */
export const MEASURE_OVERLAY_COLOR = '#c2410c'

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
  /** Value shown on the card (e.g. "12.40 m", "4"). */
  valueLabel: string
  points: ImagePoint[]
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
