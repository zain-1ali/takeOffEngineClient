import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchSheets,
  saveSheetCalibration,
  uploadFloorPdf,
} from '../api/sheets'
import { resolveMediaUrl } from '../lib/api'
import { computeCalibrationScale } from '../lib/osdCoordinates'
import { SheetViewer } from './SheetViewer'
import { NumericInput } from './ui'
import type { CalibrationUnitLabel, Sheet } from '../types/models'

function sheetReady(s: Sheet): boolean {
  return (
    s.calibrationScale != null &&
    s.calibrationScale > 0 &&
    Boolean(s.calibrationUnit)
  )
}

/** Floor-level drawing upload + calibration (one PDF per floor). */
export function FloorDrawingBar({
  projectId,
  floorId,
}: {
  projectId: string
  floorId: string
}) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [awaiting, setAwaiting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [calibrateOpen, setCalibrateOpen] = useState(false)

  const sheetsQuery = useQuery({
    queryKey: ['projects', projectId, 'sheets', floorId],
    queryFn: () => fetchSheets(projectId, floorId),
    enabled: Boolean(projectId && floorId),
    refetchInterval: () => {
      if (awaiting) return 2500
      return false
    },
  })

  const sheets = sheetsQuery.data ?? []
  const hasSheet = sheets.length > 0
  const calibrated = sheets.some(sheetReady)

  useEffect(() => {
    if (!awaiting) return
    if (sheets.length > 0) {
      setAwaiting(false)
      setMessage(
        calibrated
          ? 'Floor drawing ready'
          : 'Drawing uploaded — calibrate the scale',
      )
      // Always open the calibrate modal after a successful conversion.
      setCalibrateOpen(true)
    }
  }, [awaiting, sheets.length, calibrated])

  const uploadMut = useMutation({
    mutationFn: (file: File) => uploadFloorPdf(projectId, floorId, file),
    onSuccess: async () => {
      setError(null)
      setAwaiting(true)
      setMessage('Converting PDF…')
      await qc.invalidateQueries({
        queryKey: ['projects', projectId, 'sheets', floorId],
      })
    },
    onError: (err: Error) => {
      setError(err.message)
      setAwaiting(false)
    },
  })

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) uploadMut.mutate(file)
          }}
        />
        <button
          type="button"
          className="border border-steel-border bg-panel px-2 py-1 font-medium text-ink hover:border-chalk disabled:opacity-50"
          disabled={uploadMut.isPending || awaiting}
          onClick={() => inputRef.current?.click()}
        >
          {hasSheet ? 'Replace floor PDF' : 'Upload floor PDF'}
        </button>
        {hasSheet && !calibrated ? (
          <button
            type="button"
            className="border border-signal bg-signal/10 px-2 py-1 font-medium text-ink"
            onClick={() => setCalibrateOpen(true)}
          >
            Calibrate drawing
          </button>
        ) : null}
        {hasSheet && calibrated ? (
          <button
            type="button"
            className="text-steel hover:text-ink"
            onClick={() => setCalibrateOpen(true)}
          >
            Recalibrate
          </button>
        ) : null}
        <span
          className={
            calibrated
              ? 'text-emerald-700'
              : hasSheet
                ? 'text-signal'
                : 'text-steel'
          }
        >
          {awaiting
            ? 'Converting…'
            : calibrated
              ? 'Drawing calibrated'
              : hasSheet
                ? 'Needs calibration'
                : 'No floor drawing'}
        </span>
        {message && !awaiting ? (
          <span className="text-steel">{message}</span>
        ) : null}
        {error ? <span className="text-danger">{error}</span> : null}
      </div>

      {calibrateOpen && sheets[0] ? (
        <CalibrateFloorModal
          sheet={sheets[0]}
          pages={sheets}
          projectId={projectId}
          floorId={floorId}
          onClose={() => setCalibrateOpen(false)}
        />
      ) : null}
    </>
  )
}

function CalibrateFloorModal({
  sheet: initial,
  pages,
  projectId,
  floorId,
  onClose,
}: {
  sheet: Sheet
  pages: Sheet[]
  projectId: string
  floorId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [pageId, setPageId] = useState(initial.id)
  const sheet = pages.find((p) => p.id === pageId) ?? initial
  const [pending, setPending] = useState<{ pixelDistance: number } | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [unit, setUnit] = useState<CalibrationUnitLabel>('m')
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'pan' | 'calibrate'>('pan')

  const saveMut = useMutation({
    mutationFn: (payload: { scale: number; unit: CalibrationUnitLabel }) =>
      saveSheetCalibration(sheet.id, payload.scale, payload.unit),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['projects', projectId, 'sheets', floorId],
      })
      onClose()
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!pending || distance == null || !(distance > 0)) {
      setError('Draw a line, then enter a positive distance')
      return
    }
    try {
      const scale = computeCalibrationScale(distance, pending.pixelDistance)
      setError(null)
      saveMut.mutate({ scale, unit })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Calibration failed')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-3">
      <div className="flex h-[min(88vh,820px)] w-[min(94vw,1000px)] flex-col border border-steel-border bg-panel">
        <header className="flex items-center gap-2 border-b border-steel-border px-3 py-2">
          <h2 className="flex-1 font-display text-sm font-bold">
            Calibrate floor drawing
          </h2>
          {pages.length > 1 ? (
            <select
              className="border border-steel-border px-2 py-1 text-xs"
              value={pageId}
              onChange={(e) => {
                setPageId(e.target.value)
                setPending(null)
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
        <p className="border-b border-steel-border px-3 py-1.5 text-[11px] text-steel">
          Use <b>Pan</b> to move/zoom to a known dimension, then <b>Calibrate</b> and
          draw a line. Scroll to zoom · + / − / ⌂ buttons on the right.
        </p>
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
              phase === 'calibrate'
                ? 'border-signal bg-signal/15 text-ink'
                : 'border-steel-border text-ink hover:bg-bg'
            }`}
            onClick={() => setPhase('calibrate')}
          >
            Calibrate
          </button>
          <span className="text-steel">
            {phase === 'pan'
              ? 'Drag to move · scroll to zoom'
              : 'Click two points on a known length'}
          </span>
        </div>
        <form
          onSubmit={onSubmit}
          className="flex flex-wrap items-end gap-2 border-b border-steel-border px-3 py-2"
        >
          <label className="text-[11px] text-steel">
            Length
            <NumericInput
              className="ml-1 w-24 border border-steel-border px-1.5 py-1 text-xs"
              value={distance}
              allowEmpty
              min={0}
              onChange={setDistance}
            />
          </label>
          <select
            className="border border-steel-border px-1.5 py-1 text-xs"
            value={unit}
            onChange={(e) => setUnit(e.target.value as CalibrationUnitLabel)}
          >
            <option value="m">m</option>
            <option value="ft">ft</option>
            <option value="in">in</option>
          </select>
          <button
            type="submit"
            className="bg-signal px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
            disabled={!pending || saveMut.isPending}
          >
            Save scale
          </button>
          {pending ? (
            <span className="text-[11px] text-steel">
              Line {pending.pixelDistance.toFixed(0)} px
            </span>
          ) : phase === 'calibrate' ? (
            <span className="text-[11px] text-signal">Draw calibration line…</span>
          ) : null}
          {error ? <span className="text-xs text-danger">{error}</span> : null}
        </form>
        <div className="min-h-0 flex-1">
          <SheetViewer
            imageUrl={resolveMediaUrl(sheet.originalFileUrl)}
            className="h-full w-full"
            tool={phase === 'calibrate' ? 'calibrate' : 'pan'}
            onCalibrationMeasured={({ pixelDistance }) => {
              if (pixelDistance > 0) {
                setPending({ pixelDistance })
                setPhase('calibrate')
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}
