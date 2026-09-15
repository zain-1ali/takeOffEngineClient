/** Take off Inputs tab for pack/catalogue items that have no 3D engine. */
export function CatalogueSchedulePanel({
  elementLabel,
}: {
  elementLabel: string
}) {
  return (
    <div className="h-full overflow-auto px-6 py-6">
      <div className="max-w-4xl space-y-1">
        <h2 className="font-display text-lg font-semibold text-ink">
          Take off Inputs
        </h2>
        <p className="text-sm text-steel leading-relaxed">
          {elementLabel} has no takeoff input table. Enter its quantities
          directly in BOQ.
        </p>
      </div>
    </div>
  )
}
