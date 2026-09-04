import { useState } from 'react'
import {
  ELEMENT_TREE,
  elementDisplayNum,
  type ElementDef,
} from '../../constants/elementTree'
import { ElementChip } from '../ui'
import { ElementBoqPicker } from '../boq/ElementBoqPicker'

export function ElementTree({
  selectedKey,
  counts,
  onSelect,
  projectId,
  floorId,
  onBoqItemsAdded,
  registerActive = false,
  onOpenRegister,
  drawingsActive = false,
  onOpenDrawings,
}: {
  selectedKey: string
  counts: Record<string, number>
  onSelect: (el: ElementDef) => void
  /** When set with floorId, shows per-element BOQ catalogue picker. */
  projectId?: string
  floorId?: string
  /** After Add to BOQ — e.g. open that element's BOQ tab. */
  onBoqItemsAdded?: (elementKey: string) => void
  registerActive?: boolean
  onOpenRegister?: () => void
  drawingsActive?: boolean
  onOpenDrawings?: () => void
}) {
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})
  const [pickerKey, setPickerKey] = useState<string | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  const pickerEnabled = Boolean(projectId && floorId)
  const pickerEl = pickerKey
    ? ELEMENT_TREE.flatMap((m) => m.elements).find((e) => e.key === pickerKey)
    : undefined

  return (
    <aside className="w-[230px] flex-shrink-0 border-r border-steel-border overflow-y-auto py-5 bg-bg/40">
      {onOpenDrawings && (
        <button
          type="button"
          onClick={onOpenDrawings}
          className={`w-full text-left px-5 py-2 mb-1 border-l-2 text-[13px] font-medium ${
            drawingsActive
              ? 'bg-panel border-signal text-ink'
              : 'border-transparent text-ink/90 hover:bg-panel/60'
          }`}
        >
          Drawings Register
          <span className="block text-[10px] font-normal text-steel mt-0.5">
            Floor PDFs · view · QTO · replace
          </span>
        </button>
      )}
      {onOpenRegister && (
        <button
          type="button"
          onClick={onOpenRegister}
          className={`w-full text-left px-5 py-2 mb-2 border-l-2 text-[13px] font-medium ${
            registerActive
              ? 'bg-panel border-signal text-ink'
              : 'border-transparent text-ink/90 hover:bg-panel/60'
          }`}
        >
          Element Register
          <span className="block text-[10px] font-normal text-steel mt-0.5">
            24 codes · units · NRM2 · overlap
          </span>
        </button>
      )}
      {ELEMENT_TREE.map((mod) => {
        const isCollapsed = !!collapsed[mod.module]
        return (
          <div key={mod.module}>
            <button
              type="button"
              className="w-full text-left text-[11px] uppercase tracking-[0.1em] text-steel font-medium px-5 py-1.5 mt-3.5 first:mt-0 hover:text-ink"
              onClick={() =>
                setCollapsed((c) => ({ ...c, [mod.module]: !c[mod.module] }))
              }
            >
              Module {mod.module} — {mod.title}
            </button>
            {!isCollapsed &&
              mod.elements.map((el) => {
                const active = el.key === selectedKey
                const count = counts[el.key] || 0
                const num = elementDisplayNum(el)
                const pickerOpen = pickerKey === el.key

                if (!el.implemented) {
                  return (
                    <div
                      key={el.key}
                      className="flex items-center gap-2.5 px-5 py-1.5 text-[13.5px] text-steel/40 cursor-default border-l-2 border-transparent"
                      title="Coming soon"
                    >
                      <ElementChip number={num} tone="dim" />
                      <span className="truncate">{el.label}</span>
                    </div>
                  )
                }

                return (
                  <div
                    key={el.key}
                    className={`w-full flex items-center gap-1 pr-2 border-l-2 ${
                      active
                        ? 'bg-panel border-signal font-medium text-ink'
                        : 'border-transparent text-ink/90 hover:bg-panel/60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(el)}
                      className="flex-1 flex items-center gap-2.5 px-5 py-1.5 text-[13.5px] text-left min-w-0"
                    >
                      <ElementChip
                        number={num}
                        tone={active ? 'active' : 'default'}
                      />
                      <span className="truncate flex-1">{el.label}</span>
                      {count > 0 && (
                        <span className="font-mono text-[10px] text-steel tabular-nums">
                          {count}
                        </span>
                      )}
                    </button>
                    {pickerEnabled && (
                      <button
                        type="button"
                        data-boq-picker-trigger
                        title="Detailed BOQ Items"
                        aria-expanded={pickerOpen}
                        aria-label={`BOQ items for ${el.label}`}
                        className={`flex-shrink-0 w-6 h-6 text-[11px] rounded border ${
                          pickerOpen
                            ? 'border-signal text-signal bg-panel'
                            : 'border-steel-border text-steel hover:text-ink hover:border-ink/40'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (pickerKey === el.key) {
                            setPickerKey(null)
                            setAnchorRect(null)
                            return
                          }
                          const rect = (
                            e.currentTarget as HTMLButtonElement
                          ).getBoundingClientRect()
                          setAnchorRect(rect)
                          setPickerKey(el.key)
                        }}
                      >
                        {pickerOpen ? '▾' : '▸'}
                      </button>
                    )}
                  </div>
                )
              })}
          </div>
        )
      })}

      {pickerKey && pickerEl && projectId && floorId && (
        <ElementBoqPicker
          projectId={projectId}
          floorId={floorId}
          elementKey={pickerEl.key}
          elementLabel={pickerEl.label}
          open
          anchorRect={anchorRect}
          onClose={() => {
            setPickerKey(null)
            setAnchorRect(null)
          }}
          onAdded={onBoqItemsAdded}
        />
      )}
    </aside>
  )
}
