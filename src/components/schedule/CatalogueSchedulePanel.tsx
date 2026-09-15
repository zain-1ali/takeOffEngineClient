import { TakeoffInputsBoqPanel } from './TakeoffInputsBoqPanel'
import type { Project } from '../../types/api'

/** Take off Inputs tab for pack/catalogue items that have no 3D engine. */
export function CatalogueSchedulePanel({
  project,
  floorId,
  elementKey,
  elementLabel,
  catalogueOnly = true,
  packScope,
}: {
  project: Project
  floorId: string
  elementKey: string
  elementLabel: string
  catalogueOnly?: boolean
  packScope?: 'PROJECT' | 'FLOOR'
}) {
  return (
    <div className="h-full overflow-auto px-6 py-6">
      <div className="max-w-4xl space-y-1">
        <h2 className="font-display text-lg font-semibold text-ink">
          Take off Inputs
        </h2>
        <p className="text-sm text-steel leading-relaxed">
          {elementLabel} has no 3D instance table. Measure BOQ lines here to
          fill quantities.
        </p>
        <TakeoffInputsBoqPanel
          project={project}
          floorId={floorId}
          elementKey={elementKey}
          catalogueOnly={catalogueOnly}
          packScope={packScope}
          variant="catalogue"
        />
      </div>
    </div>
  )
}
