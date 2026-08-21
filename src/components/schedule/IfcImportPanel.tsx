import { useEffect, useMemo, useRef, useState } from 'react'
import {
  acceptIfcSuggestion,
  getIfcImportJob,
  listIfcSuggestions,
  rejectIfcSuggestion,
  startIfcImport,
} from '../../api/projectsApi'
import { ApiError } from '../../lib/api'
import type {
  IfcImportJob,
  IfcMappedInstanceData,
  IfcSuggestion,
} from '../../types/ifcImport'
import { Modal } from '../modals/Modal'
import { DataTable, GhostButton, PrimaryButton } from '../ui'

const inputCls =
  'border border-steel-border bg-bg px-1.5 py-1 text-xs text-ink outline-none'

const IFC_MAX_UPLOAD_BYTES = 200 * 1024 * 1024

const CONF_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const

function geoVal(
  data: IfcMappedInstanceData | null | undefined,
  key: string,
): string {
  const v = data?.geometry?.[key]
  return v == null ? '' : String(v)
}

function wallMissingFields(row: IfcSuggestion): string[] {
  if (row.entityType !== 'IfcWall') return ['Not a wall']
  const data = row.mappedInstanceData
  const missing: string[] = []
  const shape = data?.shape
  const g = data?.geometry
  if (shape !== 'LINEAR' && shape !== 'CURVED') missing.push('Shape')
  if (!(Number(g?.thickness) > 0)) missing.push('Thickness (T)')
  if (!(Number(g?.height) > 0)) missing.push('Height (H)')
  if (shape === 'LINEAR' && !(Number(g?.length) > 0)) missing.push('Length (L)')
  if (shape === 'CURVED') {
    if (!(Number(g?.radius) > 0)) missing.push('Radius')
    if (!(Number(g?.arcAngleDeg) > 0)) missing.push('Arc angle')
  }
  return missing
}

/** Default LINEAR + seed thickness from name like "Wall 50 cm" when mapper left gaps. */
function normalizeSuggestionRow(s: IfcSuggestion): IfcSuggestion {
  if (s.entityType !== 'IfcWall' || s.status !== 'PENDING') return s
  const prev = s.mappedInstanceData || {
    elementKey: 'WALLS' as const,
    shape: null,
    mark: null,
    geometry: null,
  }
  const geometry: Record<string, number> = { ...(prev.geometry || {}) }
  if (!(Number(geometry.height) > 0) && geometry.height != null) {
    /* keep */
  }
  if (!(Number(geometry.thickness) > 0)) {
    const m = /(\d+(?:\.\d+)?)\s*cm/i.exec(s.name || '')
    if (m) geometry.thickness = Number(m[1]) / 100
  }
  const shape = prev.shape === 'LINEAR' || prev.shape === 'CURVED' ? prev.shape : 'LINEAR'
  return {
    ...s,
    mappedInstanceData: {
      elementKey: prev.elementKey || 'WALLS',
      shape,
      mark: prev.mark,
      geometry: Object.keys(geometry).length ? geometry : prev.geometry,
    },
  }
}

function sortSuggestions(rows: IfcSuggestion[]): IfcSuggestion[] {
  return [...rows].sort((a, b) => {
    if (a.entityType !== b.entityType) {
      return a.entityType.localeCompare(b.entityType)
    }
    const rd = CONF_ORDER[a.confidence] - CONF_ORDER[b.confidence]
    if (rd !== 0) return rd
    if (a.needsManualModeling !== b.needsManualModeling) {
      return a.needsManualModeling ? 1 : -1
    }
    return a.expressId - b.expressId
  })
}

function groupByType(rows: IfcSuggestion[]) {
  const walls = rows.filter((r) => r.entityType === 'IfcWall')
  const slabs = rows.filter((r) => r.entityType === 'IfcSlab')
  return { walls, slabs }
}

export function IfcImportPanel({
  projectId,
  floorId,
  onCommitted,
}: {
  projectId: string
  floorId: string
  onCommitted: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [job, setJob] = useState<IfcImportJob | null>(null)
  const [rows, setRows] = useState<IfcSuggestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  function close() {
    setOpen(false)
    setJob(null)
    setRows([])
    setError(null)
    setUploading(false)
    setUploadPercent(0)
    setBusyId(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function loadSuggestions(jobId: string) {
    const { suggestions } = await listIfcSuggestions(projectId, jobId)
    setRows(sortSuggestions(suggestions.map(normalizeSuggestionRow)))
  }

  async function onPick(file: File | undefined) {
    if (!file) return
    setOpen(true)
    setError(null)
    setJob(null)
    setRows([])

    if (file.size > IFC_MAX_UPLOAD_BYTES) {
      setError('File too large (max 200 MB)')
      return
    }

    setUploading(true)
    setUploadPercent(0)
    try {
      const { job: created } = await startIfcImport(
        projectId,
        file,
        ({ percent }) => setUploadPercent(percent),
      )
      setUploadPercent(100)
      setJob(created)
      if (created.status === 'SUCCEEDED') {
        await loadSuggestions(created.id)
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to upload IFC file',
      )
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    if (!job) return
    if (job.status !== 'QUEUED' && job.status !== 'RUNNING') return

    let cancelled = false
    const tick = async () => {
      try {
        const { job: next } = await getIfcImportJob(projectId, job.id)
        if (cancelled) return
        setJob(next)
        if (next.status === 'SUCCEEDED') {
          await loadSuggestions(next.id)
        }
        if (next.status === 'FAILED') {
          setError(next.error || 'IFC parse failed')
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Failed to poll import job',
          )
        }
      }
    }

    const id = window.setInterval(() => {
      void tick()
    }, 1500)
    void tick()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [job?.id, job?.status, projectId])

  function patchLocal(
    id: string,
    patch: Partial<IfcMappedInstanceData>,
  ) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const base = r.mappedInstanceData || {
          elementKey: r.entityType === 'IfcWall' ? 'WALLS' : 'SLABS',
          shape: null,
          mark: null,
          geometry: null,
        }
        return {
          ...r,
          mappedInstanceData: {
            elementKey:
              patch.elementKey !== undefined
                ? patch.elementKey
                : base.elementKey,
            shape: patch.shape !== undefined ? patch.shape : base.shape,
            mark: patch.mark !== undefined ? patch.mark : base.mark,
            geometry:
              patch.geometry !== undefined ? patch.geometry : base.geometry,
          },
        }
      }),
    )
  }

  function patchGeo(id: string, key: string, raw: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const base = r.mappedInstanceData || {
          elementKey: 'WALLS' as const,
          shape: 'LINEAR' as const,
          mark: null,
          geometry: {} as Record<string, number>,
        }
        const g = { ...(base.geometry || {}) }
        const n = parseFloat(raw)
        if (Number.isFinite(n)) g[key] = n
        else delete g[key]
        return {
          ...r,
          mappedInstanceData: { ...base, geometry: g },
        }
      }),
    )
  }

  async function onAccept(row: IfcSuggestion) {
    if (!job) return
    if (row.entityType !== 'IfcWall') {
      setError('Slabs cannot be accepted yet — model them manually in Slabs.')
      return
    }
    const missing = wallMissingFields(row)
    if (missing.length) {
      setError(
        `Fill ${missing.join(', ')} before accepting “${row.name || row.sourceGlobalId}”.`,
      )
      return
    }
    setBusyId(row.id)
    setError(null)
    try {
      const res = await acceptIfcSuggestion(
        projectId,
        job.id,
        row.id,
        floorId,
        row.mappedInstanceData,
      )
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? res.suggestion : r)),
      )
      onCommitted()
      if (res.skippedDuplicate) {
        setError(
          `Already imported (GlobalId ${row.sourceGlobalId}) — linked existing instance ${res.instance?.mark || ''}`,
        )
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Accept failed')
    } finally {
      setBusyId(null)
    }
  }

  async function onReject(row: IfcSuggestion) {
    if (!job) return
    setBusyId(row.id)
    setError(null)
    try {
      const res = await rejectIfcSuggestion(projectId, job.id, row.id)
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? res.suggestion : r)),
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reject failed')
    } finally {
      setBusyId(null)
    }
  }

  const parsing = job?.status === 'QUEUED' || job?.status === 'RUNNING'
  const ready = job?.status === 'SUCCEEDED' && !uploading
  const grouped = useMemo(() => groupByType(rows), [rows])
  const pendingCount = rows.filter((r) => r.status === 'PENDING').length
  const acceptedCount = rows.filter((r) => r.status === 'ACCEPTED').length
  const manualCount = rows.filter((r) => r.needsManualModeling).length

  function renderGroup(title: string, list: IfcSuggestion[]) {
    if (!list.length) return null
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink">
          {title}{' '}
          <span className="text-steel font-normal normal-case">
            ({list.length})
          </span>
        </h3>
        <div className="border border-steel-border max-h-80 overflow-auto">
          <DataTable compact>
            <DataTable.Header>
              <DataTable.Row>
                <DataTable.HeaderCell>Conf.</DataTable.HeaderCell>
                <DataTable.HeaderCell>Name / GlobalId</DataTable.HeaderCell>
                <DataTable.HeaderCell>Mark</DataTable.HeaderCell>
                <DataTable.HeaderCell>Shape</DataTable.HeaderCell>
                <DataTable.HeaderCell align="right">L</DataTable.HeaderCell>
                <DataTable.HeaderCell align="right">T</DataTable.HeaderCell>
                <DataTable.HeaderCell align="right">H</DataTable.HeaderCell>
                <DataTable.HeaderCell>Status</DataTable.HeaderCell>
                <DataTable.HeaderCell className="w-32" />
              </DataTable.Row>
            </DataTable.Header>
            <DataTable.Body>
              {list.map((row) => {
                const missing = wallMissingFields(row)
                const incomplete = missing.length > 0
                const low = row.confidence === 'LOW'
                const manual = row.needsManualModeling
                const pending = row.status === 'PENDING'
                const canEditWall =
                  pending && row.entityType === 'IfcWall'
                return (
                  <DataTable.Row
                    key={row.id}
                    className={
                      row.status === 'REJECTED'
                        ? 'opacity-50'
                        : row.status === 'ACCEPTED'
                          ? 'bg-signal/5'
                          : low || manual
                            ? 'bg-amber-500/10'
                            : undefined
                    }
                    title={
                      [
                        ...(row.confidenceNotes || []),
                        row.skipReason || '',
                        incomplete && pending
                          ? `Need: ${missing.join(', ')}`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    }
                  >
                    <DataTable.Cell
                      className={`text-[11px] font-mono ${
                        low ? 'text-amber-700 font-semibold' : 'text-steel'
                      }`}
                    >
                      {row.confidence}
                      {manual ? (
                        <span className="block text-amber-700">manual</span>
                      ) : null}
                    </DataTable.Cell>
                    <DataTable.Cell className="text-[11px]">
                      <div className="text-ink">{row.name || '—'}</div>
                      <div className="font-mono text-steel truncate max-w-[10rem]">
                        {row.sourceGlobalId}
                      </div>
                      {row.skipReason ? (
                        <div className="text-[10px] text-amber-700 mt-0.5">
                          {row.skipReason}
                        </div>
                      ) : null}
                    </DataTable.Cell>
                    <DataTable.Cell>
                      <input
                        className={`${inputCls} w-16 font-mono`}
                        placeholder="auto"
                        value={row.mappedInstanceData?.mark || ''}
                        disabled={!canEditWall}
                        onChange={(e) =>
                          patchLocal(row.id, {
                            mark: e.target.value || null,
                          })
                        }
                      />
                    </DataTable.Cell>
                    <DataTable.Cell>
                      {canEditWall ? (
                        <select
                          className={`${inputCls} font-mono`}
                          value={row.mappedInstanceData?.shape || ''}
                          onChange={(e) =>
                            patchLocal(row.id, {
                              shape: e.target.value || null,
                            })
                          }
                        >
                          <option value="">—</option>
                          <option value="LINEAR">LINEAR</option>
                          <option value="CURVED">CURVED</option>
                        </select>
                      ) : (
                        <span className="font-mono text-[11px]">
                          {row.mappedInstanceData?.shape || '—'}
                        </span>
                      )}
                    </DataTable.Cell>
                    <DataTable.Cell className="text-right">
                      <input
                        type="number"
                        step="0.01"
                        className={`${inputCls} w-16 text-right font-mono`}
                        value={geoVal(row.mappedInstanceData, 'length')}
                        disabled={
                          !canEditWall ||
                          row.mappedInstanceData?.shape !== 'LINEAR'
                        }
                        onChange={(e) =>
                          patchGeo(row.id, 'length', e.target.value)
                        }
                      />
                    </DataTable.Cell>
                    <DataTable.Cell className="text-right">
                      <input
                        type="number"
                        step="0.001"
                        className={`${inputCls} w-16 text-right font-mono`}
                        value={geoVal(row.mappedInstanceData, 'thickness')}
                        disabled={!canEditWall}
                        onChange={(e) =>
                          patchGeo(row.id, 'thickness', e.target.value)
                        }
                      />
                    </DataTable.Cell>
                    <DataTable.Cell className="text-right">
                      <input
                        type="number"
                        step="0.01"
                        className={`${inputCls} w-16 text-right font-mono`}
                        value={geoVal(row.mappedInstanceData, 'height')}
                        disabled={!canEditWall}
                        onChange={(e) =>
                          patchGeo(row.id, 'height', e.target.value)
                        }
                      />
                    </DataTable.Cell>
                    <DataTable.Cell className="text-[11px] font-mono text-steel">
                      {row.status}
                    </DataTable.Cell>
                    <DataTable.Cell>
                      {pending ? (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="text-[11px] text-ink underline disabled:opacity-40"
                            disabled={
                              busyId === row.id || row.entityType !== 'IfcWall'
                            }
                            title={
                              incomplete
                                ? `Fill ${missing.join(', ')} first`
                                : 'Create schedule instance'
                            }
                            onClick={() => void onAccept(row)}
                          >
                            {busyId === row.id ? '…' : 'Accept'}
                          </button>
                          <button
                            type="button"
                            className="text-[11px] text-danger underline disabled:opacity-40"
                            disabled={busyId === row.id}
                            onClick={() => void onReject(row)}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-steel">—</span>
                      )}
                    </DataTable.Cell>
                  </DataTable.Row>
                )
              })}
            </DataTable.Body>
          </DataTable>
        </div>
      </div>
    )
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".ifc,application/x-step,application/octet-stream"
        className="hidden"
        onChange={(e) => {
          void onPick(e.target.files?.[0])
        }}
      />
      <GhostButton
        className="!text-xs !py-2"
        disabled={uploading || parsing}
        onClick={() => fileRef.current?.click()}
      >
        Import from IFC
      </GhostButton>

      <Modal open={open} title="Import from IFC — review" onClose={close} size="xl">
        <div className="space-y-4">
          <p className="text-xs text-steel leading-relaxed">
            Upload runs the IFC parser in the background. Walls are mapped when
            possible; slabs and skipped entities are listed for{' '}
            <span className="text-ink">manual modeling</span>. Accept creates a
            schedule instance tagged <span className="font-mono">IFC_IMPORT</span>{' '}
            (duplicate GlobalIds are skipped). Max file size{' '}
            <span className="font-mono text-ink">200 MB</span>.
          </p>

          {uploading && (
            <div className="space-y-2" role="status" aria-live="polite">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-ink">Uploading IFC file</p>
                <p className="font-mono text-sm tabular-nums text-signal-text">
                  {uploadPercent}%
                </p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-sm bg-steel-border/60">
                <div
                  className="ifc-upload-bar h-full rounded-sm bg-signal"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-steel">
                {uploadPercent < 100
                  ? 'Sending file to the server…'
                  : 'Upload complete — starting parse…'}
              </p>
            </div>
          )}
          {!uploading && job?.status === 'QUEUED' && (
            <p className="text-sm text-ink">Queued for parsing…</p>
          )}
          {!uploading && job?.status === 'RUNNING' && (
            <p className="text-sm text-ink">
              Parsing IFC… Large models can take several minutes.
            </p>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          {ready && job && (
            <>
              <div className="flex flex-wrap gap-3 text-xs text-steel">
                <span>
                  {job.fileName} · floor{' '}
                  <span className="font-mono text-ink">{floorId}</span>
                </span>
                <span>
                  {rows.length} suggestions · {pendingCount} pending ·{' '}
                  {acceptedCount} accepted · {manualCount} need manual modeling
                </span>
                <span>
                  parse: {job.summary.walls} walls / {job.summary.slabs} slabs
                  {job.summary.skipped
                    ? ` · ${job.summary.skipped} skipped geometry`
                    : ''}
                </span>
              </div>

              {rows.length === 0 ? (
                <p className="text-sm text-steel">
                  No wall or slab entities were found in this IFC.
                </p>
              ) : (
                <div className="space-y-5">
                  {renderGroup('Walls', grouped.walls)}
                  {renderGroup(
                    'Slabs (manual modeling)',
                    grouped.slabs,
                  )}
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <PrimaryButton className="!text-xs !py-2" onClick={close}>
              Done
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </>
  )
}
