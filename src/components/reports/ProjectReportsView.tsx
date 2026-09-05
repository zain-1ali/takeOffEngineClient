import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getReports, updateSelectedBoqItem } from '../../api/projectsApi'
import type { ReportLine } from '../../types/reports'
import { BoqQtyDialog } from '../boq/BoqQtyDialog'
import {
  exportAllBillExcels,
  exportAllBillPDFs,
  exportBillExcel,
  exportBillPDF,
  type BillExportKind,
} from '../../lib/exportBills'
import { formatMoney, parseUnitSystem } from '../../lib/units'
import type { Project } from '../../types/api'
import { RateLibraryView } from '../rates/RateLibraryView'
import { GhostButton, PrimaryButton, StatCard } from '../ui'
import { CostPlanExportScreen } from './CostPlanExportScreen'
import { LabourTables } from './LabourTables'
import { ManualBoqForm } from './ManualBoqForm'
import { ReportTable } from './ReportTable'

type ReportSubTab = 'boq' | 'bom' | 'labour' | 'costplan'
type Scope = 'floor' | 'project'
type Panel = 'reports' | 'rates'

export function ProjectReportsView({
  project,
  floorId,
  onDone,
}: {
  project: Project
  floorId: string
  /** Leave the export / reports surface (e.g. back to modelling). */
  onDone?: () => void
}) {
  const [scope, setScope] = useState<Scope>('floor')
  const [sub, setSub] = useState<ReportSubTab>('boq')
  const [panel, setPanel] = useState<Panel>('reports')
  const [exportBusy, setExportBusy] = useState(false)
  const [qtyLine, setQtyLine] = useState<ReportLine | null>(null)
  const qc = useQueryClient()

  const qtyMut = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      updateSelectedBoqItem(project.id, id, { quantity }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports', project.id] })
      void qc.invalidateQueries({ queryKey: ['selected-boq', project.id] })
      setQtyLine(null)
    },
  })

  const query = useQuery({
    queryKey: [
      'reports',
      project.id,
      scope,
      scope === 'floor' ? floorId : 'all',
      project.useRateAnalysis,
      project.units,
      project.currency,
      project.updatedAt,
    ],
    queryFn: () =>
      getReports(project.id, {
        scope,
        floorId: scope === 'floor' ? floorId : undefined,
      }),
  })

  const data = query.data
  const currency = data?.currency || project.currency
  const unitSystem = data?.unitSystem || parseUnitSystem(project.units)
  const volUnit = unitSystem === 'imperial' ? 'ft³' : 'm³'
  const areaUnit = unitSystem === 'imperial' ? 'ft²' : 'm²'

  if (panel === 'rates') {
    return <RateLibraryView project={project} onBack={() => setPanel('reports')} />
  }

  // Unified Cost Plan export screen (theme + preview + action bar)
  if (sub === 'costplan') {
    return (
      <CostPlanExportScreen
        project={project}
        floorId={floorId}
        onDone={() => {
          if (onDone) onDone()
          else setSub('boq')
        }}
      />
    )
  }

  async function loadExportReports() {
    return getReports(project.id, {
      scope,
      floorId: scope === 'floor' ? floorId : undefined,
    })
  }

  async function doExportAll(format: 'pdf' | 'xlsx') {
    setExportBusy(true)
    try {
      const reports = await loadExportReports()
      if (format === 'pdf') exportAllBillPDFs(project, reports)
      else exportAllBillExcels(project, reports)
    } catch {
      alert('Export failed — could not load project reports.')
    } finally {
      setExportBusy(false)
    }
  }

  async function doExportOne(format: 'pdf' | 'xlsx', bill: BillExportKind) {
    setExportBusy(true)
    try {
      const reports = await loadExportReports()
      if (format === 'pdf') exportBillPDF(project, reports, bill)
      else exportBillExcel(project, reports, bill)
    } catch {
      alert('Export failed — could not load project reports.')
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-steel-border flex-shrink-0">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Project reports</h2>
          <p className="text-[12.5px] text-steel mt-1">
            Consolidated BOQ / BOM / Labour / Cost Plan
            {project.useRateAnalysis !== false
              ? ' · priced with built-up rates'
              : ' · priced from rate book'}
          </p>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <GhostButton className="!text-xs !py-1.5 !px-3" onClick={() => setPanel('rates')}>
            Rate Library
          </GhostButton>
          <GhostButton
            className="!text-xs !py-1.5 !px-3"
            disabled={exportBusy}
            onClick={() => void doExportOne('pdf', 'boq')}
          >
            BOQ PDF
          </GhostButton>
          <GhostButton
            className="!text-xs !py-1.5 !px-3"
            disabled={exportBusy}
            onClick={() => void doExportOne('pdf', 'bom')}
          >
            BOM PDF
          </GhostButton>
          <GhostButton
            className="!text-xs !py-1.5 !px-3"
            disabled={exportBusy}
            onClick={() => void doExportOne('pdf', 'labour')}
          >
            Labour PDF
          </GhostButton>
          <GhostButton
            className="!text-xs !py-1.5 !px-3"
            disabled={exportBusy}
            onClick={() => void doExportOne('xlsx', 'boq')}
          >
            BOQ Excel
          </GhostButton>
          <GhostButton
            className="!text-xs !py-1.5 !px-3"
            disabled={exportBusy}
            onClick={() => void doExportOne('xlsx', 'bom')}
          >
            BOM Excel
          </GhostButton>
          <GhostButton
            className="!text-xs !py-1.5 !px-3"
            disabled={exportBusy}
            onClick={() => void doExportOne('xlsx', 'labour')}
          >
            Labour Excel
          </GhostButton>
          <GhostButton
            className="!text-xs !py-1.5 !px-3"
            disabled={exportBusy}
            onClick={() => void doExportAll('xlsx')}
          >
            All Excel (3)
          </GhostButton>
          <GhostButton
            className="!text-xs !py-1.5 !px-3"
            disabled={exportBusy}
            onClick={() => void doExportAll('pdf')}
          >
            All PDF (3)
          </GhostButton>
          <PrimaryButton
            className="!text-xs !py-1.5 !px-3"
            onClick={() => setSub('costplan')}
          >
            Cost Plan export
          </PrimaryButton>
          <span className="text-xs text-steel ml-2">Scope</span>
          {(
            [
              ['floor', 'This floor'],
              ['project', 'Whole project'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setScope(id)}
              className={`text-xs px-3 py-1.5 border ${
                scope === id
                  ? 'border-ink text-ink bg-panel-hover'
                  : 'border-steel-border text-steel hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {query.isLoading && (
          <p className="text-sm text-steel">Building consolidated reports…</p>
        )}
        {query.isError && (
          <p className="text-sm text-danger">Failed to load reports.</p>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              <StatCard
                label="Concrete"
                value={data.summary.totalConcrete.toFixed(2)}
                unit={volUnit}
              />
              <StatCard
                label="Formwork"
                value={data.summary.totalFormwork.toFixed(2)}
                unit={areaUnit}
              />
              <StatCard
                label="Steel"
                value={(data.summary.totalSteel / 1000).toFixed(3)}
                unit="t"
              />
              <StatCard label="Units" value={String(data.summary.totalUnits)} />
              <StatCard
                label="Priced total"
                value={formatMoney(data.summary.pricedTotal, currency)}
              />
            </div>

            <div className="flex gap-0.5 border-b border-steel-border">
              {(
                [
                  ['boq', 'BOQ'],
                  ['bom', 'BOM'],
                  ['labour', 'Labour'],
                  ['costplan', 'Cost Plan'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSub(id)}
                  className={`text-[13px] font-medium px-4 py-2.5 ${
                    sub === id
                      ? 'text-ink border-b-2 border-signal -mb-px'
                      : 'text-steel hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {data.summary.elementCount === 0 && (
              <p className="text-sm text-steel">No modelled instances in this scope.</p>
            )}

            {sub === 'boq' && (
              <div className="space-y-4">
                <ManualBoqForm
                  project={project}
                  floorId={floorId}
                  scope={scope}
                />
                <ReportTable
                  lines={data.boq}
                  currency={currency}
                  emptyMessage="No BOQ items yet. Add catalogue items from the sidebar ▸, then click Qty."
                  onQtyClick={setQtyLine}
                />
                <BoqQtyDialog
                  open={Boolean(qtyLine)}
                  line={qtyLine}
                  projectId={project.id}
                  onClose={() => setQtyLine(null)}
                  onApplyQty={(quantity) => {
                    if (!qtyLine?.selectedBoqId) return
                    qtyMut.mutate({ id: qtyLine.selectedBoqId, quantity })
                  }}
                  onOpenSchedule={() => {
                    setQtyLine(null)
                    onDone?.()
                  }}
                />
              </div>
            )}
            {sub === 'bom' && (
              <ReportTable
                lines={data.bom}
                currency={currency}
                emptyMessage="No materials in this scope."
              />
            )}
            {sub === 'labour' && (
              <LabourTables
                activities={data.labour.activities}
                trades={data.labour.trades}
                totalManDays={data.labour.totalManDays}
                totalCost={data.labour.totalCost}
                byFloor={data.labour.byFloor}
                currency={currency}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
