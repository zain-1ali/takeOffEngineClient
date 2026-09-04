import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addSelectedBoqItems,
  listBoqCatalogue,
  listSelectedBoqItems,
} from '../../api/projectsApi'
import { GhostButton, PrimaryButton } from '../ui'

const PANEL_WIDTH = 360
const PANEL_MAX_HEIGHT = 560
const GAP = 8

function clampPanelPosition(anchor: DOMRect): { top: number; left: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left = anchor.right + GAP
  if (left + PANEL_WIDTH > vw - 12) {
    left = Math.max(12, anchor.left - GAP - PANEL_WIDTH)
  }
  let top = anchor.top
  const maxH = Math.min(PANEL_MAX_HEIGHT, vh - 24)
  if (top + maxH > vh - 12) {
    top = Math.max(12, vh - maxH - 12)
  }
  return { top, left }
}

/**
 * Popover: multi-select Detailed BOQ Items for one element, then Add to BOQ.
 * Portaled to document.body so it sits outside the sidebar (no horizontal scroll).
 */
export function ElementBoqPicker({
  projectId,
  floorId,
  elementKey,
  elementLabel,
  open,
  anchorRect,
  onClose,
  onAdded,
}: {
  projectId: string
  floorId: string
  elementKey: string
  elementLabel: string
  open: boolean
  /** Trigger button bounds — panel opens to the right of the sidebar. */
  anchorRect: DOMRect | null
  onClose: () => void
  onAdded?: (elementKey: string) => void
}) {
  const qc = useQueryClient()
  const panelRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [filter, setFilter] = useState('')
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchorRect) {
      setPos(null)
      return
    }
    setPos(clampPanelPosition(anchorRect))
  }, [open, anchorRect])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onResize() {
      onClose()
    }
    function onScroll(e: Event) {
      // Keep open while scrolling inside the panel list
      if (panelRef.current?.contains(e.target as Node)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (panelRef.current?.contains(t)) return
      // Ignore clicks on the ▸ trigger — ElementTree toggles it
      if ((t as HTMLElement).closest?.('[data-boq-picker-trigger]')) return
      onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose])

  const catalogueQuery = useQuery({
    queryKey: ['boq-catalogue', projectId, elementKey, floorId],
    queryFn: () => listBoqCatalogue(projectId, { elementKey, floorId }),
    enabled: open && !!projectId && !!elementKey,
  })

  const selectedQuery = useQuery({
    queryKey: ['selected-boq', projectId, floorId, elementKey],
    queryFn: () =>
      listSelectedBoqItems(projectId, { floorId, elementKey }),
    enabled: open && !!projectId && !!floorId && !!elementKey,
  })

  const alreadyOnBoq = useMemo(() => {
    const set = new Set<string>()
    for (const item of selectedQuery.data?.items || []) {
      set.add(item.catalogueRef.trim())
    }
    return set
  }, [selectedQuery.data])

  useEffect(() => {
    if (!open) {
      setSelected(new Set())
      setFilter('')
    }
  }, [open, elementKey])

  const items = catalogueQuery.data?.items || []
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (i) =>
        i.ref.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.workCategory.toLowerCase().includes(q),
    )
  }, [items, filter])

  const addMut = useMutation({
    mutationFn: (catalogueRefs: string[]) =>
      addSelectedBoqItems(projectId, {
        floorId,
        elementKey,
        catalogueRefs,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['selected-boq', projectId] })
      void qc.invalidateQueries({ queryKey: ['reports', projectId] })
      setSelected(new Set())
      onAdded?.(elementKey)
      onClose()
    },
  })

  if (!open || !pos) return null

  function toggle(ref: string) {
    if (alreadyOnBoq.has(ref)) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(ref)) next.delete(ref)
      else next.add(ref)
      return next
    })
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const i of filtered) {
        if (!alreadyOnBoq.has(i.ref)) next.add(i.ref)
      }
      return next
    })
  }

  const pendingCount = selected.size

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[80] w-[360px] max-h-[min(560px,calc(100vh-24px))] flex flex-col rounded border border-steel-border bg-panel shadow-xl"
      style={{ top: pos.top, left: pos.left }}
      role="dialog"
      aria-label={`Add BOQ items for ${elementLabel}`}
    >
      <div className="flex items-start justify-between gap-2 border-b border-steel-border px-2.5 py-1.5 flex-shrink-0">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-ink truncate">
            Detailed BOQ Items
          </p>
          <p className="text-[10px] text-steel truncate">{elementLabel}</p>
        </div>
        <button
          type="button"
          className="text-steel hover:text-ink text-sm px-1 leading-none"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="px-2.5 py-1.5 border-b border-steel-border space-y-1 flex-shrink-0">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter ref / text…"
          className="w-full border border-steel-border bg-bg px-1.5 py-1 text-[11px] text-ink outline-none"
        />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="text-[10px] text-chalk hover:underline"
            onClick={selectAllVisible}
          >
            Select all visible
          </button>
          <span className="text-[10px] text-steel tabular-nums">
            {pendingCount} selected
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {catalogueQuery.isLoading && (
          <p className="px-2.5 py-3 text-[11px] text-steel">Loading…</p>
        )}
        {catalogueQuery.isError && (
          <p className="px-2.5 py-3 text-[11px] text-danger">
            Failed to load catalogue.
          </p>
        )}
        {!catalogueQuery.isLoading && filtered.length === 0 && (
          <p className="px-2.5 py-3 text-[11px] text-steel">
            No items{filter ? ' match filter' : ''}.
          </p>
        )}
        <ul className="divide-y divide-steel-border/50">
          {filtered.map((item) => {
            const onBoq = alreadyOnBoq.has(item.ref)
            const checked = onBoq || selected.has(item.ref)
            return (
              <li key={item.ref}>
                <label
                  className={`flex gap-1.5 px-2 py-1 cursor-pointer hover:bg-panel-hover ${
                    onBoq ? 'opacity-60' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 flex-shrink-0 scale-90"
                    checked={checked}
                    disabled={onBoq}
                    onChange={() => toggle(item.ref)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1">
                      <span className="font-mono text-[10px] text-steel">
                        {item.ref}
                      </span>
                      <span className="text-[9px] uppercase text-steel">
                        {item.unit}
                      </span>
                      {onBoq && (
                        <span className="text-[9px] text-signal">On BOQ</span>
                      )}
                    </span>
                    <span className="block text-[11px] text-ink leading-tight line-clamp-2">
                      {item.description}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex items-center justify-end gap-1.5 border-t border-steel-border px-2.5 py-1.5 flex-shrink-0">
        <GhostButton type="button" className="!px-3 !py-1.5 text-[12px]" onClick={onClose}>
          Cancel
        </GhostButton>
        <PrimaryButton
          type="button"
          className="!px-3 !py-1.5 text-[12px]"
          disabled={pendingCount === 0 || addMut.isPending}
          onClick={() => addMut.mutate([...selected])}
        >
          {addMut.isPending ? 'Adding…' : 'Add to BOQ'}
        </PrimaryButton>
      </div>
      {addMut.isError && (
        <p className="px-2.5 pb-1.5 text-[10px] text-danger">
          Could not add items. Try again.
        </p>
      )}
    </div>,
    document.body,
  )
}
