import { useEffect, useRef, useState } from 'react'
import {
  commitRatePdfImport,
  getRatePdfImportJob,
  startRatePdfImport,
} from '../../api/projectsApi'
import { ApiError } from '../../lib/api'
import type { RateLib } from '../../types/rateLib'
import type {
  RatePdfImportJob,
  RatePdfSuggestion,
  RateSuggestionCategory,
  RateSuggestionStatus,
} from '../../types/ratePdfImport'
import { Modal } from '../modals/Modal'
import { DataTable, GhostButton, NumericInput, PrimaryButton } from '../ui'

const inputCls =
  'border border-steel-border bg-bg px-1.5 py-1 text-xs text-ink outline-none'

function money(n: number | null | undefined, currency: string): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  return `${currency || 'USD'} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function RatePdfImportPanel({
  projectId,
  currency,
  onCommitted,
}: {
  projectId: string
  currency: string
  onCommitted: (rateLib: RateLib) => void
}) {
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [job, setJob] = useState<RatePdfImportJob | null>(null)
  const [rows, setRows] = useState<RatePdfSuggestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [committing, setCommitting] = useState(false)

  function close() {
    setOpen(false)
    setJob(null)
    setRows([])
    setError(null)
    setUploading(false)
    setCommitting(false)
    if (pdfInputRef.current) pdfInputRef.current.value = ''
  }

  async function onPick(file: File | undefined) {
    if (!file) return
    setOpen(true)
    setUploading(true)
    setError(null)
    setJob(null)
    setRows([])
    try {
      const { job: created } = await startRatePdfImport(projectId, file)
      setJob(created)
      setRows(created.suggestions || [])
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Failed to start PDF import'
      setError(msg)
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
        const { job: next } = await getRatePdfImportJob(projectId, job.id)
        if (cancelled) return
        setJob(next)
        if (next.status === 'SUCCEEDED') setRows(next.suggestions || [])
        if (next.status === 'FAILED') {
          setError(next.error || 'PDF extraction failed')
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : 'Failed to poll import job',
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

  function patchRow(id: string, patch: Partial<RatePdfSuggestion>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function setAllStatus(status: RateSuggestionStatus) {
    setRows((prev) => prev.map((r) => ({ ...r, status })))
  }

  const acceptedCount = rows.filter((r) => r.status === 'ACCEPTED').length
  const pendingCount = rows.filter((r) => r.status === 'PENDING').length
  const running = job?.status === 'QUEUED' || job?.status === 'RUNNING' || uploading

  async function onCommit() {
    if (!job || !acceptedCount) return
    setCommitting(true)
    setError(null)
    try {
      const result = await commitRatePdfImport(
        projectId,
        job.id,
        rows.map((r) => ({
          id: r.id,
          category: r.category,
          name: r.name,
          unit: r.unit,
          unitCost: r.unitCost,
          status: r.status,
        })),
      )
      onCommitted(result.project.rateLib)
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
        ref={pdfInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          void onPick(e.target.files?.[0])
        }}
      />
      <GhostButton
        className="!text-xs !py-1.5 !px-3"
        disabled={uploading}
        onClick={() => pdfInputRef.current?.click()}
      >
        Import from PDF
      </GhostButton>

      <Modal
        open={open}
        title="Import rate databank (PDF)"
        onClose={close}
        size="xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-steel leading-relaxed">
            AI-extracted rows are <span className="text-ink">suggestions only</span>.
            Review every unit cost, then accept or reject each line before importing
            into the real databank. Nothing is committed automatically.
          </p>

          {running && (
            <p className="text-sm text-ink">
              {uploading
                ? 'Uploading PDF…'
                : job?.status === 'QUEUED'
                  ? 'Queued for extraction…'
                  : 'Extracting rates with AI (background job)…'}
            </p>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          {job?.status === 'SUCCEEDED' && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs text-steel">
                <span>
                  {rows.length} suggestions · {acceptedCount} accepted ·{' '}
                  {pendingCount} pending
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
                  No rate lines were extracted from this PDF.
                </p>
              ) : (
                <div className="border border-steel-border max-h-80 overflow-auto">
                  <DataTable compact>
                    <DataTable.Header>
                      <DataTable.Row>
                        <DataTable.HeaderCell>Status</DataTable.HeaderCell>
                        <DataTable.HeaderCell>Category</DataTable.HeaderCell>
                        <DataTable.HeaderCell>Name</DataTable.HeaderCell>
                        <DataTable.HeaderCell>Unit</DataTable.HeaderCell>
                        <DataTable.HeaderCell align="right">
                          Unit cost ({currency})
                        </DataTable.HeaderCell>
                        <DataTable.HeaderCell align="right">Conf.</DataTable.HeaderCell>
                        <DataTable.HeaderCell className="w-28" />
                      </DataTable.Row>
                    </DataTable.Header>
                    <DataTable.Body>
                      {rows.map((row) => (
                        <DataTable.Row
                          key={row.id}
                          className={
                            row.status === 'REJECTED'
                              ? 'opacity-50'
                              : row.status === 'ACCEPTED'
                                ? 'bg-signal/5'
                                : undefined
                          }
                        >
                          <DataTable.Cell className="text-[11px] font-mono text-steel">
                            {row.status}
                          </DataTable.Cell>
                          <DataTable.Cell>
                            <select
                              className={inputCls}
                              value={row.category}
                              disabled={row.status === 'REJECTED'}
                              onChange={(e) =>
                                patchRow(row.id, {
                                  category: e.target.value as RateSuggestionCategory,
                                })
                              }
                            >
                              <option value="materials">materials</option>
                              <option value="labour">labour</option>
                              <option value="equipment">equipment</option>
                            </select>
                          </DataTable.Cell>
                          <DataTable.Cell>
                            <input
                              className={`${inputCls} w-full min-w-[8rem]`}
                              value={row.name}
                              disabled={row.status === 'REJECTED'}
                              onChange={(e) =>
                                patchRow(row.id, { name: e.target.value })
                              }
                            />
                          </DataTable.Cell>
                          <DataTable.Cell>
                            <input
                              className={`${inputCls} w-16`}
                              value={row.unit}
                              disabled={row.status === 'REJECTED'}
                              onChange={(e) =>
                                patchRow(row.id, { unit: e.target.value })
                              }
                            />
                          </DataTable.Cell>
                          <DataTable.Cell className="text-right">
                            <NumericInput
                              className={`${inputCls} w-24 text-right font-mono`}
                              value={row.unitCost}
                              emptyValue={0}
                              min={0}
                              showError={false}
                              disabled={row.status === 'REJECTED'}
                              onChange={(n) =>
                                patchRow(row.id, {
                                  unitCost: n ?? 0,
                                })
                              }
                            />
                          </DataTable.Cell>
                          <DataTable.Cell numeric className="text-[11px] text-steel">
                            {Math.round(row.confidence * 100)}%
                          </DataTable.Cell>
                          <DataTable.Cell>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                className="text-[11px] text-ink underline"
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
                      ))}
                    </DataTable.Body>
                  </DataTable>
                </div>
              )}

              {acceptedCount > 0 && (
                <p className="text-[11px] text-steel">
                  Will import {acceptedCount} item{acceptedCount === 1 ? '' : 's'}
                  {acceptedCount <= 3
                    ? `: ${rows
                        .filter((r) => r.status === 'ACCEPTED')
                        .map((r) => `${r.name} (${money(r.unitCost, currency)})`)
                        .join('; ')}`
                    : ''}
                  .
                </p>
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
                ? 'Importing…'
                : `Import ${acceptedCount} accepted`}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </>
  )
}
