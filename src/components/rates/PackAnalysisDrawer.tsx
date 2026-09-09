import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getPackAnalysis, patchPackAnalysis } from '../../api/projectsApi'
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

function sheetMoney(n: number, currency: string): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  if (currency === 'USD') {
    return `$${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }
  return formatMoney(n, currency)
}

function pctLabel(fraction: number): string {
  const n = (Number(fraction) || 0) * 100
  const s = n.toLocaleString(undefined, {
    maximumFractionDigits: n % 1 === 0 ? 0 : 1,
  })
  return `${s}%`
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
  const query = useQuery({
    queryKey: ['pack-analysis', projectId, lineKey],
    queryFn: () => getPackAnalysis(projectId, lineKey),
  })
  const mut = useMutation({
    mutationFn: (body: { apply: boolean; quantityByCode?: Record<string, number> }) => {
      const detail = query.data
      if (!detail) throw new Error('Not loaded')
      const lines = detail.analysis.lines.map((ln) => ({
        sourceCode: ln.sourceCode,
        quantity:
          body.quantityByCode && body.quantityByCode[ln.sourceCode] != null
            ? body.quantityByCode[ln.sourceCode]
            : ln.quantity,
        remarks: ln.remarks,
      }))
      return patchPackAnalysis(projectId, lineKey, {
        packId: detail.packId,
        revision: detail.analysis.revision,
        apply: body.apply,
        lines,
        allowances: detail.analysis.allowances,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['pack-analysis', projectId, lineKey] })
      await qc.invalidateQueries({ queryKey: ['pack-analyses', projectId] })
      await qc.invalidateQueries({ queryKey: ['pack-resources', projectId] })
      await qc.invalidateQueries({ queryKey: ['reports', projectId] })
    },
  })

  const detail = query.data
  const computed = detail?.analysis.computed
  const applied = detail?.applied?.compositeRate ?? 0
  const sheetCurrency = detail?.pricing?.currency || currency
  const location = detail?.pricing?.location || ''
  const vat = detail?.pricing?.taxInclusive ? 'Included' : 'Excluded'
  const allowances = detail?.analysis.allowances

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
                {sheetMoney(applied, sheetCurrency)}). This sheet’s rate per BOQ unit is{' '}
                {sheetMoney(computed.compositeRate, sheetCurrency)}, matching the workbook RATE
                ANALYSIS total. Apply to bill that rate. Quantity and takeoff are not changed.
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
              <div className="grid grid-cols-[9rem_1fr_auto_1fr_auto_auto_auto_auto] gap-x-2 items-center px-0">
                <div className="px-2 py-1.5 text-steel bg-panel">Unit</div>
                <div className="px-2 py-1.5">{detail.analysis.unit || '—'}</div>
                <div className="px-2 py-1.5 text-steel">Pricing basis</div>
                <div className="px-2 py-1.5 truncate">{location || '—'}</div>
                <div className="px-2 py-1.5 text-steel">Currency</div>
                <div className="px-2 py-1.5">{sheetCurrency}</div>
                <div className="px-2 py-1.5 text-steel">VAT</div>
                <div className="px-2 py-1.5">{vat}</div>
              </div>
            </div>

            <div className="overflow-x-auto border border-steel-border">
              <table className="w-full text-[11px] border-collapse min-w-[920px]">
                <thead>
                  <tr className="text-left text-steel bg-panel border-b border-steel-border">
                    <th className="py-1.5 px-2 font-medium w-8">No.</th>
                    <th className="py-1.5 px-2 font-medium">Code</th>
                    <th className="py-1.5 px-2 font-medium">Resource Description</th>
                    <th className="py-1.5 px-2 font-medium">Category</th>
                    <th className="py-1.5 px-2 font-medium text-right">Qty / BOQ Unit</th>
                    <th className="py-1.5 px-2 font-medium">Resource Unit</th>
                    <th className="py-1.5 px-2 font-medium text-right">
                      Rate ({sheetCurrency})
                    </th>
                    <th className="py-1.5 px-2 font-medium text-right">
                      Amount ({sheetCurrency})
                    </th>
                    <th className="py-1.5 px-2 font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.analysis.lines.map((ln, i) => {
                    const rateInclWaste = ln.unitRate * (1 + (Number(ln.wastePct) || 0))
                    return (
                      <tr key={ln.id || ln.sourceCode} className="border-b border-gridline">
                        <td className="py-1 px-2 text-steel">{i + 1}</td>
                        <td
                          className={`py-1 px-2 font-mono ${ln.missing ? 'text-danger' : ''}`}
                        >
                          {ln.sourceCode}
                        </td>
                        <td className="py-1 px-2">
                          {ln.description}
                          {ln.missing ? ' (missing)' : ''}
                        </td>
                        <td className="py-1 px-2 text-steel">{categoryLabel(ln.category)}</td>
                        <td className="py-1 px-2 w-24">
                          <NumericInput
                            value={ln.quantity}
                            rememberFormula={false}
                            className="w-full text-right text-[11px] bg-transparent border-b border-steel-border"
                            onChange={(v) => {
                              mut.mutate({
                                apply: false,
                                quantityByCode: { [ln.sourceCode]: v ?? 0 },
                              })
                            }}
                          />
                        </td>
                        <td className="py-1 px-2 text-steel">{ln.unit || '—'}</td>
                        <td className="py-1 px-2 text-right">
                          {sheetMoney(rateInclWaste, sheetCurrency)}
                        </td>
                        <td className="py-1 px-2 text-right">
                          {sheetMoney(ln.amount, sheetCurrency)}
                        </td>
                        <td className="py-1 px-2 text-steel">{ln.remarks || ''}</td>
                      </tr>
                    )
                  })}
                  <TotalRow
                    label="Materials Total"
                    amount={computed.material}
                    currency={sheetCurrency}
                  />
                  <TotalRow
                    label="Labour Total"
                    amount={computed.labour}
                    currency={sheetCurrency}
                  />
                  <TotalRow
                    label="Plant & Subcontract Total"
                    amount={computed.plant + computed.subcontract}
                    currency={sheetCurrency}
                  />
                  <TotalRow
                    label="Direct Resource Cost"
                    amount={computed.directResourceCost}
                    currency={sheetCurrency}
                    emph
                  />
                  <TotalRow
                    label="Transport / Carriage"
                    note={
                      allowances
                        ? `${pctLabel(allowances.transportPctMaterials)} of materials`
                        : ''
                    }
                    amount={computed.transport}
                    currency={sheetCurrency}
                    remark="Adjust for haul distance"
                  />
                  <TotalRow
                    label="Small Tools, Water & Sundries"
                    note={
                      allowances
                        ? `${pctLabel(allowances.sundriesPctLabourPlantSubcontract)} of labour + plant`
                        : ''
                    }
                    amount={computed.sundries}
                    currency={sheetCurrency}
                    remark="Traditional allowance"
                  />
                  <TotalRow
                    label="PRIME COST"
                    amount={computed.primeCost}
                    currency={sheetCurrency}
                    emph
                  />
                  <TotalRow
                    label="Contractor Overheads"
                    note={allowances ? pctLabel(allowances.overheadPct) : ''}
                    amount={computed.overhead}
                    currency={sheetCurrency}
                    remark="Editable allowance"
                  />
                  <TotalRow
                    label="Contractor Profit"
                    note={allowances ? pctLabel(allowances.profitPct) : ''}
                    amount={computed.profit}
                    currency={sheetCurrency}
                    remark="Editable allowance"
                  />
                  <TotalRow
                    label="RATE PER BOQ UNIT"
                    note={detail.analysis.unit || ''}
                    amount={computed.compositeRate}
                    currency={sheetCurrency}
                    remark={vat === 'Excluded' ? 'Excluding VAT' : 'Including VAT'}
                    emph
                  />
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-steel leading-relaxed">
              Resource rates are the databank rate including waste, as in the workbook (Qty × rate
              incl. waste). Current BOQ billed rate:{' '}
              {sheetMoney(applied, sheetCurrency)}.
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
            Recalculate
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

function TotalRow({
  label,
  note,
  amount,
  currency,
  remark,
  emph,
}: {
  label: string
  note?: string
  amount: number
  currency: string
  remark?: string
  emph?: boolean
}) {
  const cls = emph ? 'font-semibold' : ''
  return (
    <tr className={`border-b border-gridline ${emph ? 'bg-panel/60' : ''}`}>
      <td colSpan={3} className={`py-1 px-2 ${cls}`}>
        {label}
      </td>
      <td className="py-1 px-2 text-steel">{note || ''}</td>
      <td colSpan={3} />
      <td className={`py-1 px-2 text-right ${cls}`}>{sheetMoney(amount, currency)}</td>
      <td className="py-1 px-2 text-steel">{remark || ''}</td>
    </tr>
  )
}
