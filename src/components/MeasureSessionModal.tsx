import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchSheets, saveSheetCalibration } from '../api/sheets'
import { resolveMediaUrl } from '../lib/api'
import { computeCalibrationScale } from '../lib/osdCoordinates'
import {
  arcLengthMetres,
  circleAreaMetres2,
  circleRadiusMetres,
  curvedPathMetres,
  linearMetres,
  perimeterMetres,
  polygonAreaMetres2,
  polygonPairMetres,
} from '../lib/measureGeometry'
import { angleDegrees } from '../lib/measurementMath'
import { previewTakeoffMeasurement } from '../lib/measurementPreview'
import {
  addDeductionToParent,
  newMeasureId,
  parseMeasureAreaParents,
  parentNetM2,
  totalDeductionsM2,
  type MeasureAreaParent,
} from '../lib/measureAreaParents'
import {
  defaultOverlayName,
  MEASURE_OVERLAY_COLOR,
  overlayKindFromMeasure,
  type MeasureSessionOverlay,
} from '../lib/measureSessionOverlays'
import {
  resolveFieldMeasureFocus,
  type FieldMeasureFocus,
  type MeasureMode,
  type MeasureTarget,
} from '../constants/measureTraceableFields'
import { SheetViewer } from './SheetViewer'
import { NumericInput } from './ui'
import type { ImagePoint } from '../lib/measurementMath'
import type { CalibrationUnitLabel, ViewerTool } from '../types/models'
import type { Instance } from '../types/api'

export type MeasureApplyPatch = {
  geometry?: Record<string, unknown>
  count?: number
}

/** Interaction phase: navigate first, then measure. */
type SessionPhase = 'pan' | 'measure' | 'calibrate'

/** For paired dims: fill only the clicked side, or both via Area/Rectangle. */
type PairFillMode = 'single' | 'both'

const MEASURE_MODE_OPTIONS: { value: MeasureMode; label: string }[] = [
  { value: 'LINEAR', label: 'Linear' },
  { value: 'POLYLINE', label: 'Polyline' },
  { value: 'CURVED_PATH', label: 'Curved Path' },
  { value: 'AREA', label: 'Area' },
  { value: 'RECTANGLE', label: 'Rectangle' },
  { value: 'CIRCLE', label: 'Circle' },
  { value: 'ARC', label: 'Arc' },
  { value: 'ANGLE', label: 'Angle' },
  { value: 'DEDUCTION', label: 'Deduction' },
  { value: 'COUNT', label: 'Count' },
]

function isCalibrated(sheet: {
  calibrationScale: number | null
  calibrationUnit: string | null
}): boolean {
  return (
    sheet.calibrationScale != null &&
    sheet.calibrationScale > 0 &&
    Boolean(sheet.calibrationUnit)
  )
}

function isLengthMode(mode: MeasureMode): boolean {
  return (
    mode === 'LINEAR' ||
    mode === 'POLYLINE' ||
    mode === 'CURVED_PATH' ||
    mode === 'ARC'
  )
}

function isAreaLikeMode(mode: MeasureMode): boolean {
  return mode === 'AREA' || mode === 'RECTANGLE'
}

function formatFieldValue(
  target: MeasureTarget,
  geometry: Record<string, unknown>,
  count: number,
  clickedKey?: string,
  pairFill: PairFillMode = 'both',
): string | null {
  if (target.kind === 'count') {
    return Number.isFinite(count) && count >= 1 ? String(count) : null
  }
  if (target.kind === 'geometry') {
    const v = geometry[target.key]
    if (v == null || v === '' || !Number.isFinite(Number(v))) return null
    const n = Number(v)
    if (
      target.defaultMode === 'COUNT' ||
      target.key.toLowerCase().includes('count') ||
      target.key === 'pileCount'
    ) {
      return String(Math.round(n))
    }
    return `${n.toFixed(2)} m`
  }
  if (pairFill === 'single' && clickedKey) {
    const v = geometry[clickedKey]
    if (v == null || v === '' || !Number.isFinite(Number(v))) return null
    return `${Number(v).toFixed(2)} m`
  }
  const a = geometry[target.keys[0]]
  const b = geometry[target.keys[1]]
  if (
    a == null ||
    b == null ||
    a === '' ||
    b === '' ||
    !Number.isFinite(Number(a)) ||
    !Number.isFinite(Number(b))
  ) {
    return null
  }
  return `${Number(a).toFixed(2)} × ${Number(b).toFixed(2)} m`
}

function measureToolForMode(
  mode: MeasureMode,
  circleInput: 'centerRadius' | 'threePoint',
): ViewerTool {
  if (mode === 'AREA') return 'area'
  if (mode === 'RECTANGLE') return 'measureRect'
  if (mode === 'COUNT') return 'count'
  if (mode === 'POLYLINE') return 'polyline'
  if (mode === 'CURVED_PATH') return 'curvedPath'
  if (mode === 'CIRCLE') {
    return circleInput === 'threePoint' ? 'circle3' : 'circle'
  }
  if (mode === 'ARC') return 'arc'
  if (mode === 'ANGLE') return 'angle'
  if (mode === 'DEDUCTION') return 'deduction'
  return 'linear'
}

function defaultModeForFocus(
  focus: FieldMeasureFocus,
  pairFill: PairFillMode,
): MeasureMode {
  const { target } = focus
  if (target.kind === 'count') return 'COUNT'
  if (target.kind === 'geometry') {
    if (target.defaultMode === 'AREA') return 'RECTANGLE'
    if (target.defaultMode === 'COUNT') return 'COUNT'
    return 'LINEAR'
  }
  return pairFill === 'both' ? 'RECTANGLE' : 'LINEAR'
}

function titleForFocus(focus: FieldMeasureFocus, pairFill: PairFillMode): string {
  const { target, clickedLabel } = focus
  if (target.kind === 'count') return target.label
  if (target.kind === 'geometry') return target.label
  if (pairFill === 'single' && clickedLabel) return clickedLabel
  return target.label
}

function modeHint(
  mode: MeasureMode,
  circleInput: 'centerRadius' | 'threePoint' = 'centerRadius',
): string {
  switch (mode) {
    case 'LINEAR':
      return 'Click two points'
    case 'POLYLINE':
      return 'Click points · double-click or Enter to finish'
    case 'CURVED_PATH':
      return 'Click Bézier controls · double-click or Enter to finish'
    case 'AREA':
      return 'Click corners · close near first point, double-click, or Enter'
    case 'RECTANGLE':
      return 'Click-drag opposite corner (ortho-locked)'
    case 'CIRCLE':
      return circleInput === 'threePoint'
        ? 'Click 3 points on the circumference'
        : 'Click center, then a point on the rim'
    case 'ARC':
      return 'Click start → through → end on the arc'
    case 'ANGLE':
      return 'Click vertex, then a point on each ray'
    case 'DEDUCTION':
      return 'Trace opening polygon · binds to a parent Area (subtractive)'
    case 'COUNT':
      return 'Click each occurrence'
    default:
      return ''
  }
}

function areaStatusSuffix(
  points: ImagePoint[],
  scale: number,
  unit: string | null | undefined,
): string {
  const preview = previewTakeoffMeasurement('AREA', points, scale, unit)
  const peri = perimeterMetres(points, scale, unit)
  const parts: string[] = []
  if (preview) {
    parts.push(`Area ${preview.value.toFixed(2)} ${preview.unit}`)
  }
  if (peri != null) {
    parts.push(`Perimeter ${peri.toFixed(2)} m`)
  } else if (preview?.perimeter) {
    parts.push(
      `Perimeter ${preview.perimeter.value.toFixed(2)} ${preview.perimeter.unit}`,
    )
  }
  return parts.length ? ` · ${parts.join(' · ')}` : ''
}

/**
 * Field-scoped measure modal — reuses SheetViewer + calibration + measure modes.
 * Opened from a per-field icon, not a row checklist.
 */
export function MeasureSessionModal({
  open,
  onClose,
  projectId,
  floorId,
  instance,
  fieldKey,
  onApply,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  floorId: string
  instance: Instance
  /** `count` or a geometry key from the approved traceable list. */
  fieldKey: string
  onApply: (patch: MeasureApplyPatch) => void
}) {
  const qc = useQueryClient()
  const focus = useMemo(
    () =>
      resolveFieldMeasureFocus(instance.elementKey, instance.shape, fieldKey),
    [instance.elementKey, instance.shape, fieldKey],
  )

  const [pairFill, setPairFill] = useState<PairFillMode>('both')
  const [modeOverride, setModeOverride] = useState<MeasureMode | null>(null)
  const [circleInput, setCircleInput] = useState<'centerRadius' | 'threePoint'>(
    'centerRadius',
  )
  const [areaParents, setAreaParents] = useState<MeasureAreaParent[]>([])
  const [deductionParentId, setDeductionParentId] = useState<string>('')
  const [overlays, setOverlays] = useState<MeasureSessionOverlay[]>([])
  const [countDraftPoints, setCountDraftPoints] = useState<ImagePoint[]>([])
  const [localGeo, setLocalGeo] = useState<Record<string, unknown>>(
    () => ({ ...(instance.geometry || {}) }),
  )
  const [localCount, setLocalCount] = useState(instance.count)
  const [pageIndex, setPageIndex] = useState(0)
  const [phase, setPhase] = useState<SessionPhase>('pan')
  const [calPending, setCalPending] = useState<{ pixelDistance: number } | null>(
    null,
  )
  const [calDistance, setCalDistance] = useState<number | null>(null)
  const [calUnit, setCalUnit] = useState<CalibrationUnitLabel>('m')
  const [calError, setCalError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [liveDraftMsg, setLiveDraftMsg] = useState<string | null>(null)
  const [countDraft, setCountDraft] = useState(0)

  const sheetsQuery = useQuery({
    queryKey: ['projects', projectId, 'sheets', floorId],
    queryFn: () => fetchSheets(projectId, floorId),
    enabled: open && Boolean(projectId && floorId),
    refetchInterval: (q) => {
      const sheets = q.state.data ?? []
      if (sheets.length === 0) return 2500
      return false
    },
  })

  const sheets = sheetsQuery.data ?? []
  const sheet = sheets[pageIndex] ?? sheets[0] ?? null
  const calibrated = sheet ? isCalibrated(sheet) : false

  const defaultMode = focus ? defaultModeForFocus(focus, pairFill) : 'LINEAR'
  const activeMode: MeasureMode = modeOverride ?? defaultMode
  const fieldTitle = focus ? titleForFocus(focus, pairFill) : fieldKey

  const viewerTool: ViewerTool = !calibrated
    ? phase === 'calibrate'
      ? 'calibrate'
      : 'pan'
    : phase === 'calibrate'
      ? 'calibrate'
      : phase === 'pan'
        ? 'pan'
        : measureToolForMode(activeMode, circleInput)

  // Reset session UI only when opening or switching row/field — not when
  // geometry patches from this modal update `instance` (that was wiping overlays).
  useEffect(() => {
    if (!open) return
    setLocalGeo({ ...(instance.geometry || {}) })
    setLocalCount(instance.count)
    setPageIndex(0)
    setCalPending(null)
    setCountDraft(0)
    setCountDraftPoints([])
    setStatusMsg(null)
    setLiveDraftMsg(null)
    setPhase('pan')
    setPairFill('both')
    setModeOverride(null)
    setCircleInput('centerRadius')
    const loaded = parseMeasureAreaParents(
      instance.geometry?.measureAreaParents,
    )
    setAreaParents(loaded)
    setDeductionParentId(loaded[0]?.id ?? '')
    setOverlays([])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: geometry/count sync only on open/row change
  }, [open, instance.id, fieldKey])

  // Keep local geo/count in sync if parent refreshes the same row without remounting.
  useEffect(() => {
    if (!open) return
    setLocalGeo({ ...(instance.geometry || {}) })
    setLocalCount(instance.count)
  }, [open, instance.geometry, instance.count])

  useEffect(() => {
    setModeOverride(null)
  }, [pairFill])

  useEffect(() => {
    if (!open || !sheet) return
    if (!calibrated) setPhase('calibrate')
  }, [open, sheet?.id, calibrated])

  const saveCalMut = useMutation({
    mutationFn: (payload: { scale: number; unit: CalibrationUnitLabel }) =>
      saveSheetCalibration(sheet!.id, payload.scale, payload.unit),
    onSuccess: async () => {
      setCalPending(null)
      setCalDistance(null)
      setCalError(null)
      setPhase('pan')
      setStatusMsg('Calibrated — pan/zoom to the location, then tap Measure')
      await qc.invalidateQueries({
        queryKey: ['projects', projectId, 'sheets', floorId],
      })
    },
  })

  function applyPatch(patch: MeasureApplyPatch) {
    if (patch.geometry) {
      setLocalGeo((g) => ({ ...g, ...patch.geometry }))
    }
    if (patch.count != null) {
      setLocalCount(patch.count)
    }
    onApply(patch)
  }

  /** Persist parents and write net area onto areaOverride (+ openingArea sum). */
  function commitAreaParents(
    next: MeasureAreaParent[],
    extraGeometry?: Record<string, unknown>,
  ) {
    setAreaParents(next)
    if (next.length > 0) {
      setDeductionParentId((id) => id || next[0].id)
    }
    const primary = next[0]
    const geometry: Record<string, unknown> = {
      ...(extraGeometry || {}),
      measureAreaParents: next,
    }
    if (primary) {
      geometry.areaOverride = parentNetM2(primary)
      geometry.openingArea = totalDeductionsM2(primary)
    }
    applyPatch({ geometry })
  }

  function registerAreaParent(
    grossM2: number,
    kindLabel: string,
    extraGeometry?: Record<string, unknown>,
  ) {
    const n = areaParents.length + 1
    const parent: MeasureAreaParent = {
      id: newMeasureId('area'),
      label: `${kindLabel} ${n}`,
      grossM2,
      deductions: [],
    }
    const next = [...areaParents, parent]
    setDeductionParentId(parent.id)
    commitAreaParents(next, extraGeometry)
    return parent
  }

  function pushOverlay(args: {
    kind: MeasureSessionOverlay['kind']
    points: ImagePoint[]
    valueLabel: string
    name?: string
  }) {
    setOverlays((prev) => {
      const kindCount = prev.filter((o) => o.kind === args.kind).length + 1
      return [
        ...prev,
        {
          id: newMeasureId('ov'),
          kind: args.kind,
          name: args.name ?? defaultOverlayName(args.kind, kindCount),
          valueLabel: args.valueLabel,
          points: args.points.map((p) => ({ ...p })),
          color: MEASURE_OVERLAY_COLOR,
          visible: true,
        },
      ]
    })
  }

  const displayOverlays: MeasureSessionOverlay[] = useMemo(() => {
    if (countDraftPoints.length === 0) return overlays
    return [
      ...overlays,
      {
        id: '__count-draft',
        kind: 'COUNT' as const,
        name: 'Count (draft)',
        valueLabel: String(countDraftPoints.length),
        points: countDraftPoints,
        color: MEASURE_OVERLAY_COLOR,
        visible: true,
      },
    ]
  }, [overlays, countDraftPoints])

  function handleDraftMeasureChange(
    draft: {
      tool: ViewerTool
      points: ImagePoint[]
      cursor: ImagePoint | null
    } | null,
  ) {
    if (!draft || !sheet || !calibrated || phase !== 'measure') {
      setLiveDraftMsg(null)
      return
    }
    const scale = sheet.calibrationScale!
    const unit = sheet.calibrationUnit
    const pts =
      draft.cursor && draft.tool === 'polyline'
        ? [...draft.points, draft.cursor]
        : draft.points

    if (draft.tool === 'polyline' || draft.tool === 'linear') {
      const len = linearMetres(pts, scale, unit)
      if (len == null) {
        setLiveDraftMsg(
          draft.tool === 'polyline'
            ? 'Polyline — click next point (Enter or double-click to finish)'
            : null,
        )
        return
      }
      setLiveDraftMsg(
        draft.tool === 'polyline'
          ? `Polyline total ${len.toFixed(2)} m · Enter or double-click to finish`
          : `Length ${len.toFixed(2)} m`,
      )
      return
    }

    if (draft.tool === 'curvedPath') {
      const curvePts = draft.cursor
        ? [...draft.points, draft.cursor]
        : draft.points
      if (curvePts.length < 2) {
        setLiveDraftMsg(modeHint('CURVED_PATH'))
        return
      }
      const len = curvedPathMetres(curvePts, scale, unit)
      if (len == null) {
        setLiveDraftMsg('Curved path — click more controls')
        return
      }
      setLiveDraftMsg(
        `Curved path ≈ ${len.toFixed(2)} m · Enter or double-click to finish`,
      )
      return
    }

    if (
      draft.tool === 'area' ||
      draft.tool === 'measureRect' ||
      draft.tool === 'deduction'
    ) {
      const previewPts =
        draft.cursor &&
        (draft.tool === 'area' || draft.tool === 'deduction') &&
        draft.points.length >= 2
          ? [...draft.points, draft.cursor]
          : draft.points
      if (previewPts.length < 3) {
        setLiveDraftMsg(
          draft.tool === 'measureRect'
            ? 'Drag to size rectangle'
            : draft.tool === 'deduction'
              ? 'Deduction — click corners'
              : 'Area — click corners',
        )
        return
      }
      const preview = previewTakeoffMeasurement(
        'AREA',
        previewPts,
        scale,
        unit,
      )
      const peri = perimeterMetres(previewPts, scale, unit)
      if (!preview) {
        setLiveDraftMsg(null)
        return
      }
      const periPart =
        peri != null
          ? ` · Perimeter ${peri.toFixed(2)} m`
          : preview.perimeter
            ? ` · Perimeter ${preview.perimeter.value.toFixed(2)} ${preview.perimeter.unit}`
            : ''
      const prefix = draft.tool === 'deduction' ? 'Deduction ' : 'Area '
      setLiveDraftMsg(
        `${prefix}${preview.value.toFixed(2)} ${preview.unit}${periPart}`,
      )
      return
    }

    if (draft.tool === 'circle' || draft.tool === 'circle3') {
      const circlePts =
        draft.tool === 'circle' && draft.cursor && draft.points.length === 1
          ? [...draft.points, draft.cursor]
          : draft.points
      const need = draft.tool === 'circle' ? 2 : 3
      if (circlePts.length < need) {
        setLiveDraftMsg(modeHint('CIRCLE', circleInput))
        return
      }
      const area = circleAreaMetres2(circlePts, scale, unit)
      const r = circleRadiusMetres(circlePts, scale, unit)
      if (area == null || r == null) {
        setLiveDraftMsg('Could not solve circle')
        return
      }
      setLiveDraftMsg(`r=${r.toFixed(2)} m · Area ${area.toFixed(2)} m²`)
      return
    }

    if (draft.tool === 'arc') {
      const arcPts =
        draft.cursor && draft.points.length === 2
          ? [...draft.points, draft.cursor]
          : draft.points
      if (arcPts.length < 3) {
        setLiveDraftMsg(modeHint('ARC'))
        return
      }
      const len = arcLengthMetres(arcPts, scale, unit)
      if (len == null) {
        setLiveDraftMsg('Could not solve arc')
        return
      }
      setLiveDraftMsg(`Arc length ${len.toFixed(2)} m`)
      return
    }

    if (draft.tool === 'angle') {
      const anglePts =
        draft.cursor && draft.points.length === 2
          ? [...draft.points, draft.cursor]
          : draft.points
      if (anglePts.length < 3) {
        setLiveDraftMsg(modeHint('ANGLE'))
        return
      }
      const deg = angleDegrees(anglePts[0], anglePts[1], anglePts[2])
      if (deg == null) {
        setLiveDraftMsg('Could not read angle')
        return
      }
      setLiveDraftMsg(`Angle ${deg.toFixed(1)}°`)
      return
    }

    setLiveDraftMsg(null)
  }

  function handleMeasurementComplete(payload: {
    type:
      | 'LINEAR'
      | 'AREA'
      | 'COUNT'
      | 'CIRCLE'
      | 'ARC'
      | 'ANGLE'
      | 'CURVED_PATH'
      | 'DEDUCTION'
    points: ImagePoint[]
  }) {
    if (!sheet || !focus || !calibrated || phase !== 'measure') return
    const scale = sheet.calibrationScale!
    const unit = sheet.calibrationUnit
    const { target, clickedKey } = focus
    setLiveDraftMsg(null)

    if (activeMode === 'COUNT' || payload.type === 'COUNT') {
      const pt = payload.points[0]
      if (pt) {
        setCountDraftPoints((pts) => [...pts, pt])
      }
      setCountDraft((n) => {
        const next = n + 1
        setStatusMsg(
          `${next} click${next === 1 ? '' : 's'} — press Apply count to save`,
        )
        return next
      })
      return
    }

    if (payload.type === 'DEDUCTION' || activeMode === 'DEDUCTION') {
      const area = polygonAreaMetres2(payload.points, scale, unit)
      if (area == null) {
        setStatusMsg('Could not read deduction area — try again')
        return
      }
      const parentId = deductionParentId || areaParents[0]?.id
      if (!parentId) {
        setStatusMsg('Trace a parent Area / Rectangle / Circle first')
        return
      }
      const parent = areaParents.find((p) => p.id === parentId)
      if (!parent) {
        setStatusMsg('Select a parent Area for this deduction')
        return
      }
      const deduction = {
        id: newMeasureId('ded'),
        label: `Deduction ${parent.deductions.length + 1}`,
        areaM2: area,
      }
      const next = addDeductionToParent(areaParents, parentId, deduction)
      commitAreaParents(next)
      const updated = next.find((p) => p.id === parentId)!
      const net = parentNetM2(updated)
      pushOverlay({
        kind: 'DEDUCTION',
        points: payload.points,
        valueLabel: `${area.toFixed(2)} m²`,
        name: deduction.label,
      })
      setStatusMsg(
        `${updated.label}: ${updated.grossM2.toFixed(2)} − ${totalDeductionsM2(updated).toFixed(2)} = ${net.toFixed(2)} m² (Override)`,
      )
      setPhase('pan')
      return
    }

    if (payload.type === 'CURVED_PATH' || activeMode === 'CURVED_PATH') {
      const len = curvedPathMetres(payload.points, scale, unit)
      if (len == null) {
        setStatusMsg('Could not sample curved path — try again')
        return
      }
      pushOverlay({
        kind: 'CURVED',
        points: payload.points,
        valueLabel: `${len.toFixed(2)} m`,
      })
      if (target.kind === 'geometryPair' && pairFill === 'single' && clickedKey) {
        applyPatch({ geometry: { [clickedKey]: len } })
        setStatusMsg(
          `${focus.clickedLabel || clickedKey}≈${len.toFixed(2)} m (curved, sampled)`,
        )
      } else if (target.kind === 'geometry') {
        applyPatch({ geometry: { [target.key]: len } })
        setStatusMsg(`${target.label}≈${len.toFixed(2)} m (curved, sampled)`)
      } else {
        setStatusMsg(`Curved path ≈ ${len.toFixed(2)} m (sampled)`)
      }
      setPhase('pan')
      return
    }

    if (payload.type === 'CIRCLE' || activeMode === 'CIRCLE') {
      const area = circleAreaMetres2(payload.points, scale, unit)
      const r = circleRadiusMetres(payload.points, scale, unit)
      if (area == null || r == null) {
        setStatusMsg('Could not solve circle — try again')
        return
      }
      pushOverlay({
        kind: 'CIRCLE',
        points: payload.points,
        valueLabel: `${area.toFixed(2)} m²`,
      })
      if (target.kind === 'geometryPair' && pairFill === 'single' && clickedKey) {
        registerAreaParent(area, 'Circle', { [clickedKey]: r })
        setStatusMsg(
          `${focus.clickedLabel || clickedKey}=${r.toFixed(2)} m · Area ${area.toFixed(2)} m²`,
        )
      } else if (target.kind === 'geometry') {
        registerAreaParent(area, 'Circle', { [target.key]: r })
        setStatusMsg(
          `${target.label}=${r.toFixed(2)} m (radius) · Area ${area.toFixed(2)} m²`,
        )
      } else {
        registerAreaParent(area, 'Circle')
        setStatusMsg(`r=${r.toFixed(2)} m · Area ${area.toFixed(2)} m²`)
      }
      setPhase('pan')
      return
    }

    if (payload.type === 'ARC' || activeMode === 'ARC') {
      const len = arcLengthMetres(payload.points, scale, unit)
      if (len == null) {
        setStatusMsg('Could not solve arc — try again')
        return
      }
      pushOverlay({
        kind: 'CURVED',
        points: payload.points,
        valueLabel: `${len.toFixed(2)} m`,
      })
      if (target.kind === 'geometryPair' && pairFill === 'single' && clickedKey) {
        applyPatch({ geometry: { [clickedKey]: len } })
        setStatusMsg(`${focus.clickedLabel || clickedKey}=${len.toFixed(2)} m`)
      } else if (target.kind === 'geometry') {
        applyPatch({ geometry: { [target.key]: len } })
        setStatusMsg(`${target.label}=${len.toFixed(2)} m`)
      } else {
        setStatusMsg(`Arc length ${len.toFixed(2)} m`)
      }
      setPhase('pan')
      return
    }

    if (payload.type === 'ANGLE' || activeMode === 'ANGLE') {
      if (payload.points.length < 3) return
      const deg = angleDegrees(
        payload.points[0],
        payload.points[1],
        payload.points[2],
      )
      if (deg == null) {
        setStatusMsg('Could not read angle — try again')
        return
      }
      const rounded = Math.round(deg * 1000) / 1000
      pushOverlay({
        kind: 'ANGLE',
        points: payload.points,
        valueLabel: `${rounded.toFixed(1)}°`,
      })
      if (target.kind === 'geometry') {
        applyPatch({ geometry: { [target.key]: rounded } })
        setStatusMsg(`${target.label}=${rounded.toFixed(1)}°`)
      } else if (
        target.kind === 'geometryPair' &&
        pairFill === 'single' &&
        clickedKey
      ) {
        applyPatch({ geometry: { [clickedKey]: rounded } })
        setStatusMsg(`${focus.clickedLabel || clickedKey}=${rounded.toFixed(1)}°`)
      } else {
        setStatusMsg(`Angle ${rounded.toFixed(1)}°`)
      }
      setPhase('pan')
      return
    }

    if (target.kind === 'geometryPair' && pairFill === 'both') {
      const sides = polygonPairMetres(payload.points, scale, unit)
      if (!sides) {
        setStatusMsg('Could not read rectangle sides — try again')
        return
      }
      const gross =
        polygonAreaMetres2(payload.points, scale, unit) ??
        Math.round(sides.a * sides.b * 1000) / 1000
      registerAreaParent(gross, 'Area', {
        [target.keys[0]]: sides.a,
        [target.keys[1]]: sides.b,
      })
      pushOverlay({
        kind: overlayKindFromMeasure(payload.type, activeMode),
        points: payload.points,
        valueLabel: `${gross.toFixed(2)} m²`,
      })
      setStatusMsg(
        `${target.labels[0]}=${sides.a} m · ${target.labels[1]}=${sides.b} m${areaStatusSuffix(payload.points, scale, unit)}`,
      )
      setPhase('pan')
      return
    }

    if (
      target.kind === 'geometryPair' &&
      pairFill === 'single' &&
      clickedKey &&
      (isLengthMode(activeMode) || payload.type === 'LINEAR')
    ) {
      // CURVED_PATH / ARC already handled above — remaining length modes are linear.
      const len = linearMetres(payload.points, scale, unit)
      if (len == null) {
        setStatusMsg('Could not read length — try again')
        return
      }
      pushOverlay({
        kind: 'LINEAR',
        points: payload.points,
        valueLabel: `${len} m`,
      })
      applyPatch({ geometry: { [clickedKey]: len } })
      setStatusMsg(`${focus.clickedLabel || clickedKey}=${len} m`)
      setPhase('pan')
      return
    }

    if (
      target.kind === 'geometry' &&
      (isLengthMode(activeMode) || payload.type === 'LINEAR')
    ) {
      const len = linearMetres(payload.points, scale, unit)
      if (len == null) {
        setStatusMsg('Could not read length — try again')
        return
      }
      pushOverlay({
        kind: 'LINEAR',
        points: payload.points,
        valueLabel: `${len} m`,
      })
      applyPatch({ geometry: { [target.key]: len } })
      setStatusMsg(`${target.label}=${len} m`)
      setPhase('pan')
      return
    }

    if (
      target.kind === 'geometry' &&
      (isAreaLikeMode(activeMode) || payload.type === 'AREA')
    ) {
      const sides = polygonPairMetres(payload.points, scale, unit)
      if (!sides) {
        setStatusMsg('Could not read dimensions — try again')
        return
      }
      const value = Math.max(sides.a, sides.b)
      const gross =
        polygonAreaMetres2(payload.points, scale, unit) ??
        Math.round(sides.a * sides.b * 1000) / 1000
      registerAreaParent(gross, 'Area', { [target.key]: value })
      pushOverlay({
        kind: 'AREA',
        points: payload.points,
        valueLabel: `${gross.toFixed(2)} m²`,
      })
      setStatusMsg(
        `${target.label}=${value} m${areaStatusSuffix(payload.points, scale, unit)}`,
      )
      setPhase('pan')
    }
  }

  function applyCount() {
    if (!focus) return
    const n = Math.max(1, countDraft)
    if (countDraftPoints.length > 0) {
      pushOverlay({
        kind: 'COUNT',
        points: countDraftPoints,
        valueLabel: String(n),
      })
    }
    if (focus.target.kind === 'count') {
      applyPatch({ count: n })
      setStatusMsg(`No. = ${n}`)
    } else if (focus.target.kind === 'geometry') {
      applyPatch({ geometry: { [focus.target.key]: n } })
      setStatusMsg(`${focus.target.label} = ${n}`)
    }
    setCountDraft(0)
    setCountDraftPoints([])
    setPhase('pan')
  }

  function handleSaveCalibration(event: FormEvent) {
    event.preventDefault()
    if (!calPending || !sheet) return
    if (calDistance == null || !(calDistance > 0)) {
      setCalError('Enter a positive real-world distance')
      return
    }
    try {
      const scale = computeCalibrationScale(calDistance, calPending.pixelDistance)
      setCalError(null)
      saveCalMut.mutate({ scale, unit: calUnit })
    } catch (err: unknown) {
      setCalError(err instanceof Error ? err.message : 'Calibration failed')
    }
  }

  if (!open) return null

  const valueLabel = focus
    ? formatFieldValue(
        focus.target,
        localGeo,
        localCount,
        focus.clickedKey,
        pairFill,
      )
    : null

  const displayStatus = liveDraftMsg ?? statusMsg

  const toolBtn = (active: boolean) =>
    `border px-2.5 py-1 font-medium ${
      active
        ? 'border-signal bg-signal/15 text-ink'
        : 'border-steel-border text-ink hover:bg-bg'
    }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-3">
      <div className="flex h-[min(92vh,900px)] w-[min(98vw,1280px)] flex-col border border-steel-border bg-panel shadow-xl">
        <header className="flex flex-shrink-0 items-center gap-3 border-b border-steel-border px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-sm font-bold text-ink">
              Measure · {instance.mark} · {fieldTitle}
            </h2>
            <p className="text-[11px] text-steel">
              Floor {floorId}
              {valueLabel ? (
                <>
                  {' '}
                  · current{' '}
                  <span className="font-mono text-ink">{valueLabel}</span>
                </>
              ) : (
                ' · not measured yet'
              )}
            </p>
          </div>
          {sheets.length > 1 ? (
            <select
              className="border border-steel-border bg-bg px-2 py-1 text-xs"
              value={sheet?.id ?? ''}
              onChange={(e) => {
                const i = sheets.findIndex((s) => s.id === e.target.value)
                if (i >= 0) setPageIndex(i)
              }}
            >
              {sheets.map((s, i) => (
                <option key={s.id} value={s.id}>
                  Page {s.pageNumber || i + 1}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            className="text-xs text-steel hover:text-ink"
            onClick={onClose}
          >
            Close
          </button>
        </header>

        {!focus ? (
          <div className="flex flex-1 items-center justify-center text-sm text-steel">
            This field is not plan-traceable for {instance.shape}.
          </div>
        ) : !sheet ? (
          <div className="flex flex-1 items-center justify-center text-sm text-steel">
            {sheetsQuery.isLoading
              ? 'Loading floor drawing…'
              : 'No drawing for this floor yet. Upload a PDF from the floor bar.'}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {focus?.target.kind === 'geometryPair' && focus.clickedLabel ? (
              <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-steel-border bg-bg/50 px-3 py-2 text-[11px]">
                <span className="text-steel">Fill:</span>
                <button
                  type="button"
                  className={toolBtn(pairFill === 'single')}
                  onClick={() => {
                    setPairFill('single')
                    setCountDraft(0)
                  }}
                >
                  Trace {focus.clickedLabel} only
                </button>
                <button
                  type="button"
                  className={toolBtn(pairFill === 'both')}
                  onClick={() => {
                    setPairFill('both')
                    setCountDraft(0)
                  }}
                >
                  Trace {focus.target.labels[0]} and {focus.target.labels[1]}{' '}
                  together
                </button>
              </div>
            ) : null}

            <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-steel-border px-3 py-1.5 text-[11px]">
              <button
                type="button"
                className={toolBtn(phase === 'pan')}
                onClick={() => {
                  setPhase('pan')
                  setLiveDraftMsg(null)
                  setStatusMsg('Pan/zoom the drawing, then tap Measure')
                }}
              >
                Pan
              </button>
              <button
                type="button"
                className={toolBtn(phase === 'measure')}
                disabled={!calibrated}
                title={!calibrated ? 'Calibrate first' : undefined}
                onClick={() => {
                  setPhase('measure')
                  setStatusMsg(
                    `Measuring ${fieldTitle} — ${modeHint(activeMode, circleInput)}`,
                  )
                }}
              >
                Measure
              </button>
              <button
                type="button"
                className={toolBtn(phase === 'calibrate')}
                onClick={() => {
                  setCalPending(null)
                  setCalDistance(null)
                  setLiveDraftMsg(null)
                  setPhase('calibrate')
                  setStatusMsg(
                    'Draw a line on a known dimension, then enter its length',
                  )
                }}
              >
                {calibrated ? 'Recalibrate' : 'Calibrate'}
              </button>

              {phase === 'measure' && calibrated ? (
                <>
                  <label className="flex items-center gap-1.5 text-steel">
                    Mode
                    <select
                      className="border border-steel-border bg-bg px-1.5 py-0.5 text-xs text-ink"
                      value={activeMode}
                      onChange={(e) => {
                        const next = e.target.value as MeasureMode
                        setModeOverride(next)
                        setCountDraft(0)
                        setCountDraftPoints([])
                        setLiveDraftMsg(null)
                        setStatusMsg(
                          `Measuring ${fieldTitle} — ${modeHint(next, circleInput)}`,
                        )
                      }}
                    >
                      {MEASURE_MODE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {activeMode === 'CIRCLE' ? (
                    <label className="flex items-center gap-1.5 text-steel">
                      Input
                      <select
                        className="border border-steel-border bg-bg px-1.5 py-0.5 text-xs text-ink"
                        value={circleInput}
                        onChange={(e) => {
                          const next = e.target.value as
                            | 'centerRadius'
                            | 'threePoint'
                          setCircleInput(next)
                          setLiveDraftMsg(null)
                          setStatusMsg(
                            `Measuring ${fieldTitle} — ${modeHint('CIRCLE', next)}`,
                          )
                        }}
                      >
                        <option value="centerRadius">Center + radius</option>
                        <option value="threePoint">3-point</option>
                      </select>
                    </label>
                  ) : null}
                  {activeMode === 'DEDUCTION' ? (
                    <label className="flex items-center gap-1.5 text-steel">
                      Parent
                      <select
                        className="border border-steel-border bg-bg px-1.5 py-0.5 text-xs text-ink"
                        value={deductionParentId}
                        onChange={(e) => setDeductionParentId(e.target.value)}
                        disabled={areaParents.length === 0}
                      >
                        {areaParents.length === 0 ? (
                          <option value="">Trace an Area first</option>
                        ) : (
                          areaParents.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label} ({p.grossM2.toFixed(2)} m²)
                            </option>
                          ))
                        )}
                      </select>
                    </label>
                  ) : null}
                </>
              ) : null}

              <span className="text-steel">
                {!calibrated
                  ? 'Calibrate first, then Pan, then Measure'
                  : phase === 'pan'
                    ? 'Drag to move · scroll to zoom · then Measure'
                    : phase === 'measure'
                      ? modeHint(activeMode, circleInput)
                      : 'Calibration mode'}
              </span>
              {displayStatus ? (
                <span className="ml-auto max-w-[45%] truncate font-mono text-ink">
                  {displayStatus}
                </span>
              ) : null}
            </div>

            {phase === 'measure' &&
            activeMode === 'COUNT' &&
            countDraft > 0 ? (
              <div className="flex flex-shrink-0 items-center gap-2 border-b border-steel-border px-3 py-2">
                <button
                  type="button"
                  className="bg-signal px-3 py-1.5 text-xs font-medium text-white"
                  onClick={applyCount}
                >
                  Apply count ({countDraft})
                </button>
                <button
                  type="button"
                  className="text-xs text-steel"
                  onClick={() => {
                    setCountDraft(0)
                    setCountDraftPoints([])
                  }}
                >
                  Reset clicks
                </button>
              </div>
            ) : null}

            {phase === 'calibrate' && calPending ? (
              <form
                onSubmit={handleSaveCalibration}
                className="flex flex-shrink-0 flex-wrap items-end gap-2 border-b border-steel-border bg-bg/60 px-3 py-2"
              >
                <label className="text-[11px] text-steel">
                  Real length
                  <NumericInput
                    className="ml-1 w-24 border border-steel-border bg-panel px-1.5 py-1 text-xs"
                    value={calDistance}
                    allowEmpty
                    min={0}
                    onChange={(n) => setCalDistance(n)}
                  />
                </label>
                <select
                  className="border border-steel-border bg-panel px-1.5 py-1 text-xs"
                  value={calUnit}
                  onChange={(e) =>
                    setCalUnit(e.target.value as CalibrationUnitLabel)
                  }
                >
                  <option value="m">m</option>
                  <option value="ft">ft</option>
                  <option value="in">in</option>
                </select>
                <button
                  type="submit"
                  className="bg-signal px-3 py-1 text-xs font-medium text-white"
                  disabled={saveCalMut.isPending}
                >
                  Save scale
                </button>
                <button
                  type="button"
                  className="text-xs text-steel"
                  onClick={() => {
                    setCalPending(null)
                    setPhase('pan')
                  }}
                >
                  Cancel
                </button>
                {calError ? (
                  <span className="text-xs text-danger">{calError}</span>
                ) : null}
              </form>
            ) : null}

            <div className="relative flex min-h-0 flex-1">
              {areaParents.length > 0 ? (
                <aside className="w-48 flex-shrink-0 overflow-y-auto border-r border-steel-border bg-bg/40 px-2 py-2 text-[11px]">
                  <div className="mb-1.5 font-medium text-ink">
                    Areas & deductions
                  </div>
                  <ul className="space-y-2">
                    {areaParents.map((p) => {
                      const net = parentNetM2(p)
                      const deducted = totalDeductionsM2(p)
                      return (
                        <li
                          key={p.id}
                          className={`border border-steel-border px-1.5 py-1 ${
                            p.id === deductionParentId
                              ? 'border-signal bg-signal/10'
                              : 'bg-panel'
                          }`}
                        >
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() => setDeductionParentId(p.id)}
                          >
                            <div className="font-medium text-ink">{p.label}</div>
                            <div className="font-mono text-steel">
                              Gross {p.grossM2.toFixed(2)} m²
                            </div>
                            {p.deductions.length > 0 ? (
                              <ul className="mt-1 space-y-0.5 border-l-2 border-danger/40 pl-1.5">
                                {p.deductions.map((d) => (
                                  <li key={d.id} className="text-danger">
                                    − {d.label}: {d.areaM2.toFixed(2)} m²
                                  </li>
                                ))}
                                <li className="font-mono text-ink">
                                  Net {net.toFixed(2)} m²
                                  <span className="text-steel">
                                    {' '}
                                    (−{deducted.toFixed(2)})
                                  </span>
                                </li>
                              </ul>
                            ) : (
                              <div className="text-steel">No deductions</div>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </aside>
              ) : null}
              <div className="relative min-h-0 flex-1">
              <SheetViewer
                imageUrl={resolveMediaUrl(sheet.originalFileUrl)}
                className="h-full w-full"
                tool={viewerTool}
                markupStyle={{ color: MEASURE_OVERLAY_COLOR, strokeWidth: 3 }}
                sessionOverlays={displayOverlays}
                onCalibrationMeasured={({ pixelDistance }) => {
                  if (pixelDistance > 0) setCalPending({ pixelDistance })
                }}
                onMeasurementComplete={handleMeasurementComplete}
                onDraftMeasureChange={handleDraftMeasureChange}
                inputBlocked={
                  (!calibrated && phase !== 'calibrate') || phase === 'pan'
                }
              />
              </div>
              <aside className="flex w-56 flex-shrink-0 flex-col overflow-y-auto border-l border-steel-border bg-[#1a1f26] px-2.5 py-3 text-[11px]">
                <div className="mb-2 text-sm font-semibold text-white">
                  Measurements
                </div>
                {overlays.length === 0 ? (
                  <p className="text-steel">
                    Finished traces stay on the sheet and list here.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {overlays.map((o) => (
                      <li
                        key={o.id}
                        className="relative border border-steel-border/80 bg-[#232a33] pl-2.5 pr-1.5 py-2"
                        style={{ borderLeftWidth: 3, borderLeftColor: o.color }}
                      >
                        <div className="flex items-start gap-1.5">
                          <div className="min-w-0 flex-1">
                            <input
                              className="w-full border-0 bg-transparent text-[12px] font-medium text-white outline-none focus:ring-0"
                              value={o.name}
                              onChange={(e) => {
                                const name = e.target.value
                                setOverlays((prev) =>
                                  prev.map((x) =>
                                    x.id === o.id ? { ...x, name } : x,
                                  ),
                                )
                              }}
                              aria-label="Measurement name"
                            />
                            <div
                              className="mt-0.5 font-mono text-[13px] font-semibold"
                              style={{ color: o.color }}
                            >
                              {o.valueLabel}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="shrink-0 px-1 py-0.5 text-steel hover:text-white"
                            title={o.visible ? 'Hide on sheet' : 'Show on sheet'}
                            onClick={() =>
                              setOverlays((prev) =>
                                prev.map((x) =>
                                  x.id === o.id
                                    ? { ...x, visible: !x.visible }
                                    : x,
                                ),
                              )
                            }
                            aria-label={o.visible ? 'Hide' : 'Show'}
                          >
                            {o.visible ? (
                              <span className="text-[14px]" aria-hidden>
                                👁
                              </span>
                            ) : (
                              <span
                                className="relative text-[14px] opacity-50"
                                aria-hidden
                              >
                                👁
                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                                  /
                                </span>
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            className="shrink-0 px-1 py-0.5 text-steel hover:text-danger"
                            title="Delete measurement"
                            onClick={() =>
                              setOverlays((prev) =>
                                prev.filter((x) => x.id !== o.id),
                              )
                            }
                            aria-label="Delete"
                          >
                            <span className="text-[13px]" aria-hidden>
                              ✕
                            </span>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </aside>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Disabled-state tooltip for a field Measure control. */
export function measureButtonTooltip(
  hasSheet: boolean,
  sheetCalibrated: boolean,
): string | null {
  if (!hasSheet) return 'Upload the floor drawing first'
  if (!sheetCalibrated) return 'Calibrate the drawing first'
  return null
}

/** Compact icon button next to a schedule field. */
export function FieldMeasureButton({
  disabledReason,
  onClick,
  label,
}: {
  disabledReason: string | null
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      className="shrink-0 border border-steel-border px-1 py-0.5 text-[10px] leading-none text-chalk hover:border-chalk disabled:cursor-not-allowed disabled:border-steel-border/60 disabled:text-steel/40"
      title={disabledReason ?? `Measure ${label} from drawing`}
      disabled={Boolean(disabledReason)}
      onClick={onClick}
      aria-label={`Measure ${label}`}
    >
      ⌖
    </button>
  )
}
