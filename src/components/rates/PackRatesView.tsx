import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listPackAnalyses,
  listPackResources,
  patchPackResource,
  recalculatePackAnalyses,
} from '../../api/projectsApi'
import { formatMoney } from '../../lib/units'
import type { Project } from '../../types/api'
import { DataTable, GhostButton, NumericInput, PrimaryButton } from '../ui'
import { PackAnalysisDrawer } from './PackAnalysisDrawer'

type Tab = 'databank' | 'analyses'

function databankCategoryLabel(cat: string): string {
  const c = String(cat || '').toUpperCase()
  if (c === 'MAT') return 'Material'
  if (c === 'LAB') return 'Labour'
  if (c === 'PLT') return 'Plant & Tools'
  if (c === 'SUB') return 'Subcontractor'
  return cat || '—'
}

export function PackRatesView({
  project,
  onBack,
}: {
  project: Project
  onBack: () => void
}) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('databank')
  const [q, setQ] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)

  const resourcesQ = useQuery({
    queryKey: ['pack-resources', project.id, q],
    queryFn: () => listPackResources(project.id, { q: q || undefined }),
    enabled: tab === 'databank',
  })
  const analysesQ = useQuery({
    queryKey: ['pack-analyses', project.id, q],
    queryFn: () => listPackAnalyses(project.id, { q: q || undefined, limit: 120 }),
    enabled: tab === 'analyses',
  })

  const patchRes = useMutation({
    mutationFn: (args: { id: string; unitRate?: number; wastePct?: number }) =>
      patchPackResource(project.id, args.id, {
        unitRate: args.unitRate,
        wastePct: args.wastePct,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pack-resources', project.id] })
      void qc.invalidateQueries({ queryKey: ['pack-analyses', project.id] })
    },
  })

  const applyMut = useMutation({
    mutationFn: () => recalculatePackAnalyses(project.id, { apply: true }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pack-resources', project.id] })
      void qc.invalidateQueries({ queryKey: ['pack-analyses', project.id] })
      void qc.invalidateQueries({ queryKey: ['reports', project.id] })
    },
  })

  const currency = project.currency
  const staleCount = analysesQ.data?.staleCount ?? 0
  const err =
    resourcesQ.error || analysesQ.error
      ? 'Could not load the Issue Tracker catalogue. Check the backend fixture workbook, or replace it from Project reports.'
      : null

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-steel-border flex-shrink-0">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Rate analysis</h2>
          <p className="text-[12.5px] text-steel mt-1">
            PRICES DATABANK and RATE ANALYSIS in East African QS format · {currency}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <GhostButton className="!text-xs !py-1.5 !px-3" onClick={onBack}>
            ← Back to reports
          </GhostButton>
        </div>
      </div>

      <div className="px-6 py-3 flex flex-wrap items-center gap-2 border-b border-steel-border">
        <button
          type="button"
          className={`text-xs px-3 py-1.5 border ${tab === 'databank' ? 'border-ink text-ink' : 'border-steel-border text-steel'}`}
          onClick={() => setTab('databank')}
        >
          Databank
        </button>
        <button
          type="button"
          className={`text-xs px-3 py-1.5 border ${tab === 'analyses' ? 'border-ink text-ink' : 'border-steel-border text-steel'}`}
          onClick={() => setTab('analyses')}
        >
          Analyses
        </button>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tab === 'databank' ? 'Search code or description' : 'Search ref or description'}
          className="ml-2 border border-steel-border bg-bg px-2 py-1 text-xs text-ink outline-none w-64"
        />
        {tab === 'analyses' && staleCount > 0 && (
          <PrimaryButton
            className="!text-xs !py-1.5 !px-3 ml-auto"
            disabled={applyMut.isPending}
            onClick={() => applyMut.mutate()}
          >
            Apply affected rates ({staleCount})
          </PrimaryButton>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {err && <p className="text-sm text-danger mb-3">{err}</p>}
        {tab === 'analyses' && staleCount > 0 && (
          <p className="text-[12px] text-chalk border border-chalk/40 bg-panel px-3 py-2 mb-3">
            Uploaded Rates Schedule rates are still billed. Analysis totals differ until you Apply.
            This does not change quantities.
          </p>
        )}

        {tab === 'databank' && (
          <DataTable compact>
            <DataTable.Header>
              <DataTable.Row>
                <DataTable.HeaderCell>Code</DataTable.HeaderCell>
                <DataTable.HeaderCell>Category</DataTable.HeaderCell>
                <DataTable.HeaderCell>Resource Description</DataTable.HeaderCell>
                <DataTable.HeaderCell>Unit</DataTable.HeaderCell>
                <DataTable.HeaderCell align="right">Unit rate</DataTable.HeaderCell>
                <DataTable.HeaderCell align="right">Waste %</DataTable.HeaderCell>
                <DataTable.HeaderCell align="right">Rate incl. waste</DataTable.HeaderCell>
                <DataTable.HeaderCell align="right">Used by</DataTable.HeaderCell>
              </DataTable.Row>
            </DataTable.Header>
            <DataTable.Body>
              {(resourcesQ.data?.resources || []).map((r) => {
                const incl = (Number(r.unitRate) || 0) * (1 + (Number(r.wastePct) || 0))
                return (
                <DataTable.Row key={r.id}>
                  <DataTable.Cell className="font-mono text-[11px]">{r.code}</DataTable.Cell>
                  <DataTable.Cell className="text-steel">{databankCategoryLabel(r.category)}</DataTable.Cell>
                  <DataTable.Cell>
                    {r.description}
                    {r.staleAnalysisCount > 0 ? (
                      <span className="ml-1 text-[10px] text-chalk">stale {r.staleAnalysisCount}</span>
                    ) : null}
                  </DataTable.Cell>
                  <DataTable.Cell className="text-steel">{r.unit}</DataTable.Cell>
                  <DataTable.Cell numeric>
                    <NumericInput
                      value={r.unitRate}
                      rememberFormula={false}
                      className="w-24 text-right text-[12px] bg-transparent border-b border-steel-border"
                      onChange={(v) =>
                        patchRes.mutate({ id: r.id, unitRate: v ?? 0 })
                      }
                    />
                  </DataTable.Cell>
                  <DataTable.Cell numeric>
                    <NumericInput
                      value={(Number(r.wastePct) || 0) * 100}
                      rememberFormula={false}
                      className="w-16 text-right text-[12px] bg-transparent border-b border-steel-border"
                      onChange={(v) =>
                        patchRes.mutate({ id: r.id, wastePct: (v ?? 0) / 100 })
                      }
                    />
                  </DataTable.Cell>
                  <DataTable.Cell numeric className="text-steel">
                    {formatMoney(incl, currency)}
                  </DataTable.Cell>
                  <DataTable.Cell numeric className="text-steel">
                    {r.usageCount}
                  </DataTable.Cell>
                </DataTable.Row>
                )
              })}
            </DataTable.Body>
          </DataTable>
        )}

        {tab === 'analyses' && (
          <DataTable compact>
            <DataTable.Header>
              <DataTable.Row>
                <DataTable.HeaderCell>Line</DataTable.HeaderCell>
                <DataTable.HeaderCell>Description</DataTable.HeaderCell>
                <DataTable.HeaderCell>Status</DataTable.HeaderCell>
                <DataTable.HeaderCell align="right">BOQ rate</DataTable.HeaderCell>
                <DataTable.HeaderCell align="right">Calculated</DataTable.HeaderCell>
                <DataTable.HeaderCell align="right">Delta</DataTable.HeaderCell>
              </DataTable.Row>
            </DataTable.Header>
            <DataTable.Body>
              {(analysesQ.data?.analyses || []).map((a) => (
                <DataTable.Row key={a.id}>
                  <DataTable.Cell className="font-mono text-[11px]">
                    <button
                      type="button"
                      className="underline decoration-dotted underline-offset-2"
                      onClick={() => setOpenKey(a.lineKey)}
                    >
                      {a.lineKey}
                    </button>
                  </DataTable.Cell>
                  <DataTable.Cell className="line-clamp-2">{a.description}</DataTable.Cell>
                  <DataTable.Cell className="text-[11px] uppercase text-steel">
                    {a.status}
                  </DataTable.Cell>
                  <DataTable.Cell numeric>{formatMoney(a.appliedRate, currency)}</DataTable.Cell>
                  <DataTable.Cell numeric>
                    {formatMoney(a.calculatedRate, currency)}
                  </DataTable.Cell>
                  <DataTable.Cell numeric className="text-steel">
                    {formatMoney(a.delta, currency)}
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable.Body>
          </DataTable>
        )}
        {tab === 'analyses' && analysesQ.data && (
          <p className="text-[11px] text-steel mt-2">
            Showing {analysesQ.data.analyses.length} of {analysesQ.data.total}
          </p>
        )}
      </div>

      {openKey && (
        <PackAnalysisDrawer
          projectId={project.id}
          lineKey={openKey}
          currency={currency}
          onClose={() => setOpenKey(null)}
        />
      )}
    </div>
  )
}
