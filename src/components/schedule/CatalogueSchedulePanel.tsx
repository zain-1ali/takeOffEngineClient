import { ElementTakeoffForm } from './ElementTakeoffForm'

/** Take off Inputs tab for pack/catalogue items that have no 3D engine. */
export function CatalogueSchedulePanel({
  projectId,
  floorId,
  elementKey,
  elementLabel,
}: {
  projectId: string
  floorId: string
  elementKey: string
  elementLabel: string
}) {
  return (
    <div className="h-full overflow-auto px-6 py-6">
      <div className="max-w-6xl space-y-1">
        <h2 className="font-display text-lg font-semibold text-ink">
          {elementLabel} — Take off Inputs
        </h2>
        <p className="text-sm text-steel leading-relaxed">
          Enter the shared counts, dimensions, and allowances for this heading.
          Those cells quantify every selected BOQ item. Rates stay in BOQ.
        </p>
        <div className="pt-4">
          <ElementTakeoffForm
            projectId={projectId}
            floorId={floorId}
            elementKey={elementKey}
          />
        </div>
      </div>
    </div>
  )
}
