import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPackResource,
  getPackAnalysis,
  listPackResources,
  patchPackAnalysis,
} from '../../api/projectsApi'
import { formatMoney } from '../../lib/units'
import { GhostButton, NumericInput, PrimaryButton } from '../ui'

function categoryLabel(cat: string): string {
  const c = String(cat || '').toUpperCase()
  if (c === 'MAT') return 'Material'
  if (c === 'LAB') return 'Labour'
  if (c === 'PLT') return 'Plant & Tools'
  if (c === 'SUB') return 'Subcontractor'
  return cat || '—'
}

function pctLabel(fraction: number): string {
  const n = (Number(fraction) || 0) * 100
  const s = n.toLocaleString(undefined, {
    maximumFractionDigits: n % 1 === 0 ? 0 : 1,
  })
  return `${s}%`
}

type DraftLine = {
  key: string
  sourceCode: string
  quantity: number
  remarks: string
}

export function PackAnalysisDrawer({
  projectId,
  lineKey,
  currency,
  onClose,
}: {
  projectId: string
  lineKey: string
  currency: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [draftLines, setDraftLines] = useState<DraftLine[] | null>(null)
  const [allowDraft, setAllowDraft] = useState({
    transportPctMaterials: 0,
    sundriesPctLabourPlantSubcontract: 0,
    overheadPct: 0,
    profitPct: 0,
  })
  const [resourceFilter, setResourceFilter] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newUnit, setNewUnit] = useState('nr')
  const [newRate, setNewRate] = useState<number | null>(0)
  const [newWaste, setNewWaste] = useState<number | null>(0)

  const query = useQuery({
    queryKey: ['pack-analysis', projectId, lineKey],
    queryFn: () => getPackAnalysis(projectId, lineKey),
  })
  const resourcesQ = useQuery({
    queryKey: ['pack-resources', projectId, ''],
    queryFn: () => listPackResources(projectId),
  })

  const detail = query.data
  const resources = resourcesQ.data?.resources || []

  useEffect(() => {
    if (!detail) return
    setDraftLines(
      detail.analysis.lines.map((ln, i) => ({
        key: ln.id || `${ln.sourceCode}-${i}`,
        sourceCode: ln.sourceCode,
        quantity: ln.quantity,
        remarks: ln.remarks || '',
      })),
    )
    setAllowDraft({ ...detail.analysis.allowances })
  }, [detail?.analysis.id, detail?.analysis.revision])

  const resourceByCode = useMemo(() => {
    const m = new Map()
    for (let i = 0; i < resources.length; i++) m.set(resources[i].code, resources[i])
    return m
  }, [resources])

  const filteredResources = useMemo(() => {
    const q = resourceFilter.trim().toLowerCase()
    if (!q) return resources
    return resources.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    )
  }, [resources, resourceFilter])

  const mut = useMutation({
    mutationFn: (body: { apply: boolean }) => {
      if (!detail || !draftLines) throw new Error('Not loaded')
      const lines = draftLines
        .filter((ln) => ln.sourceCode)
        .map((ln) => ({
          sourceCode: ln.sourceCode,
          quantity: ln.quantity,
          remarks: ln.remarks,
        }))
      return patchPackAnalysis(projectId, lineKey, {
        packId: detail.packId,
        revision: detail.analysis.revision,
        apply: body.apply,
        lines,
        allowances: allowDraft,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['pack-analysis', projectId, lineKey] })
      await qc.invalidateQueries({ queryKey: ['pack-analyses', projectId] })
      await qc.invalidateQueries({ queryKey: ['pack-resources', projectId] })
      await qc.invalidateQueries({ queryKey: ['reports', projectId] })
    },
  })

  const addRes = useMutation({
    mutationFn: () =>
      createPackResource(projectId, {
        packId: detail?.packId,
        code: newCode,
        description: newDesc,
        unit: newUnit,
        unitRate: newRate ?? 0,
        wastePct: (newWaste ?? 0) / 100,
      }),
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ['pack-resources', projectId] })
      setDraftLines((rows) => [
        ...(rows || []),
        {
          key: `new-${Date.now()}`,
          sourceCode: data.resource.code,
          quantity: 1,
          remarks: '',
        },
      ])
      setNewCode('')
      setNewDesc('')
      setNewUnit('nr')
      setNewRate(0)
      setNewWaste(0)
    },
  })

  const computed = detail?.analysis.computed
  const applied = detail?.applied?.compositeRate ?? 0
  const location = detail?.pricing?.location || ''
  const vat = detail?.pricing?.taxInclusive ? 'Included' : 'Excluded'
  const lines = draftLines || []

  function setLine(key: string, patch: Partial<DraftLine>) {
    setDraftLines((rows) =>
      (rows || []).map((ln) => (ln.key === key ? { ...ln, ...patch } : ln)),
    )
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-[1100px] bg-bg border-l border-steel-border flex flex-col">
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-steel-border">
        <div>
          <h3 className="font-display text-base font-semibold text-ink">
            Detailed rate analysis — East African QS format
          </h3>
          <p className="text-[12px] text-steel mt-0.5">{lineKey}</p>
        </div>
        <GhostButton className="!text-xs !py-1 !px-2" onClick={onClose}>
          Close
        </GhostButton>
      </div>
      <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {query.isLoading && <p className="text-sm text-steel">Loading analysis…</p>}
        {query.isError && (
          <p className="text-sm text-danger">No RATE ANALYSIS for this line in the active pack.</p>
        )}
        {detail && computed && (
          <>
            {detail.analysis.status !== 'APPLIED' && (
              <p className="text-[12px] text-chalk border border-chalk/40 bg-panel px-3 py-2">
                The BOQ still uses the Rates Schedule composite (
                {formatMoney(applied, currency)}). Calculated rate per BOQ unit is{' '}
                {formatMoney(computed.compositeRate, currency)}. Save, then Apply to bill
                that rate. Quantity and takeoff are not changed.
              </p>
            )}

            <div className="text-[12px] border border-steel-border">
              <div className="grid grid-cols-[9rem_1fr] border-b border-steel-border">
                <div className="px-2 py-1.5 text-steel bg-panel">Module / Ref</div>
                <div className="px-2 py-1.5">
                  MODULE {detail.analysis.moduleNo}{' '}
                  <span className="font-mono">{detail.analysis.ref}</span>
                </div>
              </div>
              <div className="grid grid-cols-[9rem_1fr] border-b border-steel-border">
                <div className="px-2 py-1.5 text-steel bg-panel">BOQ Item</div>
                <div className="px-2 py-1.5">{detail.analysis.description}</div>
              </div>
              <div className="grid grid-cols-[9rem_1fr_auto_1fr_auto_auto_auto_auto] gap-x-2 items-center">
                <div className="px-2 py-1.5 text-steel bg-panel">Unit</div>
                <div className="px-2 py-1.5">{detail.analysis.unit || '—'}</div>
                <div className="px-2 py-1.5 text-steel">Pricing basis</div>
                <div className="px-2 py-1.5 truncate">{location || '—'}</div>
                <div className="px-2 py-1.5 text-steel">Currency</div>
                <div className="px-2 py-1.5">{currency}</div>
                <div className="px-2 py-1.5 text-steel">VAT</div>
                <div className="px-2 py-1.5">{vat}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                value={resourceFilter}
                onChange={(e) => setResourceFilter(e.target.value)}
                placeholder="Filter databank codes…"
                className="border border-steel-border bg-bg px-2 py-1 text-[11px] text-ink outline-none w-56"
              />
              <GhostButton
                className="!text-xs !py-1 !px-2"
                onClick={() =>
                  setDraftLines((rows) => [
                    ...(rows || []),
                    {
                      key: `new-${Date.now()}`,
                      sourceCode: '',
                      quantity: 1,
                      remarks: '',
                    },
                  ])
                }
              >
                Add resource row
              </GhostButton>
            </div>

            <div className="overflow-x-auto border border-steel-border">
              <table className="w-full text-[11px] border-collapse min-w-[980px]">
                <thead>
                  <tr className="text-left text-steel bg-panel border-b border-steel-border">
                    <th className="py-1.5 px-2 font-medium w-8">No.</th>
                    <th className="py-1.5 px-2 font-medium">Code (databank)</th>
                    <th className="py-1.5 px-2 font-medium">Resource Description</th>
                    <th className="py-1.5 px-2 font-medium">Category</th>
                    <th className="py-1.5 px-2 font-medium text-right">Qty / BOQ Unit</th>
                    <th className="py-1.5 px-2 font-medium">Resource Unit</th>
                    <th className="py-1.5 px-2 font-medium text-right">
                      Rate ({currency})
                    </th>
                    <th className="py-1.5 px-2 font-medium text-right">
                      Amount ({currency})
                    </th>
                    <th className="py-1.5 px-2 font-medium">Remarks</th>
                    <th className="py-1.5 px-2 font-medium w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((ln, i) => {
                    const res = resourceByCode.get(ln.sourceCode)
                    const rateInclWaste = res
                      ? res.unitRate * (1 + (Number(res.wastePct) || 0))
                      : 0
                    const amount = rateInclWaste * (Number(ln.quantity) || 0)
                    return (
                      <tr key={ln.key} className="border-b border-gridline">
                        <td className="py-1 px-2 text-steel">{i + 1}</td>
                        <td className="py-1 px-2">
                          <select
                            className="w-full bg-transparent border-b border-steel-border text-[11px] font-mono outline-none"
                            value={ln.sourceCode}
                            onChange={(e) => setLine(ln.key, { sourceCode: e.target.value })}
                          >
                            <option value="">Choose resource…</option>
                            {filteredResources.map((r) => (
                              <option key={r.id} value={r.code}>
                                {r.code}
                              </option>
                            ))}
                            {ln.sourceCode &&
                              !filteredResources.some((r) => r.code === ln.sourceCode) && (
                                <option value={ln.sourceCode}>{ln.sourceCode}</option>
                              )}
                          </select>
                        </td>
                        <td className={`py-1 px-2 ${res ? '' : 'text-danger'}`}>
                          {res?.description || (ln.sourceCode ? `${ln.sourceCode} (missing)` : '—')}
                        </td>
                        <td className="py-1 px-2 text-steel">
                          {res ? categoryLabel(res.category) : '—'}
                        </td>
                        <td className="py-1 px-2 w-24">
                          <NumericInput
                            value={ln.quantity}
                            rememberFormula={false}
                            className="w-full text-right text-[11px] bg-transparent border-b border-steel-border"
                            onChange={(v) => setLine(ln.key, { quantity: v ?? 0 })}
                          />
                        </td>
                        <td className="py-1 px-2 text-steel">{res?.unit || '—'}</td>
                        <td className="py-1 px-2 text-right">
                          {res ? formatMoney(rateInclWaste, currency) : '—'}
                        </td>
                        <td className="py-1 px-2 text-right">
                          {res ? formatMoney(amount, currency) : '—'}
                        </td>
                        <td className="py-1 px-2">
                          <input
                            value={ln.remarks}
                            onChange={(e) => setLine(ln.key, { remarks: e.target.value })}
                            className="w-full bg-transparent border-b border-steel-border text-[11px] outline-none"
                          />
                        </td>
                        <td className="py-1 px-2">
                          <button
                            type="button"
                            className="text-steel hover:text-danger text-[11px]"
                            onClick={() =>
                              setDraftLines((rows) =>
                                (rows || []).filter((r) => r.key !== ln.key),
                              )
                            }
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  <TotalRow
                    label="Materials Total"
                    amount={computed.material}
                    currency={currency}
                  />
                  <TotalRow
                    label="Labour Total"
                    amount={computed.labour}
                    currency={currency}
                  />
                  <TotalRow
                    label="Plant & Subcontract Total"
                    amount={computed.plant + computed.subcontract}
                    currency={currency}
                  />
                  <TotalRow
                    label="Direct Resource Cost"
                    amount={computed.directResourceCost}
                    currency={currency}
                    emph
                  />
                  <TotalRow
                    label="Transport / Carriage"
                    note={`${pctLabel(allowDraft.transportPctMaterials)} of materials`}
                    amount={computed.transport}
                    currency={currency}
                    remark="Save to recalculate"
                    extra={
                      <PercentEdit
                        value={allowDraft.transportPctMaterials}
                        onChange={(v) =>
                          setAllowDraft((a) => ({ ...a, transportPctMaterials: v }))
                        }
                      />
                    }
                  />
                  <TotalRow
                    label="Small Tools, Water & Sundries"
                    note={`${pctLabel(allowDraft.sundriesPctLabourPlantSubcontract)} of labour + plant`}
                    amount={computed.sundries}
                    currency={currency}
                    extra={
                      <PercentEdit
                        value={allowDraft.sundriesPctLabourPlantSubcontract}
                        onChange={(v) =>
                          setAllowDraft((a) => ({
                            ...a,
                            sundriesPctLabourPlantSubcontract: v,
                          }))
                        }
                      />
                    }
                  />
                  <TotalRow
                    label="PRIME COST"
                    amount={computed.primeCost}
                    currency={currency}
                    emph
                  />
                  <TotalRow
                    label="Contractor Overheads"
                    note={pctLabel(allowDraft.overheadPct)}
                    amount={computed.overhead}
                    currency={currency}
                    extra={
                      <PercentEdit
                        value={allowDraft.overheadPct}
                        onChange={(v) =>
                          setAllowDraft((a) => ({ ...a, overheadPct: v }))
                        }
                      />
                    }
                  />
                  <TotalRow
                    label="Contractor Profit"
                    note={pctLabel(allowDraft.profitPct)}
                    amount={computed.profit}
                    currency={currency}
                    extra={
                      <PercentEdit
                        value={allowDraft.profitPct}
                        onChange={(v) =>
                          setAllowDraft((a) => ({ ...a, profitPct: v }))
                        }
                      />
                    }
                  />
                  <TotalRow
                    label="RATE PER BOQ UNIT"
                    note={detail.analysis.unit || ''}
                    amount={computed.compositeRate}
                    currency={currency}
                    remark={vat === 'Excluded' ? 'Excluding VAT' : 'Including VAT'}
                    emph
                  />
                </tbody>
              </table>
            </div>

            <div className="border border-steel-border px-3 py-2 space-y-2">
              <p className="text-[11px] font-medium text-ink">New databank resource</p>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                <input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="Code e.g. MAT-200"
                  className="border border-steel-border bg-bg px-2 py-1 text-[11px] outline-none"
                />
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Description"
                  className="sm:col-span-2 border border-steel-border bg-bg px-2 py-1 text-[11px] outline-none"
                />
                <input
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="Unit"
                  className="border border-steel-border bg-bg px-2 py-1 text-[11px] outline-none"
                />
                <NumericInput
                  value={newRate}
                  rememberFormula={false}
                  placeholder="Unit rate"
                  className="border border-steel-border bg-bg px-2 py-1 text-[11px] text-right"
                  onChange={(v) => setNewRate(v)}
                />
                <NumericInput
                  value={newWaste}
                  rememberFormula={false}
                  placeholder="Waste %"
                  className="border border-steel-border bg-bg px-2 py-1 text-[11px] text-right"
                  onChange={(v) => setNewWaste(v)}
                />
              </div>
              <GhostButton
                className="!text-xs !py-1 !px-2"
                disabled={addRes.isPending || !newCode.trim()}
                onClick={() => addRes.mutate()}
              >
                {addRes.isPending ? 'Adding…' : 'Add to databank and this analysis'}
              </GhostButton>
              {addRes.isError && (
                <p className="text-[11px] text-danger">
                  {(addRes.error as Error)?.message || 'Could not add resource'}
                </p>
              )}
            </div>

            <p className="text-[11px] text-steel leading-relaxed">
              Resource rows use the Prices Databank. Save to recalc totals in {currency}.
              Current BOQ billed rate: {formatMoney(applied, currency)}.
            </p>
            {mut.isError && (
              <p className="text-sm text-danger">
                {(mut.error as Error)?.message || 'Could not save analysis'}
              </p>
            )}
          </>
        )}
      </div>
      {detail && (
        <div className="px-4 py-3 border-t border-steel-border flex justify-end gap-2">
          <GhostButton
            className="!text-xs !py-1.5 !px-3"
            disabled={mut.isPending}
            onClick={() => mut.mutate({ apply: false })}
          >
            {mut.isPending ? 'Saving…' : 'Save & recalculate'}
          </GhostButton>
          <PrimaryButton
            className="!text-xs !py-1.5 !px-3"
            disabled={mut.isPending || detail.analysis.status === 'INVALID'}
            onClick={() => mut.mutate({ apply: true })}
          >
            Apply rate to BOQ
          </PrimaryButton>
        </div>
      )}
    </div>
  )
}

function PercentEdit({
  value,
  onChange,
}: {
  value: number
  onChange: (fraction: number) => void
}) {
  return (
    <NumericInput
      value={(Number(value) || 0) * 100}
      rememberFormula={false}
      className="w-14 text-right text-[11px] bg-transparent border-b border-steel-border"
      onChange={(v) => onChange((v ?? 0) / 100)}
    />
  )
}

function TotalRow({
  label,
  note,
  amount,
  currency,
  remark,
  emph,
  extra,
}: {
  label: string
  note?: string
  amount: number
  currency: string
  remark?: string
  emph?: boolean
  extra?: ReactNode
}) {
  const cls = emph ? 'font-semibold' : ''
  return (
    <tr className={`border-b border-gridline ${emph ? 'bg-panel/60' : ''}`}>
      <td colSpan={3} className={`py-1 px-2 ${cls}`}>
        {label}
      </td>
      <td className="py-1 px-2 text-steel">{note || ''}</td>
      <td colSpan={2}>{extra}</td>
      <td />
      <td className={`py-1 px-2 text-right ${cls}`}>{formatMoney(amount, currency)}</td>
      <td className="py-1 px-2 text-steel" colSpan={2}>
        {remark || ''}
      </td>
    </tr>
  )
}
