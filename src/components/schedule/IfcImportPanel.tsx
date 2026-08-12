import { useRef, useState } from 'react'
import { commitIfcImport, startIfcImport } from '../../api/projectsApi'
import { ApiError } from '../../lib/api'
import type {
  IfcImportJob,
  IfcSuggestionStatus,
  IfcWallSuggestion,
} from '../../types/ifcImport'
import { Modal } from '../modals/Modal'
import { DataTable, GhostButton, PrimaryButton } from '../ui'

const inputCls =
  'border border-steel-border bg-bg px-1.5 py-1 text-xs text-ink outline-none'

function geoNum(
  row: IfcWallSuggestion,
  key: 'length' | 'thickness' | 'height' | 'radius' | 'arcAngleDeg',
): string {
  const v = row.geometry?.[key]
  return v == null ? '' : String(v)
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
  const [job, setJob] = useState<IfcImportJob | null>(null)
  const [rows, setRows] = useState<IfcWallSuggestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [committing, setCommitting] = useState(false)

  function close() {
    setOpen(false)
    setJob(null)
    setRows([])
    setError(null)
    setUploading(false)
    setCommitting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function onPick(file: File | undefined) {
    if (!file) return
    setOpen(true)
    setUploading(true)
    setError(null)
    setJob(null)
    setRows([])
    try {
      const { job: created } = await startIfcImport(projectId, file)
      setJob(created)
      setRows(created.suggestions || [])
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to parse IFC file',
      )
    } finally {
      setUploading(false)
    }
  }

  function patchRow(id: string, patch: Partial<IfcWallSuggestion>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function patchGeometry(
    id: string,
    key: 'length' | 'thickness' | 'height',
    raw: string,
  ) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const n = parseFloat(raw)
        const base = r.geometry || { thickness: 0, height: 0 }
        return {
          ...r,
          geometry: {
            ...base,
            [key]: Number.isFinite(n) ? n : base[key] || 0,
          },
        }
      }),
    )
  }

  function setAllStatus(status: IfcSuggestionStatus) {
    setRows((prev) =>
      prev.map((r) => {
        if (status === 'ACCEPTED' && (!r.shape || !r.geometry)) return r
        return { ...r, status }
      }),
    )
  }

  const acceptedCount = rows.filter((r) => r.status === 'ACCEPTED').length
  const pendingCount = rows.filter((r) => r.status === 'PENDING').length
  const ready =
    job?.status === 'SUCCEEDED' && !uploading && rows.length >= 0

  async function onCommit() {
    if (!job || !acceptedCount) return
    setCommitting(true)
    setError(null)
    try {
      await commitIfcImport(
        projectId,
        job.id,
        floorId,
        rows.map((r) => ({
          id: r.id,
          status: r.status,
          mark: r.mark,
          shape: r.shape,
          geometry: r.geometry,
        })),
      )
      onCommitted()
      close()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Commit failed')
    } finally {
      setCommitting(false)
    }
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
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        Import from IFC
      </GhostButton>

      <Modal open={open} title="Import walls from IFC" onClose={close} size="xl">
        <div className="space-y-4">
          <p className="text-xs text-steel leading-relaxed">
            Parsed walls are{' '}
            <span className="text-ink">suggestions only</span>. Accept or reject
            each row, edit dimensions if needed, then import accepted walls as
            schedule instances. Rebar and grade use project defaults — nothing
            is auto-committed.
          </p>

          {uploading && (
            <p className="text-sm text-ink">Parsing IFC file…</p>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          {ready && job && (
            <>
              <div className="flex flex-wrap items-center gap-3 text-xs text-steel">
                <span>
                  {job.fileName} · floor{' '}
                  <span className="font-mono text-ink">{floorId}</span> ·{' '}
                  {rows.length} walls · {acceptedCount} accepted · {pendingCount}{' '}
                  pending
                  {job.summary.skipped
                    ? ` · ${job.summary.skipped} skipped geometry`
                    : ''}
                </span>
                <span className="ml-auto flex gap-2">
                  <GhostButton
                    className="!text-[11px] !py-1 !px-2"
                    onClick={() => setAllStatus('ACCEPTED')}
                  >
                    Accept all
                  </GhostButton>
                  <GhostButton
                    className="!text-[11px] !py-1 !px-2"
                    onClick={() => setAllStatus('REJECTED')}
                  >
                    Reject all
                  </GhostButton>
                  <GhostButton
                    className="!text-[11px] !py-1 !px-2"
                    onClick={() => setAllStatus('PENDING')}
                  >
                    Reset
                  </GhostButton>
                </span>
              </div>

              {rows.length === 0 ? (
                <p className="text-sm text-steel">
                  No walls with extractable geometry were found in this IFC.
                </p>
              ) : (
                <div className="border border-steel-border max-h-96 overflow-auto">
                  <DataTable compact>
                    <DataTable.Header>
                      <DataTable.Row>
                        <DataTable.HeaderCell>Status</DataTable.HeaderCell>
                        <DataTable.HeaderCell>Name / GlobalId</DataTable.HeaderCell>
                        <DataTable.HeaderCell>Mark</DataTable.HeaderCell>
                        <DataTable.HeaderCell>Shape</DataTable.HeaderCell>
                        <DataTable.HeaderCell align="right">L</DataTable.HeaderCell>
                        <DataTable.HeaderCell align="right">T</DataTable.HeaderCell>
                        <DataTable.HeaderCell align="right">H</DataTable.HeaderCell>
                        <DataTable.HeaderCell>Conf.</DataTable.HeaderCell>
                        <DataTable.HeaderCell className="w-28" />
                      </DataTable.Row>
                    </DataTable.Header>
                    <DataTable.Body>
                      {rows.map((row) => {
                        const incomplete = !row.shape || !row.geometry
                        return (
                          <DataTable.Row
                            key={row.id}
                            className={
                              row.status === 'REJECTED'
                                ? 'opacity-50'
                                : row.status === 'ACCEPTED'
                                  ? 'bg-signal/5'
                                  : row.needsManualReview
                                    ? 'bg-amber-500/5'
                                    : undefined
                            }
                            title={row.confidenceNotes.join(' · ')}
                          >
                            <DataTable.Cell className="text-[11px] font-mono text-steel">
                              {row.status}
                              {row.needsManualReview ? (
                                <span className="block text-amber-600">review</span>
                              ) : null}
                            </DataTable.Cell>
                            <DataTable.Cell className="text-[11px]">
                              <div className="text-ink">{row.name || '—'}</div>
                              <div className="font-mono text-steel truncate max-w-[10rem]">
                                {row.sourceGlobalId}
                              </div>
                            </DataTable.Cell>
                            <DataTable.Cell>
                              <input
                                className={`${inputCls} w-16 font-mono`}
                                placeholder="auto"
                                value={row.mark || ''}
                                disabled={row.status === 'REJECTED'}
                                onChange={(e) =>
                                  patchRow(row.id, {
                                    mark: e.target.value || null,
                                  })
                                }
                              />
                            </DataTable.Cell>
                            <DataTable.Cell className="font-mono text-[11px]">
                              {row.shape || '—'}
                            </DataTable.Cell>
                            <DataTable.Cell className="text-right">
                              <input
                                type="number"
                                step="0.01"
                                className={`${inputCls} w-16 text-right font-mono`}
                                value={geoNum(row, 'length')}
                                disabled={
                                  row.status === 'REJECTED' ||
                                  row.shape !== 'LINEAR'
                                }
                                onChange={(e) =>
                                  patchGeometry(row.id, 'length', e.target.value)
                                }
                              />
                            </DataTable.Cell>
                            <DataTable.Cell className="text-right">
                              <input
                                type="number"
                                step="0.001"
                                className={`${inputCls} w-16 text-right font-mono`}
                                value={geoNum(row, 'thickness')}
                                disabled={row.status === 'REJECTED' || incomplete}
                                onChange={(e) =>
                                  patchGeometry(
                                    row.id,
                                    'thickness',
                                    e.target.value,
                                  )
                                }
                              />
                            </DataTable.Cell>
                            <DataTable.Cell className="text-right">
                              <input
                                type="number"
                                step="0.01"
                                className={`${inputCls} w-16 text-right font-mono`}
                                value={geoNum(row, 'height')}
                                disabled={row.status === 'REJECTED' || incomplete}
                                onChange={(e) =>
                                  patchGeometry(row.id, 'height', e.target.value)
                                }
                              />
                            </DataTable.Cell>
                            <DataTable.Cell className="text-[11px] font-mono text-steel">
                              {row.confidence}
                            </DataTable.Cell>
                            <DataTable.Cell>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  className="text-[11px] text-ink underline disabled:opacity-40"
                                  disabled={incomplete}
                                  onClick={() =>
                                    patchRow(row.id, { status: 'ACCEPTED' })
                                  }
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  className="text-[11px] text-danger underline"
                                  onClick={() =>
                                    patchRow(row.id, { status: 'REJECTED' })
                                  }
                                >
                                  Reject
                                </button>
                              </div>
                            </DataTable.Cell>
                          </DataTable.Row>
                        )
                      })}
                    </DataTable.Body>
                  </DataTable>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <GhostButton className="!text-xs !py-1.5 !px-3" onClick={close}>
              Cancel
            </GhostButton>
            <PrimaryButton
              className="!text-xs !py-2"
              disabled={
                committing ||
                job?.status !== 'SUCCEEDED' ||
                acceptedCount === 0
              }
              onClick={() => {
                void onCommit()
              }}
            >
              {committing
                ? 'Creating instances…'
                : `Create ${acceptedCount} instance${acceptedCount === 1 ? '' : 's'}`}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </>
  )
}
