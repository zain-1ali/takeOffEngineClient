import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchSheets, uploadFloorPdf } from '../../api/sheets'
import {
  drawingDisplayName,
  sheetIsCalibrated,
} from '../../lib/sheetCalibration'
import { resolveMediaUrl } from '../../lib/api'
import type { Floor } from '../../types/api'
import type { Sheet } from '../../types/models'
import { CalibrateFloorModal } from '../CalibrateFloorModal'
import { DataTable, GhostButton, PrimaryButton } from '../ui'

type DrawingRow = {
  floorId: string
  floorLabel: string
  sortOrder: number
  pages: Sheet[]
  filename: string
  pageCount: number
  calibrated: boolean
  hasDrawing: boolean
  thumbnailUrl: string | null
}

/**
 * Project-wide index of floor drawings (one PDF per floor).
 * Browse / open / calibrate / replace — does not change the upload API.
 */
export function DrawingsRegisterView({
  projectId,
  floors,
  onOpenFloor,
}: {
  projectId: string
  floors: Floor[]
  /** Switch workspace to this floor (and optionally model schedule). */
  onOpenFloor: (floorId: string) => void
}) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [replaceFloorId, setReplaceFloorId] = useState<string | null>(null)
  const [calibrateFloorId, setCalibrateFloorId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [awaitingFloorId, setAwaitingFloorId] = useState<string | null>(null)

  const sheetsQuery = useQuery({
    queryKey: ['projects', projectId, 'sheets'],
    queryFn: () => fetchSheets(projectId),
    enabled: Boolean(projectId),
    refetchInterval: awaitingFloorId ? 2500 : false,
  })

  const sheets = sheetsQuery.data ?? []

  const rows = useMemo(() => {
    const byFloor = new Map<string, Sheet[]>()
    for (const s of sheets) {
      const fid = s.floorId || ''
      if (!fid) continue
      const list = byFloor.get(fid) ?? []
      list.push(s)
      byFloor.set(fid, list)
    }
    for (const list of byFloor.values()) {
      list.sort(
        (a, b) =>
          (a.pageNumber || 0) - (b.pageNumber || 0) ||
          (a.sortOrder || 0) - (b.sortOrder || 0),
      )
    }

    const floorRows: DrawingRow[] = floors.map((f) => {
      const pages = byFloor.get(f.floorId) ?? []
      const first = pages[0]
      return {
        floorId: f.floorId,
        floorLabel: f.label,
        sortOrder: f.sortOrder ?? 0,
        pages,
        filename: drawingDisplayName(first),
        pageCount: pages.length,
        calibrated: pages.some(sheetIsCalibrated),
        hasDrawing: pages.length > 0,
        thumbnailUrl: first?.thumbnailFileUrl ?? first?.originalFileUrl ?? null,
      }
    })

    // Orphan sheets (floor deleted but pages remain)
    for (const [fid, pages] of byFloor) {
      if (floors.some((f) => f.floorId === fid)) continue
      const first = pages[0]
      floorRows.push({
        floorId: fid,
        floorLabel: '(removed floor)',
        sortOrder: 9999,
        pages,
        filename: drawingDisplayName(first),
        pageCount: pages.length,
        calibrated: pages.some(sheetIsCalibrated),
        hasDrawing: true,
        thumbnailUrl: first?.thumbnailFileUrl ?? first?.originalFileUrl ?? null,
      })
    }

    floorRows.sort((a, b) => a.sortOrder - b.sortOrder || a.floorId.localeCompare(b.floorId))

    const q = query.trim().toLowerCase()
    if (!q) return floorRows
    return floorRows.filter(
      (r) =>
        r.floorId.toLowerCase().includes(q) ||
        r.floorLabel.toLowerCase().includes(q) ||
        r.filename.toLowerCase().includes(q),
    )
  }, [floors, sheets, query])

  const calibratePages =
    calibrateFloorId != null
      ? (rows.find((r) => r.floorId === calibrateFloorId)?.pages ?? [])
      : []

  useEffect(() => {
    if (!awaitingFloorId) return
    const ready = sheets.some((s) => s.floorId === awaitingFloorId)
    if (!ready) return
    setAwaitingFloorId(null)
    setCalibrateFloorId(awaitingFloorId)
  }, [awaitingFloorId, sheets])

  const uploadMut = useMutation({
    mutationFn: ({ floorId, file }: { floorId: string; file: File }) =>
      uploadFloorPdf(projectId, floorId, file),
    onSuccess: async (_data, vars) => {
      setUploadError(null)
      setAwaitingFloorId(vars.floorId)
      await qc.invalidateQueries({ queryKey: ['projects', projectId, 'sheets'] })
      await qc.invalidateQueries({
        queryKey: ['projects', projectId, 'sheets', vars.floorId],
      })
    },
    onError: (err: Error) => {
      setUploadError(err.message)
      setAwaitingFloorId(null)
    },
  })

  function pickReplace(floorId: string) {
    setReplaceFloorId(floorId)
    setUploadError(null)
    requestAnimationFrame(() => fileRef.current?.click())
  }

  const withDrawing = rows.filter((r) => r.hasDrawing).length
  const calibratedCount = rows.filter((r) => r.calibrated).length

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-shrink-0 space-y-3 px-6 pb-4 pt-2">
        <div>
          <h2 className="font-display text-lg text-ink">Drawings Register</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-steel">
            All floor drawings for this project. One PDF per floor — upload or
            replace from here without leaving the register. Calibration still
            uses the same scale tool as the floor bar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Search floor or filename…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-[14rem] border border-steel-border bg-panel px-2.5 py-1.5 text-xs text-ink outline-none"
          />
          <span className="text-[11px] text-steel">
            {withDrawing} drawing{withDrawing === 1 ? '' : 's'}
            {floors.length > 0
              ? ` · ${calibratedCount} calibrated · ${floors.length} floor${floors.length === 1 ? '' : 's'}`
              : null}
          </span>
          {awaitingFloorId ? (
            <span className="text-[11px] text-signal">
              Converting PDF for {awaitingFloorId}…
            </span>
          ) : null}
          {uploadError ? (
            <span className="text-[11px] text-danger">{uploadError}</span>
          ) : null}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          const floorId = replaceFloorId
          setReplaceFloorId(null)
          if (file && floorId) {
            uploadMut.mutate({ floorId, file })
          }
        }}
      />

      <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
        {floors.length === 0 ? (
          <div className="border border-dashed border-steel-border bg-panel px-6 py-10 text-sm text-steel">
            Add floors first (Floors step), then upload a PDF per floor.
          </div>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-steel-border bg-panel px-6 py-10 text-sm text-steel">
            No floors match “{query}”.
          </div>
        ) : (
          <DataTable compact>
            <DataTable.Header>
              <DataTable.Row>
                <DataTable.HeaderCell className="w-14" />
                <DataTable.HeaderCell>Floor</DataTable.HeaderCell>
                <DataTable.HeaderCell>Drawing</DataTable.HeaderCell>
                <DataTable.HeaderCell className="w-20">Pages</DataTable.HeaderCell>
                <DataTable.HeaderCell className="w-36">Status</DataTable.HeaderCell>
                <DataTable.HeaderCell className="w-64">Actions</DataTable.HeaderCell>
              </DataTable.Row>
            </DataTable.Header>
            <DataTable.Body>
              {rows.map((row) => (
                <DataTable.Row key={row.floorId}>
                  <DataTable.Cell>
                    {row.thumbnailUrl ? (
                      <img
                        src={resolveMediaUrl(row.thumbnailUrl)}
                        alt=""
                        className="h-10 w-10 border border-steel-border object-cover bg-bg"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center border border-dashed border-steel-border text-[10px] text-steel">
                        —
                      </div>
                    )}
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <div className="font-mono text-xs text-ink">{row.floorId}</div>
                    <div className="text-[11px] text-steel">{row.floorLabel}</div>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <span className="text-xs text-ink">
                      {row.hasDrawing ? row.filename : 'No drawing'}
                    </span>
                  </DataTable.Cell>
                  <DataTable.Cell className="font-mono text-xs">
                    {row.hasDrawing ? row.pageCount : '—'}
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <StatusPill
                      hasDrawing={row.hasDrawing}
                      calibrated={row.calibrated}
                      converting={awaitingFloorId === row.floorId}
                    />
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <div className="flex flex-wrap gap-1.5">
                      <GhostButton
                        type="button"
                        className="!px-2 !py-1 text-[11px]"
                        onClick={() => onOpenFloor(row.floorId)}
                      >
                        Open floor
                      </GhostButton>
                      {row.hasDrawing ? (
                        <GhostButton
                          type="button"
                          className="!px-2 !py-1 text-[11px]"
                          onClick={() => setCalibrateFloorId(row.floorId)}
                        >
                          {row.calibrated ? 'Recalibrate' : 'Calibrate'}
                        </GhostButton>
                      ) : null}
                      <PrimaryButton
                        type="button"
                        className="!px-2 !py-1 text-[11px]"
                        disabled={uploadMut.isPending}
                        onClick={() => pickReplace(row.floorId)}
                      >
                        {row.hasDrawing ? 'Replace PDF' : 'Upload PDF'}
                      </PrimaryButton>
                    </div>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable.Body>
          </DataTable>
        )}
      </div>

      {calibrateFloorId && calibratePages[0] ? (
        <CalibrateFloorModal
          sheet={calibratePages[0]}
          pages={calibratePages}
          projectId={projectId}
          floorId={calibrateFloorId}
          onClose={() => setCalibrateFloorId(null)}
        />
      ) : null}
    </div>
  )
}

function StatusPill({
  hasDrawing,
  calibrated,
  converting,
}: {
  hasDrawing: boolean
  calibrated: boolean
  converting: boolean
}) {
  if (converting) {
    return (
      <span className="text-[11px] font-medium text-signal">Converting…</span>
    )
  }
  if (!hasDrawing) {
    return <span className="text-[11px] text-steel">No drawing</span>
  }
  if (calibrated) {
    return (
      <span className="text-[11px] font-medium text-emerald-700">Calibrated</span>
    )
  }
  return (
    <span className="text-[11px] font-medium text-signal">Needs calibration</span>
  )
}
