/**
 * Plan-traceable fields for schedule Measure sessions.
 * Approved: plan footprint/run/count only — no depths, rebar, specs, or calc outputs.
 */

export type MeasureMode =
  | 'LINEAR'
  | 'POLYLINE'
  | 'CURVED_PATH'
  | 'AREA'
  | 'RECTANGLE'
  | 'CIRCLE'
  | 'ARC'
  | 'ANGLE'
  | 'DEDUCTION'
  | 'COUNT'

export type MeasureTarget =
  | {
      /** Row quantity `count` (No.) */
      kind: 'count'
      id: string
      label: string
      defaultMode: 'COUNT'
    }
  | {
      kind: 'geometry'
      id: string
      label: string
      /** Single geometry key */
      key: string
      defaultMode: MeasureMode
    }
  | {
      kind: 'geometryPair'
      id: string
      label: string
      /** Filled together in AREA mode (first ← longer/horizontal, second ← shorter/vertical). */
      keys: [string, string]
      labels: [string, string]
      defaultMode: 'AREA'
    }

type ShapeMap = Record<string, MeasureTarget[]>

function countTarget(label = 'No.'): MeasureTarget {
  return { kind: 'count', id: 'count', label, defaultMode: 'COUNT' }
}

function geo(
  key: string,
  label: string,
  defaultMode: MeasureMode = 'LINEAR',
): MeasureTarget {
  return { kind: 'geometry', id: key, label, key, defaultMode }
}

function pair(
  id: string,
  keyA: string,
  labelA: string,
  keyB: string,
  labelB: string,
): MeasureTarget {
  return {
    kind: 'geometryPair',
    id,
    label: `${labelA} + ${labelB}`,
    keys: [keyA, keyB],
    labels: [labelA, labelB],
    defaultMode: 'AREA',
  }
}

const PAD: ShapeMap = {
  RECTANGULAR: [pair('lw', 'length', 'L', 'width', 'W'), countTarget()],
  STEPPED: [
    pair('lw', 'length', 'L', 'width', 'W'),
    geo('stepLength', 'Ls'),
    geo('stepWidth', 'Ws'),
    countTarget(),
  ],
  SLOPED_PYRAMIDAL: [
    pair('lw', 'length', 'L', 'width', 'W'),
    geo('slopePeakLength', 'Lp'),
    geo('slopePeakWidth', 'Wp'),
    countTarget(),
  ],
}

const STRIP: ShapeMap = {
  FLAT: [pair('lw', 'length', 'L', 'width', 'W'), countTarget()],
  TAPERED: [
    geo('length', 'L'),
    geo('baseWidth', 'Wb'),
    geo('topWidth', 'Wt'),
    countTarget(),
  ],
  STEPPED: [
    geo('length', 'L'),
    geo('baseWidth', 'W1'),
    geo('upperWidth', 'W2'),
    countTarget(),
  ],
}

const RAFT: ShapeMap = {
  MONOLITHIC: [pair('lw', 'length', 'L', 'width', 'W'), countTarget()],
  THICKENED_EDGE: [
    pair('lw', 'length', 'L', 'width', 'W'),
    geo('edgeWidth', 'Edge W'),
    countTarget(),
  ],
}

const PILE_CAP: ShapeMap = {
  RECTANGULAR: [
    pair('lw', 'length', 'L', 'width', 'W'),
    geo('pileCount', 'Piles', 'COUNT'),
    countTarget(),
  ],
  TRIANGULAR: [
    pair('baseHt', 'triangleBase', 'Base', 'triangleHeight', 'Ht'),
    geo('pileCount', 'Piles', 'COUNT'),
    countTarget(),
  ],
  HEXAGONAL: [
    geo('hexSide', 'Side'),
    geo('pileCount', 'Piles', 'COUNT'),
    countTarget(),
  ],
  TRAPEZOIDAL: [
    geo('length', 'L'),
    geo('baseWidth', 'Wb'),
    geo('topWidth', 'Wt'),
    geo('pileCount', 'Piles', 'COUNT'),
    countTarget(),
  ],
}

const TRACEABLE_BY_ELEMENT: Record<string, ShapeMap | MeasureTarget[]> = {
  PAD_FOOTING: PAD,
  STRIP_FOOTING: STRIP,
  STONE_STRIP: STRIP,
  RAFT,
  PILE_CAP,
  PILES: [countTarget()],
  EARTHWORKS: {
    ISOLATED_PIT: [pair('lw', 'length', 'L', 'width', 'W'), countTarget()],
    BULK_BASIN: [pair('lw', 'length', 'L', 'width', 'W'), countTarget()],
    LINEAR_TRENCH: [
      geo('length', 'L'),
      geo('trenchWidth', 'W'),
      countTarget(),
    ],
  },
  COLUMNS: [countTarget()],
  BEAMS: {
    RECTANGULAR: [geo('spanLength', 'Span'), countTarget()],
    GROUND_TIE: [geo('spanLength', 'Span'), countTarget()],
    T_SECTION: [geo('spanLength', 'Span'), countTarget()],
    L_SECTION: [geo('spanLength', 'Span'), countTarget()],
    CANTILEVER_TAPERED: [geo('spanLength', 'Span'), countTarget()],
  },
  WALLS: {
    LINEAR: [geo('length', 'L'), geo('thickness', 'T'), countTarget()],
    CURVED: [countTarget()],
  },
  SLABS: {
    FLAT: [pair('lw', 'length', 'L', 'width', 'W'), countTarget()],
    SLOPED: [pair('lw', 'length', 'L', 'width', 'W'), countTarget()],
    WAFFLE: [pair('lw', 'length', 'L', 'width', 'W'), countTarget()],
    DROP_PANEL: [
      pair('lw', 'length', 'L', 'width', 'W'),
      geo('dropLength', 'Drop L'),
      geo('dropWidth', 'Drop W'),
      countTarget(),
    ],
  },
  STAIRS: {
    STRAIGHT: [geo('run', 'Run'), geo('width', 'W'), countTarget()],
    WINDER: [geo('width', 'W'), countTarget()],
    SPIRAL: [geo('width', 'W'), countTarget()],
  },
  RAMPS: {
    RECTANGULAR_INCLINE: [
      geo('horizontalRun', 'Run'),
      geo('width', 'W'),
      countTarget(),
    ],
    HELICAL: [geo('width', 'W'), countTarget()],
  },
  MASONRY: {
    LINEAR: [geo('wallLength', 'Len'), countTarget()],
  },
  DOORS_WINDOWS: {
    UNIT: [
      pair('wh', 'width', 'W', 'height', 'H'),
      countTarget(),
    ],
  },
  LINTELS: {
    PRECAST: [geo('clearSpan', 'Clear'), countTarget()],
    INSITU: [geo('clearSpan', 'Clear'), countTarget()],
  },
  FLOOR_FINISH: {
    AREA: [
      pair('lw', 'roomLength', 'L', 'roomWidth', 'W'),
      countTarget(),
    ],
  },
  CEILING_FINISH: {
    AREA: [
      pair('lw', 'roomLength', 'L', 'roomWidth', 'W'),
      countTarget(),
    ],
  },
  WALL_FINISH: {
    AREA: [geo('wallLength', 'Len'), countTarget()],
  },
  SKIRTING: {
    RUN: [
      pair('lw', 'roomLength', 'L', 'roomWidth', 'W'),
      countTarget(),
    ],
  },
  DUCTS: [geo('length', 'Len'), countTarget()],
  DUCT_FITTINGS: [countTarget()],
  PIPES: [geo('length', 'Len'), countTarget()],
  ELECTRICAL: {
    CONDUIT: [geo('length', 'Len'), countTarget()],
    TRAY: [geo('length', 'Len'), countTarget()],
    CABLE: [geo('length', 'Len'), countTarget()],
  },
}

/** Checklist items for one schedule row (element + shape). Empty = Measure N/A. */
export function getMeasureTargets(
  elementKey: string,
  shape: string,
): MeasureTarget[] {
  const entry = TRACEABLE_BY_ELEMENT[elementKey]
  if (!entry) return []
  if (Array.isArray(entry)) return entry
  return entry[shape] ?? entry[Object.keys(entry)[0] ?? ''] ?? []
}

/**
 * Resolve which measure target owns a schedule field key (`count` or geometry key).
 * For pairs, `clickedKey` is the member the user clicked (e.g. `length` for L).
 */
export type FieldMeasureFocus = {
  target: MeasureTarget
  /** For geometryPair: which side was clicked. */
  clickedKey?: string
  clickedLabel?: string
}

export function resolveFieldMeasureFocus(
  elementKey: string,
  shape: string,
  fieldKey: string,
): FieldMeasureFocus | null {
  const targets = getMeasureTargets(elementKey, shape)
  for (const target of targets) {
    if (target.kind === 'count' && fieldKey === 'count') {
      return { target }
    }
    if (target.kind === 'geometry' && target.key === fieldKey) {
      return { target }
    }
    if (target.kind === 'geometryPair') {
      const idx = target.keys.indexOf(fieldKey)
      if (idx >= 0) {
        return {
          target,
          clickedKey: fieldKey,
          clickedLabel: target.labels[idx],
        }
      }
    }
  }
  return null
}

export function isTraceableScheduleField(
  elementKey: string,
  shape: string,
  fieldKey: string,
): boolean {
  return resolveFieldMeasureFocus(elementKey, shape, fieldKey) != null
}

export function measureTargetFilled(
  target: MeasureTarget,
  geometry: Record<string, unknown> | null | undefined,
  count: number,
): boolean {
  if (target.kind === 'count') {
    return Number.isFinite(count) && count >= 1
  }
  const geo = geometry ?? {}
  if (target.kind === 'geometry') {
    const v = geo[target.key]
    return v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0
  }
  const a = geo[target.keys[0]]
  const b = geo[target.keys[1]]
  return (
    a != null &&
    a !== '' &&
    b != null &&
    b !== '' &&
    Number.isFinite(Number(a)) &&
    Number.isFinite(Number(b)) &&
    Number(a) > 0 &&
    Number(b) > 0
  )
}
