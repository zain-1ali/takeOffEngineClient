import type {
  FieldMeasureFocus,
  MeasureTarget,
} from '../constants/measureTraceableFields'

export type MeasurementFieldPatch = {
  geometry?: Record<string, unknown>
  count?: number
}

export type PairFillMode = 'single' | 'both'

/**
 * Route a measured scalar length/radius/angle to the schedule field that
 * launched the session. For a pair, the clicked member is always the target;
 * a scalar measurement must never be misinterpreted as a two-dimension area.
 */
export function scalarPatchForFocus(
  focus: FieldMeasureFocus,
  value: number,
): MeasurementFieldPatch | null {
  if (focus.target.kind === 'geometry') {
    return { geometry: { [focus.target.key]: value } }
  }
  if (focus.target.kind === 'geometryPair' && focus.clickedKey) {
    return { geometry: { [focus.clickedKey]: value } }
  }
  return null
}

/** Route accumulated count clicks to row count or a count-like geometry key. */
export function countPatchForTarget(
  target: MeasureTarget,
  value: number,
): MeasurementFieldPatch | null {
  if (target.kind === 'count') return { count: value }
  if (target.kind === 'geometry') {
    return { geometry: { [target.key]: value } }
  }
  return null
}

/**
 * Route area/rectangle side lengths. In "both" mode both pair fields are
 * populated; in "single" mode only the field that opened the session changes.
 */
export function areaDimensionPatchForFocus(
  focus: FieldMeasureFocus,
  pairFill: PairFillMode,
  sides: { a: number; b: number },
): MeasurementFieldPatch | null {
  const { target, clickedKey } = focus
  if (target.kind === 'geometryPair') {
    if (pairFill === 'both') {
      return {
        geometry: {
          [target.keys[0]]: sides.a,
          [target.keys[1]]: sides.b,
        },
      }
    }
    if (!clickedKey) return null
    const sideIndex = target.keys.indexOf(clickedKey)
    return {
      geometry: {
        [clickedKey]: sideIndex === 1 ? sides.b : sides.a,
      },
    }
  }
  if (target.kind === 'geometry') {
    return { geometry: { [target.key]: Math.max(sides.a, sides.b) } }
  }
  return null
}
