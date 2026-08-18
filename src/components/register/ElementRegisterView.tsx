import { useMemo, useState } from 'react'
import {
  ELEMENT_MODULE_TITLES,
  ELEMENT_REGISTER,
  type ElementModuleId,
  type ElementRegisterEntry,
} from '../../constants/elementRegister'
import { DataTable, ElementChip } from '../ui'

const METHOD_LABEL: Record<ElementRegisterEntry['takeoffMethod'], string> = {
  parametric: 'Parametric',
  schedule: 'Schedule',
  count: 'Count',
  'linear-network': 'Linear network',
  manual: 'Manual',
}

/**
 * Master Element Register — units, rules, materials, NRM2, overlap rank.
 */
export function ElementRegisterView({
  onOpenElement,
}: {
  onOpenElement?: (key: string) => void
}) {
  const [moduleFilter, setModuleFilter] = useState<ElementModuleId | 'all'>(
    'all',
  )
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ELEMENT_REGISTER.filter((e) => {
      if (moduleFilter !== 'all' && e.module !== moduleFilter) return false
      if (!q) return true
      return (
        e.code.includes(q) ||
        e.key.toLowerCase().includes(q) ||
        e.label.toLowerCase().includes(q) ||
        e.nrm2Ref.toLowerCase().includes(q) ||
        e.defaultMaterial.toLowerCase().includes(q)
      )
    })
  }, [moduleFilter, query])

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="px-6 pt-2 pb-4 flex-shrink-0 space-y-3">
        <div>
          <h2 className="font-display text-lg text-ink">Element Register</h2>
          <p className="text-xs text-steel mt-1 max-w-3xl leading-relaxed">
            Master list every takeoff object maps to — primary unit, secondary
            quantities, measurement rule, default material, takeoff method,
            NRM2 reference, and overlap rank. Lower overlap rank owns shared
            volume where two elements intersect.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search code, name, NRM2…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border border-steel-border bg-panel px-2.5 py-1.5 text-xs text-ink outline-none min-w-[14rem]"
          />
          <div className="flex gap-1">
            {(
              [
                ['all', 'All'],
                [1, 'M1 Structural'],
                [2, 'M2 Arch / Finishes'],
                [3, 'M3 MEP'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={String(id)}
                type="button"
                onClick={() => setModuleFilter(id)}
                className={`text-[11px] px-2.5 py-1.5 border ${
                  moduleFilter === id
                    ? 'border-signal text-ink bg-panel'
                    : 'border-steel-border text-steel hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-steel font-mono ml-auto">
            {rows.length} / {ELEMENT_REGISTER.length} codes
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
        <DataTable>
          <DataTable.Header>
            <DataTable.Row>
              <DataTable.HeaderCell className="w-14">Code</DataTable.HeaderCell>
              <DataTable.HeaderCell>Element</DataTable.HeaderCell>
              <DataTable.HeaderCell className="w-16">Unit</DataTable.HeaderCell>
              <DataTable.HeaderCell>Secondary qty</DataTable.HeaderCell>
              <DataTable.HeaderCell>Measurement rule</DataTable.HeaderCell>
              <DataTable.HeaderCell>Default material</DataTable.HeaderCell>
              <DataTable.HeaderCell className="w-28">Method</DataTable.HeaderCell>
              <DataTable.HeaderCell className="w-24">NRM2</DataTable.HeaderCell>
              <DataTable.HeaderCell className="w-16" align="right">
                Rank
              </DataTable.HeaderCell>
            </DataTable.Row>
          </DataTable.Header>
          <DataTable.Body>
            {([1, 2, 3] as ElementModuleId[]).map((mod) => {
              const modRows = rows.filter((r) => r.module === mod)
              if (!modRows.length) return null
              return (
                <ModuleBlock
                  key={mod}
                  module={mod}
                  rows={modRows}
                  onOpenElement={onOpenElement}
                />
              )
            })}
          </DataTable.Body>
        </DataTable>
      </div>
    </div>
  )
}

function ModuleBlock({
  module,
  rows,
  onOpenElement,
}: {
  module: ElementModuleId
  rows: ElementRegisterEntry[]
  onOpenElement?: (key: string) => void
}) {
  return (
    <>
      <DataTable.Row className="bg-panel/80">
        <DataTable.Cell colSpan={9} className="!py-2">
          <span className="text-[11px] uppercase tracking-[0.1em] text-steel font-medium">
            Module {module} — {ELEMENT_MODULE_TITLES[module]}
          </span>
        </DataTable.Cell>
      </DataTable.Row>
      {rows.map((e) => (
        <DataTable.Row
          key={e.key}
          className={e.implemented ? undefined : 'opacity-60'}
        >
          <DataTable.Cell>
            <ElementChip number={e.code} tone={e.implemented ? 'default' : 'dim'} />
          </DataTable.Cell>
          <DataTable.Cell>
            <div className="flex flex-col gap-0.5 min-w-[9rem]">
              {e.implemented && onOpenElement ? (
                <button
                  type="button"
                  className="text-left text-sm text-ink hover:text-signal font-medium"
                  onClick={() => onOpenElement(e.key)}
                >
                  {e.label}
                </button>
              ) : (
                <span className="text-sm text-ink font-medium">{e.label}</span>
              )}
              <span className="font-mono text-[10px] text-steel">{e.key}</span>
              {!e.implemented && (
                <span className="text-[9px] uppercase tracking-wide text-steel">
                  Coming soon
                </span>
              )}
            </div>
          </DataTable.Cell>
          <DataTable.Cell className="font-mono text-xs">{e.primaryUnit}</DataTable.Cell>
          <DataTable.Cell className="text-[11px] text-steel max-w-[10rem]">
            {e.secondaryQuantities.join('; ')}
          </DataTable.Cell>
          <DataTable.Cell className="text-[11px] text-ink/80 max-w-[16rem] leading-snug">
            {e.measurementRule}
          </DataTable.Cell>
          <DataTable.Cell className="text-[11px] text-steel max-w-[11rem]">
            {e.defaultMaterial}
          </DataTable.Cell>
          <DataTable.Cell className="text-[11px]">
            {METHOD_LABEL[e.takeoffMethod]}
          </DataTable.Cell>
          <DataTable.Cell className="font-mono text-[11px] text-steel">
            {e.nrm2Ref}
          </DataTable.Cell>
          <DataTable.Cell numeric className="font-mono text-xs">
            {e.overlapRank}
          </DataTable.Cell>
        </DataTable.Row>
      ))}
    </>
  )
}
