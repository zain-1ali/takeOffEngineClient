import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getPackAnalysis, patchPackAnalysis } from '../../api/projectsApi'
import { formatMoney } from '../../lib/units'
import { GhostButton, NumericInput, PrimaryButton } from '../ui'

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

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl bg-bg border-l border-steel-border shadow-xl flex flex-col">
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-steel-border">
        <div>
          <h3 className="font-display text-base font-semibold text-ink">Rate analysis</h3>
          <p className="text-[12px] text-steel mt-0.5">
            {lineKey}
            {detail ? ` · ${detail.analysis.description}` : ''}
          </p>
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
                The BOQ still uses the Rates Schedule rate ({formatMoney(applied, currency)}).
                Calculated build-up is {formatMoney(computed.compositeRate, currency)}. Apply to
                replace the billed rate. Quantity and takeoff are not changed.
              </p>
            )}
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="text-left text-steel border-b border-steel-border">
                  <th className="py-1 font-medium">Code</th>
                  <th className="py-1 font-medium">Resource</th>
                  <th className="py-1 font-medium text-right">Qty</th>
                  <th className="py-1 font-medium text-right">Rate</th>
                  <th className="py-1 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {detail.analysis.lines.map((ln) => (
                  <tr key={ln.id || ln.sourceCode} className="border-b border-gridline">
                    <td className={`py-1 font-mono ${ln.missing ? 'text-danger' : ''}`}>
                      {ln.sourceCode}
                    </td>
                    <td className="py-1 pr-2">
                      {ln.description}
                      {ln.missing ? ' (missing)' : ''}
                    </td>
                    <td className="py-1 w-20">
                      <NumericInput
                        value={ln.quantity}
                        rememberFormula={false}
                        className="w-full text-right text-[12px] bg-transparent border-b border-steel-border"
                        onChange={(v) => {
                          mut.mutate({
                            apply: false,
                            quantityByCode: { [ln.sourceCode]: v ?? 0 },
                          })
                        }}
                      />
                    </td>
                    <td className="py-1 text-right text-steel">
                      {formatMoney(ln.unitRate, currency)}
                    </td>
                    <td className="py-1 text-right">{formatMoney(ln.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
              <dt className="text-steel">Materials</dt>
              <dd className="text-right">{formatMoney(computed.material, currency)}</dd>
              <dt className="text-steel">Labour</dt>
              <dd className="text-right">{formatMoney(computed.labour, currency)}</dd>
              <dt className="text-steel">Plant</dt>
              <dd className="text-right">{formatMoney(computed.plant, currency)}</dd>
              <dt className="text-steel">Subcontract</dt>
              <dd className="text-right">{formatMoney(computed.subcontract, currency)}</dd>
              <dt className="text-steel">Prime cost</dt>
              <dd className="text-right">{formatMoney(computed.primeCost, currency)}</dd>
              <dt className="text-steel">Overhead + profit</dt>
              <dd className="text-right">
                {formatMoney(computed.overhead + computed.profit, currency)}
              </dd>
              <dt className="font-semibold">Calculated rate / {detail.analysis.unit || 'unit'}</dt>
              <dd className="text-right font-semibold">
                {formatMoney(computed.compositeRate, currency)}
              </dd>
              <dt className="text-steel">Current BOQ rate</dt>
              <dd className="text-right">{formatMoney(applied, currency)}</dd>
            </dl>
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
