import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchSheets, uploadFloorPdf } from '../api/sheets'
import { sheetIsCalibrated } from '../lib/sheetCalibration'
import { CalibrateFloorModal } from './CalibrateFloorModal'

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
  const calibrated = sheets.some(sheetIsCalibrated)

  useEffect(() => {
    if (!awaiting) return
    if (sheets.length > 0) {
      setAwaiting(false)
      setMessage(
        calibrated
          ? 'Floor drawing ready'
          : 'Drawing uploaded — calibrate the scale',
      )
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
      await qc.invalidateQueries({
        queryKey: ['projects', projectId, 'sheets'],
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
