import { useState } from 'react'
import type { LegendEntry } from '../lib/legendEntries'

interface SheetLegendProps {
  entries: LegendEntry[]
}

/**
 * Visible color key for the sheet — built from Layer colors (not per-item colors).
 * Fixed bottom-right so anyone looking at the drawing can read what colors mean.
 */
export function SheetLegend({ entries }: SheetLegendProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (entries.length === 0) {
    return null
  }

  return (
    <div
      className="pointer-events-auto absolute right-3 bottom-3 z-20 w-[min(100%-1.5rem,16.5rem)] border-2 border-[#0c1b2a]/80 bg-[#faf8f3]/95 text-[#0c1b2a] shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-sm"
      role="region"
      aria-label="Drawing legend"
    >
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="flex w-full items-center gap-2 border-b border-[#0c1b2a]/15 bg-[#0c1b2a] px-3 py-2 text-left text-[#faf8f3]"
        aria-expanded={!collapsed}
      >
        <span className="font-display text-xs font-extrabold tracking-[0.14em] uppercase">
          Legend
        </span>
        <span className="text-[0.65rem] tracking-wide text-[#faf8f3]/55 uppercase">
          Color key
        </span>
        <span className="ml-auto text-[#faf8f3]/70" aria-hidden>
          {collapsed ? '▸' : '▾'}
        </span>
      </button>

      {!collapsed ? (
        <div className="px-3 py-2.5">
          <p className="mb-2 text-[0.7rem] leading-snug text-[#0c1b2a]/70">
            What each layer color means on this drawing
          </p>
          <ul className="max-h-48 space-y-1.5 overflow-y-auto">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className={`flex items-center gap-2.5 ${
                  entry.visible ? '' : 'opacity-45'
                }`}
              >
                <span
                  className="inline-block h-4 w-4 shrink-0 border border-[#0c1b2a]/30"
                  style={{
                    backgroundColor: entry.visible
                      ? entry.color
                      : 'transparent',
                    backgroundImage: entry.visible
                      ? undefined
                      : `linear-gradient(135deg, ${entry.color} 0 45%, transparent 45% 55%, ${entry.color} 55%)`,
                  }}
                  aria-hidden
                />
                <span
                  className={`min-w-0 truncate text-sm font-medium ${
                    entry.visible
                      ? 'text-[#0c1b2a]'
                      : 'text-[#0c1b2a]/55 line-through'
                  }`}
                >
                  {entry.name}
                </span>
                {!entry.visible ? (
                  <span className="shrink-0 text-[0.6rem] tracking-wide text-[#0c1b2a]/50 uppercase">
                    Hidden
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="px-3 py-2 text-[0.7rem] text-[#0c1b2a]/65">
          {entries.filter((entry) => entry.visible).length} visible layer
          {entries.filter((entry) => entry.visible).length === 1 ? '' : 's'} —
          click to expand
        </p>
      )}
    </div>
  )
}
