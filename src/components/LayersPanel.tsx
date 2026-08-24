import { useEffect, useState } from 'react'
import type { Layer } from '../types/models'
import { LayerColorPickerField } from './LayerColorPickerField'
import { LAYER_PALETTE_SWATCHES } from '../lib/layerColorPalette'

interface LayersPanelProps {
  layers: Layer[]
  activeLayerId: string | null
  uncategorizedVisible: boolean
  collapsed?: boolean
  onToggleCollapsed?: () => void
  onSelectActive: (layerId: string | null) => void
  onToggleVisible: (layerId: string | null, visible: boolean) => void
  onAddLayer: () => void
  adding?: boolean
  showCreateForm?: boolean
  createError?: string | null
  onCancelCreate?: () => void
  onSubmitCreate?: (input: { name: string; color: string }) => void
}

export function LayersPanel({
  layers,
  activeLayerId,
  uncategorizedVisible,
  collapsed = false,
  onToggleCollapsed,
  onSelectActive,
  onToggleVisible,
  onAddLayer,
  adding,
  showCreateForm = false,
  createError = null,
  onCancelCreate,
  onSubmitCreate,
}: LayersPanelProps) {
  const sorted = [...layers].sort((a, b) => a.sortOrder - b.sortOrder)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string | null>(
    LAYER_PALETTE_SWATCHES[0],
  )

  useEffect(() => {
    if (!showCreateForm) {
      return
    }
    setNewName('')
    setNewColor(LAYER_PALETTE_SWATCHES[0])
  }, [showCreateForm])

  const canSubmit =
    showCreateForm && newName.trim().length > 0 && newColor != null && !adding

  return (
    <div className="border-b border-steel-border">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={!collapsed}
        >
          <span className="text-steel" aria-hidden>
            {collapsed ? '▸' : '▾'}
          </span>
          <span className="font-display text-xs font-bold tracking-wide text-ink uppercase">
            Layers
          </span>
        </button>
        <button
          type="button"
          onClick={onAddLayer}
          disabled={adding}
          className="flex h-6 w-6 items-center justify-center border border-steel-border text-sm text-steel transition hover:border-signal hover:text-signal disabled:opacity-40"
          aria-label="Add layer"
          title="Add layer"
        >
          +
        </button>
      </div>

      {showCreateForm && !collapsed ? (
        <div className="mx-2 mb-2 border border-signal/35 bg-bg px-2.5 py-2.5">
          <p className="font-display text-[0.65rem] font-bold tracking-wide text-signal uppercase">
            New layer
          </p>
          <label className="mt-2 block text-[0.65rem] font-medium tracking-wide text-steel uppercase">
            Name
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="e.g. Rooms"
              className="mt-1 w-full border border-steel-border bg-panel px-2 py-1.5 text-xs normal-case tracking-normal text-ink outline-none focus:border-signal"
            />
          </label>
          <div className="mt-2">
            <LayerColorPickerField value={newColor} onChange={setNewColor} />
          </div>
          {createError ? (
            <p className="mt-2 text-[0.65rem] text-danger">{createError}</p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => {
                if (!newColor || !onSubmitCreate) return
                onSubmitCreate({ name: newName.trim(), color: newColor })
              }}
              className="flex-1 bg-signal px-2 py-1.5 font-display text-[0.65rem] font-bold tracking-wide text-ink uppercase disabled:opacity-40"
            >
              {adding ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onCancelCreate}
              disabled={adding}
              className="px-2 py-1.5 text-[0.65rem] text-steel hover:text-ink disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {!collapsed ? (
        <ul className="max-h-48 space-y-0.5 overflow-y-auto px-2 pb-2">
          <LayerRow
            name="Uncategorized"
            color="#94a3b8"
            visible={uncategorizedVisible}
            active={activeLayerId === null}
            onSelect={() => onSelectActive(null)}
            onToggleVisible={() =>
              onToggleVisible(null, !uncategorizedVisible)
            }
          />
          {sorted.map((layer) => (
            <LayerRow
              key={layer.id}
              name={layer.name}
              color={layer.color}
              visible={layer.visible}
              active={activeLayerId === layer.id}
              onSelect={() => onSelectActive(layer.id)}
              onToggleVisible={() => onToggleVisible(layer.id, !layer.visible)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function LayerRow({
  name,
  color,
  visible,
  active,
  onSelect,
  onToggleVisible,
}: {
  name: string
  color: string
  visible: boolean
  active: boolean
  onSelect: () => void
  onToggleVisible: () => void
}) {
  return (
    <li
      className={`flex items-center gap-1.5 px-1.5 py-1 ${
        active ? 'bg-chalk-bg' : 'hover:bg-bg'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        title={
          active ? 'Active layer (new items go here)' : 'Set as active layer'
        }
      >
        <span
          className="inline-block h-3 w-3 shrink-0 border border-steel-border"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <span
          className={`truncate text-xs ${
            active ? 'font-medium text-ink' : 'text-steel'
          }`}
        >
          {name}
        </span>
      </button>
      <button
        type="button"
        onClick={onToggleVisible}
        className={`shrink-0 p-0.5 transition ${
          visible ? 'text-steel hover:text-ink' : 'text-steel/40'
        }`}
        aria-label={visible ? `Hide ${name}` : `Show ${name}`}
        title={visible ? 'Hide layer' : 'Show layer'}
      >
        <EyeIcon open={visible} />
      </button>
    </li>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  if (!open) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.5 5.5C10.3 5.2 11.1 5 12 5c5 0 9 4.5 10 7-0.4 1-1.2 2.4-2.5 3.7M6.1 6.1C4.4 7.5 3.3 9.2 2 12c1 2.5 5 7 10 7 1.3 0 2.5-.3 3.6-.8"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}
