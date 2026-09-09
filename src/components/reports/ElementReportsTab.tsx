import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteSelectedBoqItem, getReports } from '../../api/projectsApi'
import { findElement } from '../../constants/elementTree'
import { ELEMENT_ENGINES } from '../../elementEngines'
import type { Project } from '../../types/api'
import type { ReportLine } from '../../types/reports'
import { AddManualBoqLine } from '../boq/AddManualBoqLine'
import { BoqTakeoffDialog } from '../boq/BoqTakeoffDialog'
import { LabourTables } from './LabourTables'
import { PrelimsQtyPanel } from './PrelimsQtyPanel'
import { ReportTable } from './ReportTable'
import { PackAnalysisDrawer } from '../rates/PackAnalysisDrawer'

type ReportSubTab = 'boq' | 'bom' | 'labour'

export function ElementReportsTab({
  project,
  floorId,
  elementKey,
  sub,
  onOpenSchedule,
  catalogueOnly = false,
  packScope,
  elementLabel,
  elementNum,
}: {
  project: Project
  floorId: string
  elementKey: string
  sub: ReportSubTab
  onOpenSchedule?: () => void
  catalogueOnly?: boolean
  packScope?: 'PROJECT' | 'FLOOR'
  elementLabel?: string
  elementNum?: number
}) {
  const el = findElement(elementKey)
  const implemented = !!ELEMENT_ENGINES[elementKey] || catalogueOnly
  const projectScoped = catalogueOnly && packScope === 'PROJECT'
  const qc = useQueryClient()
  const [qtyLine, setQtyLine] = useState<ReportLine | null>(null)
  const [analysisLine, setAnalysisLine] = useState<ReportLine | null>(null)

  const query = useQuery({
    queryKey: [
      'reports',
      project.id,
      projectScoped ? 'project' : 'floor',
      projectScoped ? 'all' : floorId,
      elementKey,
      project.units,
      project.currency,
      project.updatedAt,
    ],
    queryFn: () =>
      getReports(project.id, {
        scope: projectScoped ? 'project' : 'floor',
        floorId: projectScoped ? undefined : floorId,
        elementKey,
      }),
    enabled: implemented && (projectScoped || !!floorId),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => deleteSelectedBoqItem(project.id, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports', project.id] })
      void qc.invalidateQueries({ queryKey: ['selected-boq', project.id] })
    },
  })

  if (!implemented) {
    return (
      <div className="p-4 text-sm text-steel">
        Reports are not available for {elementLabel || el?.label || elementKey} yet.
      </div>
    )
  }

  const bundle = query.data?.byElement?.[0]
  const currency = query.data?.currency || project.currency
  const hasBoqItems = Boolean(bundle?.boq.some((l) => l.kind === 'item'))
  const hasBomItems = Boolean(bundle?.bom.some((l) => l.kind === 'item'))
  const hasLabour = Boolean((bundle?.labour.activities.length || 0) > 0)
  const heading = `${elementNum ?? el?.num ?? ''}. ${elementLabel || el?.label || elementKey}`
  const scopeHint = projectScoped ? 'Project-wide' : floorId

  return (
    <div className="h-full overflow-auto px-4 py-3">
      {query.isLoading && <p className="text-sm text-steel">Building reports…</p>}
      {query.isError && (
        <p className="text-sm text-danger">Failed to load reports.</p>
      )}
      {!query.isLoading && !bundle && sub === 'boq' && (
        <>
          <p className="text-sm text-steel mb-2">
            No BOQ yet. Add a manual line to start.
          </p>
          {!catalogueOnly && (
            <AddManualBoqLine
              projectId={project.id}
              floorId={floorId}
              elementKey={elementKey}
            />
          )}
        </>
      )}
      {bundle && sub === 'boq' && (
        <>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <h3 className="font-display text-base font-semibold text-ink">
              BOQ — {heading}
            </h3>
            <p className="text-[11px] text-steel shrink-0">
              {scopeHint} · {currency}
            </p>
          </div>
          {catalogueOnly && packScope === 'PROJECT' && elementKey.startsWith('CAT_M00_') && (
            <PrelimsQtyPanel project={project} />
          )}
          {!hasBoqItems ? (
            <p className="text-sm text-steel py-3">
              No BOQ items for this floor yet. Add a manual line below, or wait
              for catalogue lines to load.
            </p>
          ) : (
            <ReportTable
              lines={bundle.boq}
              currency={currency}
              onQtyClick={setQtyLine}
              onRateClick={setAnalysisLine}
              onDeleteLine={(line) => {
                if (!line.selectedBoqId) return
                delMut.mutate(line.selectedBoqId)
              }}
            />
          )}
          {!catalogueOnly && (
            <AddManualBoqLine
              projectId={project.id}
              floorId={floorId}
              elementKey={elementKey}
              extraCategories={bundle.boq
                .map((l) => l.workCategory)
                .filter((c): c is string => Boolean(c))}
            />
          )}
        </>
      )}
      {bundle && sub === 'bom' && (
        <>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <h3 className="font-display text-base font-semibold text-ink">
              BOM — {heading}
            </h3>
            <p className="text-[11px] text-steel shrink-0">
              {scopeHint} · {currency}
            </p>
          </div>
          {!hasBomItems ? (
            <p className="text-sm text-steel py-3">
              {catalogueOnly
                ? 'Catalogue-only headings have no 3D BOM. Quantities are typed or measured on the BOQ.'
                : 'No materials yet. Take off concrete, formwork or rebar on the BOQ and those quantities will generate the BOM.'}
            </p>
          ) : (
            <ReportTable
              lines={bundle.bom}
              currency={currency}
              emptyMessage="No materials for this scope."
            />
          )}
        </>
      )}
      {bundle && sub === 'labour' && (
        <>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <h3 className="font-display text-base font-semibold text-ink">
              Labour — {heading}
            </h3>
            <p className="text-[11px] text-steel shrink-0">
              {scopeHint} · {currency}
            </p>
          </div>
          {!hasLabour ? (
            <p className="text-sm text-steel py-3">
              {catalogueOnly
                ? 'Catalogue-only headings have no labour build-up from 3D engines.'
                : 'No labour yet. Take off concrete, formwork or rebar on the BOQ and those quantities will generate labour.'}
            </p>
          ) : (
            <LabourTables
              activities={bundle.labour.activities}
              trades={bundle.labour.trades}
              totalManDays={bundle.labour.totalManDays}
              totalCost={bundle.labour.totalCost}
              currency={currency}
            />
          )}
        </>
      )}

      <BoqTakeoffDialog
        open={Boolean(qtyLine)}
        line={qtyLine}
        projectId={project.id}
        onClose={() => setQtyLine(null)}
        onOpenSchedule={() => {
          setQtyLine(null)
          onOpenSchedule?.()
        }}
      />
      {analysisLine?.lineKey ? (
        <PackAnalysisDrawer
          projectId={project.id}
          lineKey={analysisLine.lineKey}
          currency={currency}
          onClose={() => setAnalysisLine(null)}
        />
      ) : null}
    </div>
  )
}
