import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { saveSheetCalibration } from '../../api/sheets'
import { resolveMediaUrl } from '../../lib/api'
import {
  linearMetres,
  perimeterMetres,
  polygonAreaMetres2,
} from '../../lib/measureGeometry'
import { previewTakeoffMeasurement } from '../../lib/measurementPreview'
import { newMeasureId } from '../../lib/measureAreaParents'
import {
  defaultOverlayName,
  nextMeasureOverlayColor,
  overlayKindFromMeasure,
  type MeasureSessionOverlay,
} from '../../lib/measureSessionOverlays'
import { computeCalibrationScale } from '../../lib/osdCoordinates'
import { sheetIsCalibrated } from '../../lib/sheetCalibration'
import type { ImagePoint } from '../../lib/measurementMath'
import type { CalibrationUnitLabel, Sheet, ViewerTool } from '../../types/models'
import { SheetViewer } from '../SheetViewer'
import { NumericInput } from '../ui'

export type DrawingViewerIntent = 'view' | 'qto'

type Phase = 'pan' | 'measure' | 'calibrate'
type QtoMode = 'LINEAR' | 'POLYLINE' | 'AREA' | 'RECTANGLE' | 'COUNT'

const QTO_MODES: { value: QtoMode; label: string }[] = [
  { value: 'LINEAR', label: 'Linear' },
  { value: 'POLYLINE', label: 'Polyline' },
  { value: 'AREA', label: 'Area' },
  { value: 'RECTANGLE', label: 'Rectangle' },
  { value: 'COUNT', label: 'Count' },
]

function toolForMode(mode: QtoMode): ViewerTool {
  if (mode === 'AREA') return 'area'
  if (mode === 'RECTANGLE') return 'measureRect'
  if (mode === 'COUNT') return 'count'
  if (mode === 'POLYLINE') return 'polyline'
  return 'linear'
}

/**
 * Project drawings viewer — View (pan) or QTO (measure-ready).
 * Calibrate here when opening QTO on an uncalibrated sheet.
 */
export function DrawingViewerModal({
  intent,
  sheet: initial,
  pages,
  projectId,
  floorId,
  title,
  onClose,
}: {
  intent: DrawingViewerIntent
  sheet: Sheet
  pages: Sheet[]
  projectId: string
  floorId: string
  title: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [pageId, setPageId] = useState(initial.id)
  const sheet = pages.find((p) => p.id === pageId) ?? initial
  const [localCalibrated, setLocalCalibrated] = useState(false)
  const calibrated = localCalibrated || sheetIsCalibrated(sheet)

  const [phase, setPhase] = useState<Phase>(() => {
    if (intent === 'view') return 'pan'
    return sheetIsCalibrated(initial) ? 'measure' : 'calibrate'
  })
  const [mode, setMode] = useState<QtoMode>('LINEAR')
  const [overlays, setOverlays] = useState<MeasureSessionOverlay[]>([])
  const [countDraftPoints, setCountDraftPoints] = useState<ImagePoint[]>([])
  const [liveMsg, setLiveMsg] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const [calPending, setCalPending] = useState<{ pixelDistance: number } | null>(
    null,
  )
  const [calDistance, setCalDistance] = useState<number | null>(null)
  const [calUnit, setCalUnit] = useState<CalibrationUnitLabel>('m')
  const [calError, setCalError] = useState<string | null>(null)

  const draftColor = nextMeasureOverlayColor(overlays.length)

  const displayOverlays = useMemo(() => {
    if (countDraftPoints.length === 0) return overlays
    return [
      ...overlays,
      {
        id: '__count-draft',
        kind: 'COUNT' as const,
        name: 'Count (draft)',
        valueLabel: String(countDraftPoints.length),
        points: countDraftPoints,
        color: draftColor,
        visible: true,
      },
    ]
  }, [overlays, countDraftPoints, draftColor])

  const saveCalMut = useMutation({
    mutationFn: (payload: { scale: number; unit: CalibrationUnitLabel }) =>
      saveSheetCalibration(sheet.id, payload.scale, payload.unit),
    onSuccess: async () => {
      setCalPending(null)
      setCalError(null)
      setLocalCalibrated(true)
      await qc.invalidateQueries({
        queryKey: ['projects', projectId, 'sheets', floorId],
      })
      await qc.invalidateQueries({
        queryKey: ['projects', projectId, 'sheets'],
      })
      if (intent === 'qto') setPhase('measure')
      else setPhase('pan')
    },
  })

  function onCalSubmit(e: FormEvent) {
    e.preventDefault()
    if (!calPending || calDistance == null || !(calDistance > 0)) {
      setCalError('Draw a line, then enter a positive distance')
      return
    }
    try {
      const scale = computeCalibrationScale(
        calDistance,
        calPending.pixelDistance,
      )
      setCalError(null)
      saveCalMut.mutate({ scale, unit: calUnit })
    } catch (err: unknown) {
      setCalError(err instanceof Error ? err.message : 'Calibration failed')
    }
  }

  const viewerTool: ViewerTool =
    intent === 'view'
      ? 'pan'
      : !calibrated || phase === 'calibrate'
        ? 'calibrate'
        : phase === 'pan'
          ? 'pan'
          : toolForMode(mode)

  function pushOverlay(args: {
    kind: MeasureSessionOverlay['kind']
    points: ImagePoint[]
    valueLabel: string
    perimeterLabel?: string | null
  }) {
    setOverlays((prev) => {
      const kindCount = prev.filter((o) => o.kind === args.kind).length + 1
      return [
        ...prev,
        {
          id: newMeasureId('ov'),
          kind: args.kind,
          name: defaultOverlayName(args.kind, kindCount),
          valueLabel: args.valueLabel,
          perimeterLabel: args.perimeterLabel ?? null,
          points: args.points.map((p) => ({ ...p })),
          color: nextMeasureOverlayColor(prev.length),
          visible: true,
        },
      ]
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-3">
      <div className="flex h-[min(90vh,860px)] w-[min(96vw,1100px)] flex-col border border-steel-border bg-panel">
        <header className="flex items-center gap-2 border-b border-steel-border px-3 py-2">
          <h2 className="min-w-0 flex-1 truncate font-display text-sm font-bold">
            {intent === 'qto' ? 'QTO' : 'View'} · {title}
          </h2>
          {pages.length > 1 ? (
            <select
              className="border border-steel-border px-2 py-1 text-xs"
              value={pageId}
              onChange={(e) => {
                setPageId(e.target.value)
                setCalPending(null)
                setLiveMsg(null)
                setLocalCalibrated(false)
              }}
            >
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  Page {p.pageNumber}
                </option>
              ))}
            </select>
          ) : null}
          <button type="button" className="text-xs text-steel" onClick={onClose}>
            Close
          </button>
        </header>

        {intent === 'view' ? (
          <p className="border-b border-steel-border px-3 py-1.5 text-[11px] text-steel">
            Pan and zoom the drawing. Use QTO from the register to measure.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-steel-border px-3 py-1.5 text-[11px]">
              <button
                type="button"
                className={`border px-2.5 py-1 font-medium ${
                  phase === 'pan'
                    ? 'border-signal bg-signal/15 text-ink'
                    : 'border-steel-border text-ink hover:bg-bg'
                }`}
                onClick={() => setPhase('pan')}
              >
                Pan
              </button>
              <button
                type="button"
                className={`border px-2.5 py-1 font-medium ${
                  phase === 'measure'
                    ? 'border-signal bg-signal/15 text-ink'
                    : 'border-steel-border text-ink hover:bg-bg'
                }`}
                disabled={!calibrated}
                title={!calibrated ? 'Calibrate first' : undefined}
                onClick={() => calibrated && setPhase('measure')}
              >
                Measure
              </button>
              <button
                type="button"
                className={`border px-2.5 py-1 font-medium ${
                  phase === 'calibrate'
                    ? 'border-signal bg-signal/15 text-ink'
                    : 'border-steel-border text-ink hover:bg-bg'
                }`}
                onClick={() => setPhase('calibrate')}
              >
                {calibrated ? 'Recalibrate' : 'Calibrate'}
              </button>
              {phase === 'measure' && calibrated ? (
                <label className="flex items-center gap-1.5 text-steel">
                  Mode
                  <select
                    className="border border-steel-border bg-bg px-1.5 py-0.5 text-xs text-ink"
                    value={mode}
                    onChange={(e) => {
                      setMode(e.target.value as QtoMode)
                      setCountDraftPoints([])
                      setLiveMsg(null)
                      setStatusMsg(null)
                    }}
                  >
                    {QTO_MODES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <span className="text-steel">
                {!calibrated
                  ? 'Calibrate first, then Measure'
                  : phase === 'pan'
                    ? 'Drag to move · scroll to zoom'
                    : phase === 'measure'
                      ? 'Trace on the sheet — values stay in the sidebar'
                      : 'Click two points on a known length'}
              </span>
              {liveMsg || statusMsg ? (
                <span className="font-mono text-ink">{liveMsg ?? statusMsg}</span>
              ) : null}
            </div>
            {phase === 'calibrate' || (!calibrated && intent === 'qto') ? (
              <form
                onSubmit={onCalSubmit}
                className="flex flex-wrap items-end gap-2 border-b border-steel-border px-3 py-2"
              >
                <label className="text-[11px] text-steel">
                  Length
                  <NumericInput
                    className="ml-1 w-24 border border-steel-border px-1.5 py-1 text-xs"
                    value={calDistance}
                    allowEmpty
                    min={0}
                    onChange={setCalDistance}
                  />
                </label>
                <select
                  className="border border-steel-border px-1.5 py-1 text-xs"
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
                  className="bg-signal px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                  disabled={!calPending || saveCalMut.isPending}
                >
                  Save scale
                </button>
                {calPending ? (
                  <span className="text-[11px] text-steel">
                    Line {calPending.pixelDistance.toFixed(0)} px
                  </span>
                ) : (
                  <span className="text-[11px] text-signal">
                    Draw calibration line…
                  </span>
                )}
                {calError ? (
                  <span className="text-xs text-danger">{calError}</span>
                ) : null}
              </form>
            ) : null}
          </>
        )}

        <div className="flex min-h-0 flex-1">
          <div className="relative min-h-0 flex-1">
            <SheetViewer
              imageUrl={resolveMediaUrl(sheet.originalFileUrl)}
              className="h-full w-full"
              tool={viewerTool}
              markupStyle={{ color: draftColor, strokeWidth: 3 }}
              sessionOverlays={intent === 'qto' ? displayOverlays : []}
              onCalibrationMeasured={({ pixelDistance }) => {
                if (pixelDistance > 0) {
                  setCalPending({ pixelDistance })
                  setPhase('calibrate')
                }
              }}
              onDraftMeasureChange={(draft) => {
                if (intent !== 'qto' || !sheet || !calibrated || phase !== 'measure') {
                  setLiveMsg(null)
                  return
                }
                const scale = sheet.calibrationScale!
                const unit = sheet.calibrationUnit
                if (!draft) {
                  setLiveMsg(null)
                  return
                }
                const pts =
                  draft.cursor && draft.tool === 'polyline'
                    ? [...draft.points, draft.cursor]
                    : draft.points
                if (draft.tool === 'polyline' || draft.tool === 'linear') {
                  const len = linearMetres(pts, scale, unit)
                  setLiveMsg(
                    len != null ? `${len.toFixed(2)} m` : 'Click next point',
                  )
                  return
                }
                if (
                  draft.tool === 'area' ||
                  draft.tool === 'measureRect' ||
                  draft.tool === 'deduction'
                ) {
                  const previewPts =
                    draft.cursor && draft.points.length >= 1
                      ? [...draft.points, draft.cursor]
                      : draft.points
                  const preview = previewTakeoffMeasurement(
                    'AREA',
                    previewPts,
                    scale,
                    unit,
                  )
                  const peri = perimeterMetres(previewPts, scale, unit)
                  if (!preview) {
                    setLiveMsg('Click corners')
                    return
                  }
                  const periPart =
                    peri != null ? ` · Perimeter ${peri.toFixed(2)} m` : ''
                  setLiveMsg(
                    `Area ${preview.value.toFixed(2)} ${preview.unit}${periPart}`,
                  )
                  return
                }
                setLiveMsg(null)
              }}
              onMeasurementComplete={(payload) => {
                if (intent !== 'qto' || !sheet?.calibrationScale) return
                const scale = sheet.calibrationScale
                const unit = sheet.calibrationUnit

                if (payload.type === 'COUNT' || mode === 'COUNT') {
                  const next = [...countDraftPoints, ...payload.points]
                  setCountDraftPoints(next)
                  setStatusMsg(`Count ${next.length} — click more or finish`)
                  return
                }
                if (payload.type === 'LINEAR' || mode === 'LINEAR' || mode === 'POLYLINE') {
                  const len = linearMetres(payload.points, scale, unit)
                  if (len == null) return
                  pushOverlay({
                    kind: overlayKindFromMeasure(payload.type, mode),
                    points: payload.points,
                    valueLabel: `${len.toFixed(2)} m`,
                  })
                  setStatusMsg(`Linear ${len.toFixed(2)} m`)
                  return
                }
                if (payload.type === 'AREA' || mode === 'AREA' || mode === 'RECTANGLE') {
                  const area = polygonAreaMetres2(payload.points, scale, unit)
                  const peri = perimeterMetres(payload.points, scale, unit)
                  if (area == null) return
                  pushOverlay({
                    kind: 'AREA',
                    points: payload.points,
                    valueLabel: `${area.toFixed(2)} m²`,
                    perimeterLabel:
                      peri != null ? `${peri.toFixed(2)} m` : null,
                  })
                  setStatusMsg(`Area ${area.toFixed(2)} m²`)
                }
              }}
              inputBlocked={false}
            />
          </div>
          {intent === 'qto' ? (
            <aside className="flex w-48 flex-shrink-0 flex-col overflow-y-auto border-l border-steel-border bg-[#1a1f26] px-2.5 py-3 text-[11px]">
              <div className="mb-2 text-sm font-semibold text-white">
                Measurements
              </div>
              {mode === 'COUNT' && countDraftPoints.length > 0 ? (
                <button
                  type="button"
                  className="mb-2 border border-signal px-2 py-1 text-[11px] text-signal"
                  onClick={() => {
                    pushOverlay({
                      kind: 'COUNT',
                      points: countDraftPoints,
                      valueLabel: String(countDraftPoints.length),
                    })
                    setStatusMsg(`Saved count ${countDraftPoints.length}`)
                    setCountDraftPoints([])
                  }}
                >
                  Finish count ({countDraftPoints.length})
                </button>
              ) : null}
              {overlays.length === 0 ? (
                <p className="text-steel">Traces appear here.</p>
              ) : (
                <ul className="space-y-2">
                  {overlays.map((o) => (
                    <li
                      key={o.id}
                      className="border border-steel-border/80 bg-[#232a33] px-2 py-1.5"
                      style={{ borderLeftWidth: 3, borderLeftColor: o.color }}
                    >
                      <div className="font-medium text-white">{o.name}</div>
                      <div
                        className="font-mono font-semibold"
                        style={{ color: o.color }}
                      >
                        {o.valueLabel}
                      </div>
                      {o.perimeterLabel ? (
                        <div className="text-steel">
                          Perimeter {o.perimeterLabel}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  )
}
