import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchSheets, saveSheetCalibration } from '../api/sheets'
import { resolveMediaUrl } from '../lib/api'
import { computeCalibrationScale } from '../lib/osdCoordinates'
import { linearMetres, polygonPairMetres } from '../lib/measureGeometry'
import {
  getMeasureTargets,
  measureTargetFilled,
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

function formatTargetValue(
  target: MeasureTarget,
  geometry: Record<string, unknown>,
  count: number,
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

function measureToolForMode(mode: MeasureMode): ViewerTool {
  if (mode === 'AREA') return 'area'
  if (mode === 'COUNT') return 'count'
  return 'linear'
}

export function MeasureSessionModal({
  open,
  onClose,
  projectId,
  floorId,
  instance,
  onApply,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  floorId: string
  instance: Instance
  onApply: (patch: MeasureApplyPatch) => void
}) {
  const qc = useQueryClient()
  const targets = useMemo(
    () => getMeasureTargets(instance.elementKey, instance.shape),
    [instance.elementKey, instance.shape],
  )

  const [activeId, setActiveId] = useState<string | null>(targets[0]?.id ?? null)
  const [modes, setModes] = useState<Record<string, MeasureMode>>(() => {
    const init: Record<string, MeasureMode> = {}
    for (const t of targets) init[t.id] = t.defaultMode
    return init
  })
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

  const activeTarget: MeasureTarget | null =
    targets.find((t) => t.id === activeId) ?? null
  const activeMode: MeasureMode =
    (activeId && modes[activeId]) || activeTarget?.defaultMode || 'LINEAR'

  const viewerTool: ViewerTool = !calibrated
    ? phase === 'calibrate'
      ? 'calibrate'
      : 'pan'
    : phase === 'calibrate'
      ? 'calibrate'
      : phase === 'pan'
        ? 'pan'
        : measureToolForMode(activeMode)

  useEffect(() => {
    if (!open) return
    setLocalGeo({ ...(instance.geometry || {}) })
    setLocalCount(instance.count)
    setActiveId(targets[0]?.id ?? null)
    const init: Record<string, MeasureMode> = {}
    for (const t of targets) init[t.id] = t.defaultMode
    setModes(init)
    setPageIndex(0)
    setCalPending(null)
    setCountDraft(0)
    setStatusMsg(null)
    setPhase('pan')
  }, [open, instance.id, instance.geometry, instance.count, targets])

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

  function advanceChecklist(
    doneId: string,
    nextGeo: Record<string, unknown> = localGeo,
    nextCount: number = localCount,
  ) {
    const idx = targets.findIndex((t) => t.id === doneId)
    const next = targets.slice(idx + 1).find((t) => {
      return !measureTargetFilled(t, nextGeo, nextCount)
    })
    if (next) {
      setActiveId(next.id)
      setCountDraft(0)
      setPhase('measure')
    } else {
      setPhase('pan')
    }
  }

  function handleMeasurementComplete(payload: {
    type: 'LINEAR' | 'AREA' | 'COUNT'
    points: ImagePoint[]
  }) {
    if (!sheet || !activeTarget || !calibrated || phase !== 'measure') return
    const scale = sheet.calibrationScale!
    const unit = sheet.calibrationUnit

    if (activeMode === 'COUNT' || payload.type === 'COUNT') {
      setCountDraft((n) => {
        const next = n + 1
        setStatusMsg(
          `${next} click${next === 1 ? '' : 's'} — press Apply count to save`,
        )
        return next
      })
      return
    }

    if (activeTarget.kind === 'geometryPair' && activeMode === 'AREA') {
      const sides = polygonPairMetres(payload.points, scale, unit)
      if (!sides) {
        setStatusMsg('Could not read rectangle sides — try again')
        return
      }
      const geometry = {
        [activeTarget.keys[0]]: sides.a,
        [activeTarget.keys[1]]: sides.b,
      }
      const merged = { ...localGeo, ...geometry }
      applyPatch({ geometry })
      setStatusMsg(
        `${activeTarget.labels[0]}=${sides.a} m · ${activeTarget.labels[1]}=${sides.b} m`,
      )
      advanceChecklist(activeTarget.id, merged, localCount)
      return
    }

    if (activeTarget.kind === 'geometry' && activeMode === 'LINEAR') {
      const len = linearMetres(payload.points, scale, unit)
      if (len == null) {
        setStatusMsg('Could not read length — try again')
        return
      }
      const geometry = { [activeTarget.key]: len }
      applyPatch({ geometry })
      setStatusMsg(`${activeTarget.label}=${len} m`)
      advanceChecklist(activeTarget.id, { ...localGeo, ...geometry }, localCount)
      return
    }

    if (activeTarget.kind === 'geometry' && activeMode === 'AREA') {
      const sides = polygonPairMetres(payload.points, scale, unit)
      if (!sides) {
        setStatusMsg('Could not read dimensions — try again')
        return
      }
      const value = Math.max(sides.a, sides.b)
      const geometry = { [activeTarget.key]: value }
      applyPatch({ geometry })
      setStatusMsg(`${activeTarget.label}=${value} m`)
      advanceChecklist(activeTarget.id, { ...localGeo, ...geometry }, localCount)
    }
  }

  function applyCount() {
    if (!activeTarget) return
    const n = Math.max(1, countDraft)
    if (activeTarget.kind === 'count') {
      applyPatch({ count: n })
      setStatusMsg(`No. = ${n}`)
      advanceChecklist(activeTarget.id, localGeo, n)
    } else if (activeTarget.kind === 'geometry') {
      const geometry = { [activeTarget.key]: n }
      applyPatch({ geometry })
      setStatusMsg(`${activeTarget.label} = ${n}`)
      advanceChecklist(activeTarget.id, { ...localGeo, ...geometry }, localCount)
    }
    setCountDraft(0)
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

  const filledCount = targets.filter((t) =>
    measureTargetFilled(t, localGeo, localCount),
  ).length

  const toolBtn = (active: boolean) =>
    `border px-2.5 py-1 font-medium ${
      active
        ? 'border-signal bg-signal/15 text-ink'
        : 'border-steel-border text-ink hover:bg-bg'
    }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-3">
      <div className="flex h-[min(92vh,900px)] w-[min(96vw,1200px)] flex-col border border-steel-border bg-panel shadow-xl">
        <header className="flex flex-shrink-0 items-center gap-3 border-b border-steel-border px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-sm font-bold text-ink">
              Measure · {instance.mark}
            </h2>
            <p className="text-[11px] text-steel">
              Floor {floorId} · {filledCount}/{targets.length} fields filled ·
              close anytime — measured values save immediately
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

        {!sheet ? (
          <div className="flex flex-1 items-center justify-center text-sm text-steel">
            {sheetsQuery.isLoading
              ? 'Loading floor drawing…'
              : 'No drawing for this floor yet. Upload a PDF from the floor bar.'}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <aside className="flex w-72 flex-shrink-0 flex-col border-r border-steel-border bg-bg/40">
              <div className="border-b border-steel-border px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-steel">
                Checklist
              </div>
              <ul className="flex-1 overflow-y-auto p-2 space-y-1">
                {targets.map((t) => {
                  const filled = measureTargetFilled(t, localGeo, localCount)
                  const selected = t.id === activeId
                  const valueLabel = formatTargetValue(t, localGeo, localCount)
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveId(t.id)
                          setCountDraft(0)
                          if (calibrated) setPhase('measure')
                        }}
                        className={`w-full rounded border px-2 py-1.5 text-left text-xs ${
                          selected
                            ? 'border-signal bg-signal/10 text-ink'
                            : 'border-steel-border bg-panel text-ink hover:border-chalk'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{t.label}</span>
                          <span
                            className={
                              filled ? 'text-emerald-600' : 'text-steel'
                            }
                          >
                            {filled ? '✓' : '○'}
                          </span>
                        </div>
                        {valueLabel ? (
                          <div className="mt-0.5 font-mono text-[11px] font-semibold text-ink">
                            {valueLabel}
                          </div>
                        ) : (
                          <div className="mt-0.5 text-[10px] text-steel">
                            Not measured
                          </div>
                        )}
                        <select
                          className="mt-1 w-full border border-steel-border bg-bg px-1 py-0.5 text-[10px]"
                          value={modes[t.id] ?? t.defaultMode}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const mode = e.target.value as MeasureMode
                            setModes((m) => ({ ...m, [t.id]: mode }))
                            setActiveId(t.id)
                            if (calibrated) setPhase('measure')
                          }}
                        >
                          <option value="LINEAR">Linear</option>
                          <option value="AREA">Area</option>
                          <option value="COUNT">Count</option>
                        </select>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {statusMsg ? (
                <p className="border-t border-steel-border px-3 py-2 text-[11px] text-ink">
                  {statusMsg}
                </p>
              ) : null}
              {phase === 'measure' &&
              activeMode === 'COUNT' &&
              countDraft > 0 ? (
                <div className="border-t border-steel-border p-2">
                  <button
                    type="button"
                    className="w-full bg-signal px-2 py-1.5 text-xs font-medium text-white"
                    onClick={applyCount}
                  >
                    Apply count ({countDraft})
                  </button>
                </div>
              ) : null}
            </aside>

            <div className="relative flex min-w-0 flex-1 flex-col">
              <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-steel-border px-3 py-1.5 text-[11px]">
                <button
                  type="button"
                  className={toolBtn(phase === 'pan')}
                  onClick={() => {
                    setPhase('pan')
                    setStatusMsg('Pan/zoom the drawing, then tap Measure')
                  }}
                >
                  Pan
                </button>
                <button
                  type="button"
                  className={toolBtn(phase === 'measure')}
                  disabled={!calibrated || !activeTarget}
                  title={
                    !calibrated
                      ? 'Calibrate first'
                      : !activeTarget
                        ? 'Select a checklist field'
                        : undefined
                  }
                  onClick={() => {
                    setPhase('measure')
                    setStatusMsg(
                      activeTarget
                        ? `Measuring ${activeTarget.label} (${activeMode.toLowerCase()})`
                        : 'Select a checklist field',
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
                    setPhase('calibrate')
                    setStatusMsg(
                      'Draw a line on a known dimension, then enter its length',
                    )
                  }}
                >
                  {calibrated ? 'Recalibrate' : 'Calibrate'}
                </button>
                <span className="text-steel">
                  {!calibrated
                    ? 'Calibrate first, then Pan to location, then Measure'
                    : phase === 'pan'
                      ? 'Drag to move · scroll to zoom · then Measure'
                      : phase === 'measure'
                        ? `Drawing for ${activeTarget?.label ?? 'field'} (${activeMode.toLowerCase()})`
                        : 'Calibration mode'}
                </span>
              </div>

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

              <div className="relative min-h-0 flex-1">
                <SheetViewer
                  imageUrl={resolveMediaUrl(sheet.originalFileUrl)}
                  className="h-full w-full"
                  tool={viewerTool}
                  onCalibrationMeasured={({ pixelDistance }) => {
                    if (pixelDistance > 0) setCalPending({ pixelDistance })
                  }}
                  onMeasurementComplete={handleMeasurementComplete}
                  inputBlocked={
                    (!calibrated && phase !== 'calibrate') || phase === 'pan'
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Disabled-state tooltip for the row Measure control. */
export function measureButtonTooltip(
  hasSheet: boolean,
  sheetCalibrated: boolean,
  hasTargets: boolean,
): string | null {
  if (!hasTargets) return 'No plan-traceable fields for this shape'
  if (!hasSheet) return 'Upload the floor drawing first'
  if (!sheetCalibrated) return 'Calibrate the drawing first'
  return null
}
