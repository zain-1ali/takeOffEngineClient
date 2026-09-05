import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getReports, updateSelectedBoqItem } from '../../api/projectsApi'
import { findElement } from '../../constants/elementTree'
import { ELEMENT_ENGINES } from '../../elementEngines'
import type { Project } from '../../types/api'
import type { ReportLine } from '../../types/reports'
import { BoqQtyDialog } from '../boq/BoqQtyDialog'
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

  const qtyMut = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      updateSelectedBoqItem(project.id, id, { quantity }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports', project.id] })
      void qc.invalidateQueries({ queryKey: ['selected-boq', project.id] })
      setQtyLine(null)
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
  const hasInstances = (bundle?.units || 0) > 0
  const hasBoqItems = Boolean(bundle?.boq.some((l) => l.kind === 'item'))

  return (
    <div className="h-full overflow-auto px-4 py-3">
      {query.isLoading && <p className="text-sm text-steel">Building reports…</p>}
      {query.isError && (
        <p className="text-sm text-danger">Failed to load reports.</p>
      )}
      {!query.isLoading && !bundle && (
        <p className="text-sm text-steel">
          Use ▸ on this element to Add to BOQ. Click a Qty cell to type a number,
          open schedule, or pick a previous takeoff.
        </p>
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
              No BOQ items yet. Use ▸ on this element to add catalogue items,
              then click Qty to enter a number, open schedule, or search takeoff.
            </p>
          ) : (
            <ReportTable
              lines={bundle.boq}
              currency={currency}
              onQtyClick={setQtyLine}
            />
          )}
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
          {!hasInstances ? (
            <p className="text-sm text-steel py-3">
              BOM still uses schedule instances (materials from measured
              concrete / formwork / rebar).
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
          {!hasInstances ? (
            <p className="text-sm text-steel py-3">
              Labour still uses schedule instances.
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
          onOpenSchedule?.()
        }}
      />
    </div>
  )
}
