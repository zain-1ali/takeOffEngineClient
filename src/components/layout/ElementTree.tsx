import { useState } from 'react'
import {
  ELEMENT_TREE,
  elementDisplayNum,
  type ElementDef,
} from '../../constants/elementTree'
import { ElementChip } from '../ui'

export function ElementTree({
  selectedKey,
  counts,
  onSelect,
  registerActive = false,
  onOpenRegister,
  drawingsActive = false,
  onOpenDrawings,
}: {
  selectedKey: string
  counts: Record<string, number>
  onSelect: (el: ElementDef) => void
  registerActive?: boolean
  onOpenRegister?: () => void
  drawingsActive?: boolean
  onOpenDrawings?: () => void
}) {
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})

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
            Floor PDFs · calibrate · replace
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
                  <button
                    key={el.key}
                    type="button"
                    onClick={() => onSelect(el)}
                    className={`w-full flex items-center gap-2.5 px-5 py-1.5 text-[13.5px] border-l-2 text-left ${
                      active
                        ? 'bg-panel border-signal font-medium text-ink'
                        : 'border-transparent text-ink/90 hover:bg-panel/60'
                    }`}
                  >
                    <ElementChip number={num} tone={active ? 'active' : 'default'} />
                    <span className="truncate flex-1">{el.label}</span>
                    {count > 0 && (
                      <span className="font-mono text-[10px] text-steel tabular-nums">
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
          </div>
        )
      })}
    </aside>
  )
}
