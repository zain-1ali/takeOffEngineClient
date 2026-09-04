import { useQuery } from '@tanstack/react-query'
import { getReports } from '../../api/projectsApi'
import { findElement } from '../../constants/elementTree'
import { ELEMENT_ENGINES } from '../../elementEngines'
import type { Project } from '../../types/api'
import { LabourTables } from './LabourTables'
import { ReportTable } from './ReportTable'

type ReportSubTab = 'boq' | 'bom' | 'labour'

export function ElementReportsTab({
  project,
  floorId,
  elementKey,
  sub,
}: {
  project: Project
  floorId: string
  elementKey: string
  sub: ReportSubTab
}) {
  const el = findElement(elementKey)
  const implemented = !!ELEMENT_ENGINES[elementKey]

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

  return (
    <div className="h-full overflow-auto px-4 py-3">
      {query.isLoading && <p className="text-sm text-steel">Building reports…</p>}
      {query.isError && (
        <p className="text-sm text-danger">Failed to load reports.</p>
      )}
      {!query.isLoading && !bundle && (
        <p className="text-sm text-steel">
          Use ▸ on this element to Add to BOQ, then enter schedule data or measure
          from PDF for quantities. BOM / Labour need schedule instances.
        </p>
      )}
      {bundle && sub === 'boq' && (
        <>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <h3 className="font-display text-base font-semibold text-ink">
              BOQ — {el?.num}. {el?.label}
            </h3>
            <p className="text-[11px] text-steel shrink-0">
              {floorId} · {bundle.units} u · {currency}
            </p>
          </div>
          <ReportTable lines={bundle.boq} currency={currency} />
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
              BOM needs schedule instances (materials come from measured
              concrete / formwork / rebar). Add schedule rows or measure from
              PDF first.
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
              Labour needs schedule instances. Add schedule data or measure from
              PDF first.
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
    </div>
  )
}
