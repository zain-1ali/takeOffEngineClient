import { TakeoffLineInputsPanel } from './TakeoffLineInputsPanel'

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
          Provide the counts, dimensions, allowances, and measured drivers
          needed by the selected work. Rates and amounts remain in BOQ.
        </p>
        <div className="pt-4">
          <TakeoffLineInputsPanel
            projectId={projectId}
            floorId={floorId}
            elementKey={elementKey}
          />
        </div>
      </div>
    </div>
  )
}
