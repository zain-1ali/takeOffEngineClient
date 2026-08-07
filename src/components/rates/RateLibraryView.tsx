import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAutosave } from '../../autosave/AutosaveContext'
import { analyseRate } from '../../lib/analyseRate'
import type { Project } from '../../types/api'
import type {
  RateAnalysisDef,
  RateLib,
  RateMethod,
  RateResource,
} from '../../types/rateLib'
import { DataTable, GhostButton, PrimaryButton } from '../ui'

type RaTab = 'buildups' | 'materials' | 'labour' | 'equipment' | 'methods'
type LibKey = 'materials' | 'labour' | 'equipment'

function money(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function cloneLib(lib: RateLib): RateLib {
  return JSON.parse(JSON.stringify(lib)) as RateLib
}

const inputCls =
  'border border-steel-border bg-bg px-1.5 py-1 text-xs text-ink outline-none'

export function RateLibraryView({
  project,
  onBack,
}: {
  project: Project
  onBack: () => void
}) {
  const { schedule, flush } = useAutosave()
  const [tab, setTab] = useState<RaTab>('buildups')
  const [lib, setLib] = useState<RateLib>(() => cloneLib(project.rateLib))
  const [useRA, setUseRA] = useState(project.useRateAnalysis !== false)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    setLib(cloneLib(project.rateLib))
    setUseRA(project.useRateAnalysis !== false)
  }, [project.id])

  const persist = useCallback(
    (nextLib: RateLib, nextUse: boolean) => {
      setLib(nextLib)
      setUseRA(nextUse)
      schedule({
        kind: 'project',
        projectId: project.id,
        patch: { rateLib: nextLib, useRateAnalysis: nextUse },
      })
    },
    [project.id, schedule],
  )

  const currency = project.currency
  const codes = useMemo(() => Object.keys(lib.analyses), [lib.analyses])

  function patchAnalysis(code: string, patch: Partial<RateAnalysisDef>) {
    const next = cloneLib(lib)
    next.analyses[code] = { ...next.analyses[code], ...patch }
    persist(next, useRA)
  }

  function setCoeff(code: string, group: LibKey, i: number, coeff: number) {
    const next = cloneLib(lib)
    const lines = [...(next.analyses[code][group] || [])]
    lines[i] = { ...lines[i], coeff }
    next.analyses[code] = { ...next.analyses[code], [group]: lines }
    persist(next, useRA)
  }

  function delCoeff(code: string, group: LibKey, i: number) {
    const next = cloneLib(lib)
    const lines = [...(next.analyses[code][group] || [])]
    lines.splice(i, 1)
    next.analyses[code] = { ...next.analyses[code], [group]: lines }
    persist(next, useRA)
  }

  function addCoeff(code: string, group: LibKey, ref: string) {
    if (!ref) return
    const next = cloneLib(lib)
    const lines = [...(next.analyses[code][group] || []), { ref, coeff: 1 }]
    next.analyses[code] = { ...next.analyses[code], [group]: lines }
    persist(next, useRA)
  }

  function patchResource(which: LibKey, i: number, key: keyof RateResource, value: string | number) {
    const next = cloneLib(lib)
    const row = { ...next[which][i] }
    if (key === 'rate' || key === 'wastage') (row as any)[key] = Number(value) || 0
    else (row as any)[key] = value
    next[which][i] = row
    persist(next, useRA)
  }

  function delResource(which: LibKey, i: number) {
    const next = cloneLib(lib)
    next[which].splice(i, 1)
    persist(next, useRA)
  }

  function addResource(which: LibKey) {
    const next = cloneLib(lib)
    const blank: RateResource =
      which === 'materials'
        ? { code: 'NEW', desc: 'New material', unit: 'unit', rate: 0, wastage: 0 }
        : { code: 'NEW', desc: `New ${which.slice(0, -1)}`, unit: 'day', rate: 0 }
    next[which].push(blank)
    persist(next, useRA)
  }

  function patchMethod(i: number, key: keyof RateMethod, value: string) {
    const next = cloneLib(lib)
    next.methods[i] = { ...next.methods[i], [key]: value }
    persist(next, useRA)
  }

  function delMethod(i: number) {
    const next = cloneLib(lib)
    next.methods.splice(i, 1)
    persist(next, useRA)
  }

  function addMethod() {
    const next = cloneLib(lib)
    next.methods.push({ code: 'M-NEW', title: 'New method', standard: '', statement: '' })
    persist(next, useRA)
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-steel-border flex-shrink-0">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Rate Analysis</h2>
          <p className="text-[12.5px] text-steel mt-1">
            Built-up rates from resource libraries &amp; method statements · {currency}
          </p>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <label className="flex items-center gap-2 text-xs text-steel">
            <input
              type="checkbox"
              checked={useRA}
              onChange={(e) => persist(lib, e.target.checked)}
              className="accent-signal"
            />
            Use built-up rates in BOQ
          </label>
          <GhostButton
            className="!text-xs !py-1.5 !px-3"
            onClick={() => {
              void flush().finally(onBack)
            }}
          >
            ← Back to reports
          </GhostButton>
        </div>
      </div>

      <div className="flex gap-0.5 px-6 border-b border-steel-border flex-shrink-0">
        {(
          [
            ['buildups', 'Build-ups'],
            ['materials', 'Materials'],
            ['labour', 'Labour'],
            ['equipment', 'Equipment'],
            ['methods', 'Methods & Standards'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`text-[13px] font-medium px-4 py-2.5 ${
              tab === id
                ? 'text-ink border-b-2 border-signal -mb-px'
                : 'text-steel hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {tab === 'buildups' && (
          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <div className="space-y-3">
              {codes.map((code) => {
                const a = analyseRate(code, lib)
                const def = lib.analyses[code]
                if (!a || !def) return null
                const open = selected === code
                return (
                  <div key={code} className="panel-card !p-0 overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-panel-hover"
                      onClick={() => setSelected(open ? null : code)}
                    >
                      <div className="text-[13px]">
                        <span className="font-mono text-chalk mr-2">{code}</span>
                        <span className="text-ink">{a.label}</span>
                        <span className="text-steel"> / {a.unit}</span>
                      </div>
                      <div className="text-[13px] font-semibold text-ink font-mono tabular-nums">
                        {money(a.rate, currency)}
                        <span className="text-steel font-normal ml-1">/ {a.unit}</span>
                        <span className="ml-2 text-steel">{open ? '▾' : '▸'}</span>
                      </div>
                    </button>
                    {open && (
                      <div className="px-4 pb-4 border-t border-steel-border pt-3">
                        <div className="flex items-center gap-2 mb-3 text-xs text-steel">
                          Method:
                          <select
                            className={inputCls}
                            value={def.method}
                            onChange={(e) => patchAnalysis(code, { method: e.target.value })}
                          >
                            {lib.methods.map((m) => (
                              <option key={m.code} value={m.code}>
                                {m.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <BuildupTable
                          currency={currency}
                          analysed={a}
                          def={def}
                          lib={lib}
                          onCoeff={(g, i, v) => setCoeff(code, g, i, v)}
                          onDel={(g, i) => delCoeff(code, g, i)}
                          onAdd={(g, ref) => addCoeff(code, g, ref)}
                          onOhp={(pct) => patchAnalysis(code, { ohp: pct / 100 })}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <aside className="panel-card h-fit lg:sticky lg:top-0">
              <h3 className="panel-card-title">Project databank</h3>
              <div className="space-y-0">
                {(
                  [
                    ['Materials', lib.materials.length],
                    ['Labour', lib.labour.length],
                    ['Equipment', lib.equipment.length],
                  ] as const
                ).map(([lab, n]) => (
                  <div
                    key={lab}
                    className="flex justify-between items-center text-[13px] py-[7px] border-b border-gridline last:border-0"
                  >
                    <span className="text-steel">{lab}</span>
                    <span className="font-mono text-[11px] text-chalk bg-chalk-bg px-2 py-0.5">
                      {n} items
                    </span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}

        {(tab === 'materials' || tab === 'labour' || tab === 'equipment') && (
          <LibraryTable
            which={tab}
            currency={currency}
            rows={lib[tab]}
            onPatch={(i, k, v) => patchResource(tab, i, k, v)}
            onDel={(i) => delResource(tab, i)}
            onAdd={() => addResource(tab)}
          />
        )}

        {tab === 'methods' && (
          <div className="space-y-3">
            {lib.methods.map((m, i) => (
              <div key={i} className="panel-card space-y-2">
                <div className="flex gap-2 items-center">
                  <input
                    className={`${inputCls} w-24 font-mono`}
                    value={m.code}
                    onChange={(e) => patchMethod(i, 'code', e.target.value)}
                  />
                  <input
                    className={`${inputCls} flex-1 font-semibold`}
                    value={m.title}
                    onChange={(e) => patchMethod(i, 'title', e.target.value)}
                  />
                  <button
                    type="button"
                    className="text-danger text-xs px-2"
                    onClick={() => delMethod(i)}
                  >
                    ✕
                  </button>
                </div>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-steel">
                  Reference standard
                  <input
                    className={`${inputCls} w-full mt-1 font-mono text-chalk`}
                    value={m.standard}
                    onChange={(e) => patchMethod(i, 'standard', e.target.value)}
                  />
                </label>
                <label className="block text-[10px] uppercase tracking-[0.08em] text-steel">
                  Method statement
                  <textarea
                    className={`${inputCls} w-full mt-1 min-h-[4rem]`}
                    value={m.statement}
                    onChange={(e) => patchMethod(i, 'statement', e.target.value)}
                  />
                </label>
              </div>
            ))}
            <GhostButton className="!text-xs !py-1.5 !px-3" onClick={addMethod}>
              + Add method statement
            </GhostButton>
          </div>
        )}
      </div>
    </div>
  )
}

function BuildupTable({
  currency,
  analysed,
  def,
  lib,
  onCoeff,
  onDel,
  onAdd,
  onOhp,
}: {
  currency: string
  analysed: NonNullable<ReturnType<typeof analyseRate>>
  def: RateAnalysisDef
  lib: RateLib
  onCoeff: (g: LibKey, i: number, v: number) => void
  onDel: (g: LibKey, i: number) => void
  onAdd: (g: LibKey, ref: string) => void
  onOhp: (pct: number) => void
}) {
  const section = (
    title: string,
    group: LibKey,
    lines: typeof analysed.matLines,
    subtotal: number,
  ) => (
    <>
      <DataTable.Row className="!border-0 hover:!bg-transparent">
        <DataTable.Cell
          colSpan={6}
          className="!py-2 bg-panel-hover font-semibold text-ink uppercase tracking-wide text-[11px]"
        >
          {title}
        </DataTable.Cell>
      </DataTable.Row>
      {lines.map((l, i) => (
        <DataTable.Row key={`${group}-${i}`}>
          <DataTable.Cell className="text-xs">{l.desc}</DataTable.Cell>
          <DataTable.Cell>
            <input
              type="number"
              step="0.001"
              className={`${inputCls} w-20 text-right font-mono`}
              value={l.coeff}
              onChange={(e) => onCoeff(group, i, parseFloat(e.target.value) || 0)}
            />
          </DataTable.Cell>
          <DataTable.Cell className="text-xs text-steel">{l.unit}</DataTable.Cell>
          <DataTable.Cell numeric className="text-xs text-steel">
            {money(l.rate, currency)}
          </DataTable.Cell>
          <DataTable.Cell numeric className="text-xs">
            {money(l.amount, currency)}
          </DataTable.Cell>
          <DataTable.Cell>
            <button
              type="button"
              className="text-[var(--danger)] text-xs"
              onClick={() => onDel(group, i)}
            >
              ✕
            </button>
          </DataTable.Cell>
        </DataTable.Row>
      ))}
      <DataTable.Row className="hover:!bg-transparent">
        <DataTable.Cell colSpan={6}>
          <select
            className={`${inputCls} text-[11px]`}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                onAdd(group, e.target.value)
                e.target.value = ''
              }
            }}
          >
            <option value="">+ add {group.slice(0, -1)}…</option>
            {lib[group].map((x) => (
              <option key={x.code} value={x.code}>
                {x.desc}
              </option>
            ))}
          </select>
        </DataTable.Cell>
      </DataTable.Row>
      <DataTable.Row>
        <DataTable.Cell colSpan={4} className="text-right text-xs font-semibold">
          {title.split(' /')[0]}
        </DataTable.Cell>
        <DataTable.Cell numeric className="text-xs font-bold">
          {money(subtotal, currency)}
        </DataTable.Cell>
        <DataTable.Cell />
      </DataTable.Row>
    </>
  )

  return (
    <DataTable compact>
      <DataTable.Header>
        <DataTable.Row>
          <DataTable.HeaderCell>Resource</DataTable.HeaderCell>
          <DataTable.HeaderCell align="right">Coeff</DataTable.HeaderCell>
          <DataTable.HeaderCell>Unit</DataTable.HeaderCell>
          <DataTable.HeaderCell align="right">Rate</DataTable.HeaderCell>
          <DataTable.HeaderCell align="right">Amount</DataTable.HeaderCell>
          <DataTable.HeaderCell className="w-8" />
        </DataTable.Row>
      </DataTable.Header>
      <DataTable.Body>
        {section('Materials', 'materials', analysed.matLines, analysed.matCost)}
        {section('Labour', 'labour', analysed.labLines, analysed.labCost)}
        {section('Equipment / Plant', 'equipment', analysed.eqLines, analysed.eqCost)}
        <DataTable.Row>
          <DataTable.Cell colSpan={4} className="text-right text-xs font-semibold">
            Prime cost
          </DataTable.Cell>
          <DataTable.Cell numeric className="text-xs font-bold">
            {money(analysed.prime, currency)}
          </DataTable.Cell>
          <DataTable.Cell />
        </DataTable.Row>
        <DataTable.Row>
          <DataTable.Cell colSpan={4} className="text-right text-xs">
            Overheads &amp; profit
          </DataTable.Cell>
          <DataTable.Cell className="text-right">
            <input
              type="number"
              step={1}
              className={`${inputCls} w-16 text-right font-mono`}
              value={Math.round((def.ohp || 0) * 100)}
              onChange={(e) => onOhp(parseFloat(e.target.value) || 0)}
            />
            <span className="text-steel ml-1">%</span>
            <div className="font-mono text-steel mt-0.5 text-xs">
              {money(analysed.ohpAmt, currency)}
            </div>
          </DataTable.Cell>
          <DataTable.Cell />
        </DataTable.Row>
        <DataTable.Row totals>
          <DataTable.Cell colSpan={4} className="text-right text-xs font-bold">
            RATE per {analysed.unit}
          </DataTable.Cell>
          <DataTable.Cell numeric className="text-sm font-bold text-signal">
            {money(analysed.rate, currency)}
          </DataTable.Cell>
          <DataTable.Cell />
        </DataTable.Row>
      </DataTable.Body>
    </DataTable>
  )
}

function LibraryTable({
  which,
  currency,
  rows,
  onPatch,
  onDel,
  onAdd,
}: {
  which: LibKey
  currency: string
  rows: RateResource[]
  onPatch: (i: number, k: keyof RateResource, v: string | number) => void
  onDel: (i: number) => void
  onAdd: () => void
}) {
  const isMat = which === 'materials'
  return (
    <div className="panel-card !p-0 overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h3 className="panel-card-title capitalize">{which} databank</h3>
        <p className="text-xs text-steel -mt-2 mb-2">
          Editing a resource rate re-prices every build-up that uses it, and the BOQ.
        </p>
      </div>
      <DataTable compact>
        <DataTable.Header>
          <DataTable.Row>
            <DataTable.HeaderCell>Code</DataTable.HeaderCell>
            <DataTable.HeaderCell>Description</DataTable.HeaderCell>
            <DataTable.HeaderCell>Unit</DataTable.HeaderCell>
            <DataTable.HeaderCell align="right">Rate ({currency})</DataTable.HeaderCell>
            {isMat && (
              <DataTable.HeaderCell align="right">Wastage %</DataTable.HeaderCell>
            )}
            <DataTable.HeaderCell className="w-8" />
          </DataTable.Row>
        </DataTable.Header>
        <DataTable.Body>
          {rows.map((r, i) => (
            <DataTable.Row key={i}>
              <DataTable.Cell>
                <input
                  className={`${inputCls} w-[4.5rem] font-mono`}
                  value={r.code}
                  onChange={(e) => onPatch(i, 'code', e.target.value)}
                />
              </DataTable.Cell>
              <DataTable.Cell>
                <input
                  className={`${inputCls} w-full min-w-[10rem]`}
                  value={r.desc}
                  onChange={(e) => onPatch(i, 'desc', e.target.value)}
                />
              </DataTable.Cell>
              <DataTable.Cell>
                <input
                  className={`${inputCls} w-16`}
                  value={r.unit}
                  onChange={(e) => onPatch(i, 'unit', e.target.value)}
                />
              </DataTable.Cell>
              <DataTable.Cell className="text-right">
                <input
                  type="number"
                  step="0.01"
                  className={`${inputCls} w-24 text-right font-mono`}
                  value={r.rate}
                  onChange={(e) => onPatch(i, 'rate', e.target.value)}
                />
              </DataTable.Cell>
              {isMat && (
                <DataTable.Cell className="text-right">
                  <input
                    type="number"
                    step={1}
                    className={`${inputCls} w-16 text-right font-mono`}
                    value={Math.round((r.wastage || 0) * 100)}
                    onChange={(e) =>
                      onPatch(i, 'wastage', (parseFloat(e.target.value) || 0) / 100)
                    }
                  />
                </DataTable.Cell>
              )}
              <DataTable.Cell>
                <button
                  type="button"
                  className="text-[var(--danger)] text-xs"
                  onClick={() => onDel(i)}
                >
                  ✕
                </button>
              </DataTable.Cell>
            </DataTable.Row>
          ))}
        </DataTable.Body>
      </DataTable>
      <div className="px-4 py-3 border-t border-steel-border">
        <PrimaryButton className="!text-xs !py-2" onClick={onAdd}>
          + Add {which.slice(0, -1)}
        </PrimaryButton>
      </div>
    </div>
  )
}
