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
      <div className="p-8 text-sm text-steel">
        Reports are not available for {el?.label || elementKey} yet.
      </div>
    )
  }

  const bundle = query.data?.byElement?.[0]
  const currency = query.data?.currency || project.currency

  return (
    <div className="h-full overflow-auto p-6">
      {query.isLoading && <p className="text-sm text-steel">Building reports…</p>}
      {query.isError && (
        <p className="text-sm text-danger">Failed to load reports.</p>
      )}
      {!query.isLoading && !bundle && (
        <p className="text-sm text-steel">
          No instances on this floor yet. Use the ▸ on this element in the
          sidebar to Add to BOQ, then enter schedule data or measure from PDF
          for quantities.
        </p>
      )}
      {bundle && sub === 'boq' && (
        <>
          <h3 className="font-display text-xl font-semibold text-ink mb-1">
            Bill of Quantities
          </h3>
          <p className="text-[12.5px] text-steel mb-5">
            {el?.num}. {el?.label} — {floorId} · {bundle.units} unit
            {bundle.units === 1 ? '' : 's'} · {currency}
            {bundle.boq.some((l) => l.source === 'CATALOGUE')
              ? ' · catalogue picks included (qty from schedule / measure)'
              : ''}
          </p>
          <ReportTable lines={bundle.boq} currency={currency} />
        </>
      )}
      {bundle && sub === 'bom' && (
        <>
          <h3 className="font-display text-xl font-semibold text-ink mb-1">
            Bill of Materials
          </h3>
          <p className="text-[12.5px] text-steel mb-5">
            {el?.num}. {el?.label} — {floorId} · raw materials from BOQ · {currency}
          </p>
          <ReportTable lines={bundle.bom} currency={currency} />
        </>
      )}
      {bundle && sub === 'labour' && (
        <>
          <h3 className="font-display text-xl font-semibold text-ink mb-1">
            Labour Schedule
          </h3>
          <p className="text-[12.5px] text-steel mb-5">
            {el?.num}. {el?.label} — {floorId} · gang durations · {currency}
          </p>
          <LabourTables
            activities={bundle.labour.activities}
            trades={bundle.labour.trades}
            totalManDays={bundle.labour.totalManDays}
            totalCost={bundle.labour.totalCost}
            currency={currency}
          />
        </>
      )}
    </div>
  )
}
