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
import { ReportTable } from './ReportTable'

type ReportSubTab = 'boq' | 'bom' | 'labour'

export function ElementReportsTab({
  project,
  floorId,
  elementKey,
  sub,
  onOpenSchedule,
}: {
  project: Project
  floorId: string
  elementKey: string
  sub: ReportSubTab
  onOpenSchedule?: () => void
}) {
  const el = findElement(elementKey)
  const implemented = !!ELEMENT_ENGINES[elementKey]
  const qc = useQueryClient()
  const [qtyLine, setQtyLine] = useState<ReportLine | null>(null)

  const query = useQuery({
    queryKey: [
      'reports',
      project.id,
      'floor',
      floorId,
      elementKey,
      project.units,
      project.currency,
      project.updatedAt,
    ],
    queryFn: () =>
      getReports(project.id, { scope: 'floor', floorId, elementKey }),
    enabled: implemented && !!floorId,
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
        Reports are not available for {el?.label || elementKey} yet.
      </div>
    )
  }

  const bundle = query.data?.byElement?.[0]
  const currency = query.data?.currency || project.currency
  const hasBoqItems = Boolean(bundle?.boq.some((l) => l.kind === 'item'))
  const hasBomItems = Boolean(bundle?.bom.some((l) => l.kind === 'item'))
  const hasLabour = Boolean((bundle?.labour.activities.length || 0) > 0)

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
          <AddManualBoqLine
            projectId={project.id}
            floorId={floorId}
            elementKey={elementKey}
          />
        </>
      )}
      {bundle && sub === 'boq' && (
        <>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <h3 className="font-display text-base font-semibold text-ink">
              BOQ — {el?.num}. {el?.label}
            </h3>
            <p className="text-[11px] text-steel shrink-0">
              {floorId} · {currency}
            </p>
          </div>
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
              onDeleteLine={(line) => {
                if (!line.selectedBoqId) return
                delMut.mutate(line.selectedBoqId)
              }}
            />
          )}
          <AddManualBoqLine
            projectId={project.id}
            floorId={floorId}
            elementKey={elementKey}
            extraCategories={bundle.boq
              .map((l) => l.workCategory)
              .filter((c): c is string => Boolean(c))}
          />
        </>
      )}
      {bundle && sub === 'bom' && (
        <>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <h3 className="font-display text-base font-semibold text-ink">
              BOM — {el?.num}. {el?.label}
            </h3>
            <p className="text-[11px] text-steel shrink-0">
              {floorId} · {currency}
            </p>
          </div>
          {!hasBomItems ? (
            <p className="text-sm text-steel py-3">
              No materials yet. Take off concrete, formwork or rebar on the BOQ
              and those quantities will generate the BOM.
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
              Labour — {el?.num}. {el?.label}
            </h3>
            <p className="text-[11px] text-steel shrink-0">
              {floorId} · {currency}
            </p>
          </div>
          {!hasLabour ? (
            <p className="text-sm text-steel py-3">
              No labour yet. Take off concrete, formwork or rebar on the BOQ
              and those quantities will generate labour.
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
    </div>
  )
}
