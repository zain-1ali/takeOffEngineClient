import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { searchProjectTakeoffs } from '../../api/projectsApi'
import type { ReportLine } from '../../types/reports'
import { GhostButton, PrimaryButton } from '../ui'

export function BoqQtyDialog({
  open,
  line,
  projectId,
  onClose,
  onApplyQty,
  onOpenSchedule,
}: {
  open: boolean
  line: ReportLine | null
  projectId: string
  onClose: () => void
  onApplyQty: (qty: number) => void
  onOpenSchedule: () => void
}) {
  const [manual, setManual] = useState('')
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    if (!open || !line) return
    setManual(line.qty != null && line.qty > 0 ? String(line.qty) : '')
    setQ(line.ref || '')
    setDebounced(line.ref || '')
  }, [open, line])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q])

  const takeoffQuery = useQuery({
    queryKey: ['takeoff-search', projectId, debounced],
    queryFn: () => searchProjectTakeoffs(projectId, debounced || undefined),
    enabled: open && !!projectId,
  })

  if (!open || !line) return null

  const suggested = line.suggestedQty != null && line.suggestedQty > 0
    ? line.suggestedQty
    : null

  function applyManual() {
    const n = Number(manual)
    if (!Number.isFinite(n) || n < 0) return
    onApplyQty(n)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/50 p-3"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Set quantity"
        className="w-full max-w-md border border-steel-border bg-panel shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 px-3 py-2 border-b border-steel-border">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-ink">
              Qty — {line.ref}
            </p>
            <p className="text-[11px] text-steel line-clamp-2">
              {line.description}
            </p>
          </div>
          <button
            type="button"
            className="text-steel hover:text-ink px-1"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-3 py-2 space-y-2 border-b border-steel-border">
          <label className="block text-[11px] text-steel">
            Type quantity ({line.unit || 'unit'})
          </label>
          <div className="flex gap-1.5">
            <input
              type="number"
              min={0}
              step="any"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyManual()
              }}
              className="flex-1 border border-steel-border bg-bg px-2 py-1 text-[13px] text-ink outline-none"
              autoFocus
            />
            <PrimaryButton
              type="button"
              className="!px-3 !py-1.5 text-[12px]"
              onClick={applyManual}
            >
              Apply
            </PrimaryButton>
          </div>
        </div>

        <div className="px-3 py-2 space-y-1.5 border-b border-steel-border">
          <p className="text-[11px] text-steel">Or get qty from schedule</p>
          {suggested != null && (
            <GhostButton
              type="button"
              className="!px-3 !py-1.5 text-[12px] w-full justify-start"
              onClick={() => onApplyQty(suggested)}
            >
              Use schedule calc ({suggested} {line.unit})
            </GhostButton>
          )}
          <GhostButton
            type="button"
            className="!px-3 !py-1.5 text-[12px] w-full justify-start"
            onClick={onOpenSchedule}
          >
            Open schedule to enter numbers
          </GhostButton>
        </div>

        <div className="px-3 py-2 flex-1 min-h-0 flex flex-col">
          <label className="block text-[11px] text-steel mb-1">
            Search previous takeoff by item code / label
          </label>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Code or label…"
            className="w-full border border-steel-border bg-bg px-2 py-1 text-[12px] text-ink outline-none mb-2"
          />
          <div className="min-h-0 flex-1 overflow-y-auto max-h-48 border border-steel-border">
            {takeoffQuery.isLoading && (
              <p className="px-2 py-2 text-[11px] text-steel">Searching…</p>
            )}
            {!takeoffQuery.isLoading &&
              (takeoffQuery.data?.items || []).length === 0 && (
                <p className="px-2 py-2 text-[11px] text-steel">
                  No takeoff matches.
                </p>
              )}
            <ul className="divide-y divide-steel-border/50">
              {(takeoffQuery.data?.items || []).map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className="w-full text-left px-2 py-1.5 hover:bg-panel-hover"
                    onClick={() => onApplyQty(hit.qty)}
                  >
                    <span className="flex items-baseline gap-1.5">
                      <span className="font-mono text-[11px] text-ink">
                        {hit.qty} {hit.unit}
                      </span>
                      <span className="text-[10px] text-steel uppercase">
                        {hit.type}
                      </span>
                    </span>
                    <span className="block text-[11px] text-ink truncate">
                      {hit.label || '(untitled)'}
                    </span>
                    <span className="block text-[10px] text-steel truncate">
                      {hit.sheetName}
                      {hit.floorId ? ` · ${hit.floorId}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
