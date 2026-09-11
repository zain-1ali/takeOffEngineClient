import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSheets } from '../../api/sheets'
import { createTakeoffItem } from '../../api/takeoffItems'
import { sheetIsCalibrated } from '../../lib/sheetCalibration'
import {
  syntheticTakeoffMeasureInstance,
  takeoffItemTypeForKind,
} from '../../lib/boqTakeoff/fromPdfMeasure'
import {
  FieldMeasureButton,
  MeasureSessionModal,
  measureButtonTooltip,
} from '../MeasureSessionModal'
import { GhostButton } from '../ui'

/** Schedule tab for pack/catalogue items that have no 3D engine. */
export function CatalogueSchedulePanel({
  projectId,
  floorId,
  elementLabel,
  itemRef,
  onOpenBoq,
}: {
  projectId: string
  floorId: string
  elementLabel: string
  itemRef?: string
  onOpenBoq: () => void
}) {
  const [measureOpen, setMeasureOpen] = useState(false)
  const [saved, setSaved] = useState<string[]>([])
  const sheetsQuery = useQuery({
    queryKey: ['projects', projectId, 'sheets', floorId],
    queryFn: () => fetchSheets(projectId, floorId),
    enabled: Boolean(projectId && floorId),
  })
  const sheets = sheetsQuery.data ?? []
  const disabled = measureButtonTooltip(
    sheets.length > 0,
    sheets.some(sheetIsCalibrated),
  )
  const target = syntheticTakeoffMeasureInstance({
    floorId,
    mark: itemRef || elementLabel,
    prim: 'area',
  })

  return (
    <div className="h-full overflow-auto px-6 py-6">
      <div className="max-w-xl space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink">Schedule</h2>
        <p className="text-sm text-steel leading-relaxed">
          {elementLabel} is a BOQ takeoff item, not a 3D schedule row. Measure on
          the floor PDF here, then open BOQ and click Qty — the takeoff sheet has
          the same PDF measure icon.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <FieldMeasureButton
            disabledReason={disabled}
            label="PDF"
            onClick={() => setMeasureOpen(true)}
          />
          <span className="text-[12px] text-steel">Measure on PDF</span>
          <GhostButton className="!text-xs !py-1.5 !px-3" onClick={onOpenBoq}>
            Open BOQ takeoff
          </GhostButton>
        </div>
        {saved.length > 0 ? (
          <ul className="text-[12px] text-ink space-y-1">
            {saved.map((line, i) => (
              <li key={`${line}-${i}`}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {measureOpen ? (
        <MeasureSessionModal
          open
          projectId={projectId}
          floorId={floorId}
          instance={target.instance}
          fieldKey={target.fieldKey}
          onClose={() => setMeasureOpen(false)}
          onApply={() => undefined}
          onTakeoffCapture={(event) => {
            const type = takeoffItemTypeForKind(event.kind)
            const pointsOk =
              type === 'COUNT'
                ? event.points.length > 0
                : type === 'LINEAR'
                  ? event.points.length >= 2
                  : event.points.length >= 3
            if (pointsOk) {
              void createTakeoffItem(event.sheetId, {
                type,
                points: event.points,
                color:
                  type === 'AREA' ? '#22c55e' : type === 'COUNT' ? '#e29a12' : '#3b82f6',
                label: event.label || elementLabel,
              }).catch(() => undefined)
            }
            setSaved((prev) => [
              ...prev,
              `${event.label || type}: ${event.value}`,
            ])
          }}
        />
      ) : null}
    </div>
  )
}
