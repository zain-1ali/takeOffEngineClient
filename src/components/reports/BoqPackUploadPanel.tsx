import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { getBoqPack, uploadBoqPack } from '../../api/projectsApi'
import {
  BOQ_PACK_MAX_UPLOAD_BYTES,
  BOQ_PACK_MAX_UPLOAD_LABEL,
} from '../../constants/boqPackUpload'
import { ApiError } from '../../lib/api'
import type { BoqPackUploadResult } from '../../types/boqPack'
import { Modal } from '../modals/Modal'
import { GhostButton, PrimaryButton } from '../ui'

function formatWhen(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

export function BoqPackUploadPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorList, setErrorList] = useState<string[]>([])
  const [result, setResult] = useState<BoqPackUploadResult | null>(null)

  const packQuery = useQuery({
    queryKey: ['boq-pack', projectId],
    queryFn: () => getBoqPack(projectId),
  })
  const pack = packQuery.data?.pack || null

  function close() {
    if (busy) return
    setOpen(false)
    setFile(null)
    setError(null)
    setErrorList([])
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function onReplace() {
    if (!file) return
    if (!file.size) {
      setError('Workbook file is empty')
      setErrorList(['Workbook file is empty'])
      return
    }
    if (file.size > BOQ_PACK_MAX_UPLOAD_BYTES) {
      const msg = `File too large (max ${BOQ_PACK_MAX_UPLOAD_LABEL})`
      setError(msg)
      setErrorList([msg])
      return
    }
    setBusy(true)
    setError(null)
    setErrorList([])
    try {
      const uploaded = await uploadBoqPack(projectId, file)
      setResult(uploaded)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['boq-pack', projectId] }),
        qc.invalidateQueries({ queryKey: ['reports', projectId] }),
        qc.invalidateQueries({ queryKey: ['selected-boq', projectId] }),
        qc.invalidateQueries({ queryKey: ['cost-plan', projectId] }),
        qc.invalidateQueries({ queryKey: ['pack-resources', projectId] }),
        qc.invalidateQueries({ queryKey: ['pack-analyses', projectId] }),
      ])
    } catch (err) {
      const details =
        err instanceof ApiError && err.details?.length ? err.details : null
      setErrorList(details || [])
      setError(
        err instanceof ApiError ? err.message : 'Failed to replace the BOQ catalogue',
      )
    } finally {
      setBusy(false)
    }
  }

  const items = pack?.counts.items
  const statusLabel = pack
    ? `v${pack.version} · ${pack.source.fileName}${
        items != null ? ` · ${items.toLocaleString()} lines` : ''
      }`
    : 'Default Issue Tracker (not loaded yet)'

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(e) => {
          setFile(e.target.files?.[0] || null)
          setError(null)
          setErrorList([])
          setResult(null)
        }}
      />
      <GhostButton
        className="!text-xs !py-1.5 !px-3"
        onClick={() => setOpen(true)}
      >
        Replace BOQ workbook
      </GhostButton>

      <Modal open={open} title="Replace BOQ catalogue" onClose={close} size="lg">
        <div className="space-y-4">
          <p className="text-xs text-steel leading-relaxed">
            Every project already starts with the Issue Tracker catalogue
            (Modules 0–13 and 15–17, Rates Schedule, Prices Databank / Rate
            Analysis). Upload is only needed to{' '}
            <span className="text-ink">replace</span> that catalogue with another
            workbook in the same layout. Matching lines keep typed or takeoff
            quantities. 3D engines are not changed. Typical file ~2 MB; maximum{' '}
            {BOQ_PACK_MAX_UPLOAD_LABEL}. Currency is stored as labelled in the
            workbook and is not converted automatically.
          </p>

          <p className="text-xs text-ink">
            Current: <span className="font-medium">{statusLabel}</span>
            {pack?.source.uploadedAt ? (
              <span className="text-steel">
                {' '}
                · {formatWhen(pack.source.uploadedAt)}
              </span>
            ) : null}
          </p>

          {error && !errorList.length && <p className="text-sm text-danger">{error}</p>}
          {errorList.length > 0 && (
            <ul className="text-sm text-danger list-disc pl-4 space-y-0.5 max-h-40 overflow-auto">
              {errorList.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          {result?.pack && (
            <div className="border border-steel-border bg-bg px-3 py-2 space-y-1">
              <p className="text-xs text-ink">
                Active pack v{result.pack.version}: {result.pack.source.fileName}{' '}
                · {result.pack.counts.items.toLocaleString()} lines ·{' '}
                {result.pack.counts.rates.toLocaleString()} rates
                {result.pack.pricing?.currency
                  ? ` · ${result.pack.pricing.currency}`
                  : ''}
              </p>
              <p className="text-[11px] text-steel">
                Quantities kept: {result.reconcile.preserved} · Needs review:{' '}
                {result.reconcile.needsReview} · Removed lines kept as orphaned:{' '}
                {result.reconcile.orphaned} · New selected rows:{' '}
                {result.selectedCreated}
              </p>
              {result.warnings.length > 0 && (
                <p className="text-[11px] text-steel">
                  {result.warnings.length} import warning
                  {result.warnings.length === 1 ? '' : 's'}:{' '}
                  {result.warnings.slice(0, 8).join(' · ')}
                  {result.warnings.length > 8 ? '…' : ''}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <GhostButton
              className="!text-xs !py-1.5 !px-3"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              Choose .xlsx
            </GhostButton>
            {file && (
              <span className="text-xs text-ink truncate max-w-[18rem]">
                {file.name}
              </span>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <GhostButton
              className="!text-xs !py-1.5 !px-3"
              disabled={busy}
              onClick={close}
            >
              {result ? 'Close' : 'Cancel'}
            </GhostButton>
            <PrimaryButton
              className="!text-xs !py-2"
              disabled={busy || !file}
              onClick={() => {
                void onReplace()
              }}
            >
              {busy ? 'Replacing catalogue…' : 'Replace catalogue'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </>
  )
}
