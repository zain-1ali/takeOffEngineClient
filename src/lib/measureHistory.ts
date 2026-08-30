import type { MeasureAreaParent } from './measureAreaParents'
import type { MeasureSessionOverlay } from './measureSessionOverlays'

export const MEASURE_HISTORY_LIMIT = 40

export type MeasureHistorySnapshot = {
  overlays: MeasureSessionOverlay[]
  geometry: Record<string, unknown>
  count: number
  areaParents: MeasureAreaParent[]
  deductionParentId: string
}

export type MeasureHistoryEntry = {
  label: string
  before: MeasureHistorySnapshot
  after: MeasureHistorySnapshot
}

export type MeasureHistoryState = {
  undo: MeasureHistoryEntry[]
  redo: MeasureHistoryEntry[]
}

export function emptyMeasureHistory(): MeasureHistoryState {
  return { undo: [], redo: [] }
}

function clonePoints(
  points: MeasureSessionOverlay['points'],
): MeasureSessionOverlay['points'] {
  return points.map((p) => ({ x: p.x, y: p.y }))
}

export function cloneMeasureOverlays(
  overlays: readonly MeasureSessionOverlay[],
): MeasureSessionOverlay[] {
  return overlays.map((o) => ({
    ...o,
    points: clonePoints(o.points),
  }))
}

export function cloneAreaParents(
  parents: readonly MeasureAreaParent[],
): MeasureAreaParent[] {
  return parents.map((p) => ({
    ...p,
    deductions: p.deductions.map((d) => ({ ...d })),
  }))
}

export function cloneGeometry(
  geometry: Record<string, unknown>,
): Record<string, unknown> {
  return structuredClone(geometry)
}

export function captureMeasureSnapshot(args: {
  overlays: readonly MeasureSessionOverlay[]
  geometry: Record<string, unknown>
  count: number
  areaParents: readonly MeasureAreaParent[]
  deductionParentId: string
}): MeasureHistorySnapshot {
  return {
    overlays: cloneMeasureOverlays(args.overlays),
    geometry: cloneGeometry(args.geometry),
    count: args.count,
    areaParents: cloneAreaParents(args.areaParents),
    deductionParentId: args.deductionParentId,
  }
}

export function snapshotsEqual(
  a: MeasureHistorySnapshot,
  b: MeasureHistorySnapshot,
): boolean {
  return (
    a.count === b.count &&
    a.deductionParentId === b.deductionParentId &&
    JSON.stringify(a.overlays) === JSON.stringify(b.overlays) &&
    JSON.stringify(a.areaParents) === JSON.stringify(b.areaParents) &&
    JSON.stringify(a.geometry) === JSON.stringify(b.geometry)
  )
}

export function pushMeasureHistory(
  state: MeasureHistoryState,
  entry: MeasureHistoryEntry,
): MeasureHistoryState {
  if (snapshotsEqual(entry.before, entry.after)) return state
  const undo = [...state.undo, entry]
  while (undo.length > MEASURE_HISTORY_LIMIT) undo.shift()
  return { undo, redo: [] }
}

export function undoMeasureHistory(
  state: MeasureHistoryState,
  current: MeasureHistorySnapshot,
): { state: MeasureHistoryState; restore: MeasureHistorySnapshot } | null {
  const entry = state.undo[state.undo.length - 1]
  if (!entry) return null
  return {
    state: {
      undo: state.undo.slice(0, -1),
      redo: [
        ...state.redo,
        { label: entry.label, before: entry.before, after: current },
      ],
    },
    restore: entry.before,
  }
}

export function redoMeasureHistory(
  state: MeasureHistoryState,
  current: MeasureHistorySnapshot,
): { state: MeasureHistoryState; restore: MeasureHistorySnapshot } | null {
  const entry = state.redo[state.redo.length - 1]
  if (!entry) return null
  return {
    state: {
      undo: [
        ...state.undo,
        { label: entry.label, before: current, after: entry.after },
      ],
      redo: state.redo.slice(0, -1),
    },
    restore: entry.after,
  }
}
