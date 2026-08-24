import { useEffect, useRef, useState } from 'react'
import type { Layer, TakeoffItem } from '../types/models'
import { getColorForItem } from '../lib/itemLayerColor'

interface TakeoffSidebarProps {
  items: TakeoffItem[]
  layers?: Layer[]
  isLoading?: boolean
  onDelete?: (itemId: string) => void
  onRename?: (itemId: string, label: string | null) => void
  onChangeLayer?: (itemId: string, layerId: string | null) => void
  onSelect?: (itemId: string) => void
  selectedItemId?: string | null
  deletingId?: string | null
  /** Start Area-tool tracing for an AI item that has no shape yet. */
  onTraceShape?: (itemId: string) => void
  tracingId?: string | null
  highlightedItemId?: string | null
  onPromote?: (item: TakeoffItem) => void
}

function formatValue(value: number): string {
  if (Number.isInteger(value)) {
    return String(value)
  }
  return value.toPrecision(6).replace(/\.?0+$/, '')
}

function typeLabel(type: TakeoffItem['type']): string {
  switch (type) {
    case 'AREA':
      return 'Area'
    case 'LINEAR':
      return 'Linear'
    case 'COUNT':
      return 'Count'
    default:
      return type
  }
}

function itemDisplayName(item: TakeoffItem): string {
  if (item.label?.trim()) {
    return item.label.trim()
  }
  return typeLabel(item.type)
}

export function TakeoffSidebar({
  items,
  layers = [],
  isLoading,
  onDelete,
  onRename,
  onChangeLayer,
  onSelect,
  selectedItemId,
  deletingId,
  onTraceShape,
  tracingId,
  highlightedItemId,
  onPromote,
}: TakeoffSidebarProps) {
  const listRef = useRef<HTMLUListElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const sortedLayers = [...layers].sort((a, b) => a.sortOrder - b.sortOrder)

  const countTotal = items
    .filter((item) => item.type === 'COUNT')
    .reduce((sum, item) => sum + item.calculatedValue, 0)

  useEffect(() => {
    const focusId = highlightedItemId ?? selectedItemId
    if (!focusId || !listRef.current) {
      return
    }
    const node = listRef.current.querySelector(
      `[data-takeoff-id="${focusId}"]`,
    )
    if (node instanceof HTMLElement) {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedItemId, highlightedItemId, items])

  function beginRename(item: TakeoffItem): void {
    if (!onRename) return
    setEditingId(item.id)
    setEditName(item.label?.trim() || itemDisplayName(item))
  }

  function commitRename(itemId: string): void {
    if (!onRename) return
    const next = editName.trim()
    onRename(itemId, next.length > 0 ? next : null)
    setEditingId(null)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-steel-border px-4 py-3">
        <h2 className="font-display text-sm font-bold tracking-wide text-ink uppercase">
          Takeoff items
        </h2>
        <p className="mt-1 text-xs text-steel">
          {items.length} saved
          {countTotal > 0 ? ` · ${countTotal} counted` : ''}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="px-4 py-6 text-xs text-steel">Loading…</p>
        ) : null}

        {!isLoading && items.length === 0 ? (
          <p className="px-4 py-6 text-xs leading-relaxed text-steel">
            No measurements yet. Choose Linear, Area, or Count and click on the
            plan.
          </p>
        ) : null}

        {items.length > 0 ? (
          <ul ref={listRef} className="divide-y divide-steel-border">
            {items.map((item) => {
              const selected =
                selectedItemId === item.id || highlightedItemId === item.id
              const layerColor = getColorForItem(item, layers)

              return (
                <li
                  key={item.id}
                  data-takeoff-id={item.id}
                  className={`px-3 py-2.5 text-xs ${
                    selected
                      ? 'bg-chalk-bg ring-1 ring-inset ring-chalk/50'
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-0.5 inline-block h-3 w-3 shrink-0 border border-steel-border"
                      style={{ backgroundColor: layerColor.color }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      {editingId === item.id ? (
                        <input
                          autoFocus
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          onBlur={() => commitRename(item.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              commitRename(item.id)
                            }
                            if (event.key === 'Escape') {
                              event.preventDefault()
                              setEditingId(null)
                            }
                          }}
                          className="w-full border border-steel-border bg-bg px-1.5 py-0.5 text-xs text-ink outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelect?.(item.id)}
                          onDoubleClick={() => beginRename(item)}
                          className="block w-full truncate text-left leading-snug"
                        >
                          <span className="font-medium text-ink">
                            {itemDisplayName(item)}
                          </span>
                          <span className="text-steel"> — </span>
                          <span className="text-steel">{typeLabel(item.type)}</span>
                          <span className="text-steel"> — </span>
                          <span className="tabular-nums text-ink">
                            {formatValue(item.calculatedValue)} {item.unit}
                          </span>
                          {item.source === 'AI_SUGGESTED' ? (
                            <span className="ml-1.5 border border-chalk/40 bg-chalk-bg px-1 py-0.5 text-[0.55rem] font-semibold tracking-wide text-chalk uppercase">
                              AI Est.
                            </span>
                          ) : null}
                        </button>
                      )}
                      {item.source === 'AI_SUGGESTED' &&
                      (item.points == null || item.points.length === 0) &&
                      onTraceShape ? (
                        <button
                          type="button"
                          onClick={() => onTraceShape(item.id)}
                          className="mt-1.5 border border-chalk/40 px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-wide text-chalk uppercase hover:bg-chalk-bg"
                        >
                          {tracingId === item.id ? 'Tracing…' : 'Trace Shape'}
                        </button>
                      ) : null}
                      {onRename && editingId !== item.id ? (
                        <button
                          type="button"
                          onClick={() => beginRename(item)}
                          className="mt-1 text-[0.65rem] tracking-wide text-steel uppercase hover:text-ink"
                        >
                          Rename
                        </button>
                      ) : null}
                      {item.source === 'MANUAL' &&
                      (item.type === 'AREA' || item.type === 'LINEAR') ? (
                        item.promotedInstanceId ? (
                          <span className="mt-1 inline-block border border-success/40 px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-wide text-success uppercase">
                            Promoted
                          </span>
                        ) : onPromote ? (
                          <button
                            type="button"
                            onClick={() => onPromote(item)}
                            className="mt-1 border border-chalk/40 px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-wide text-chalk uppercase hover:bg-chalk-bg"
                          >
                            Promote to Element
                          </button>
                        ) : null
                      ) : null}
                      {onChangeLayer ? (
                        <label className="mt-1 flex items-center gap-1.5 text-[0.65rem] text-steel">
                          Layer
                          <select
                            value={item.layerId ?? ''}
                            onChange={(event) => {
                              const value = event.target.value
                              onChangeLayer(
                                item.id,
                                value === '' ? null : value,
                              )
                            }}
                            className="min-w-0 flex-1 border border-steel-border bg-bg px-1 py-0.5 text-[0.65rem] text-ink outline-none"
                          >
                            <option value="">Uncategorized</option>
                            {sortedLayers.map((layer) => (
                              <option key={layer.id} value={layer.id}>
                                {layer.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                    {onDelete ? (
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="shrink-0 text-steel transition hover:text-danger disabled:opacity-40"
                        aria-label={`Delete ${itemDisplayName(item)}`}
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
