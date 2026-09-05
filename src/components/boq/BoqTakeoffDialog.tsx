import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  applySelectedBoqTakeoff,
  getSelectedBoqTakeoff,
} from '../../api/projectsApi'
import type { TakeoffLine } from '../../lib/boqTakeoff/measurement'
import type { BbsBar } from '../../lib/boqTakeoff/bbs'
import type { ReportLine } from '../../types/reports'
import { BbsTakeoffSheet } from './takeoff/BbsTakeoffSheet'
import { TakeoffSheet } from './takeoff/TakeoffSheet'

export function BoqTakeoffDialog({
  open,
  line,
  projectId,
  onClose,
  onOpenSchedule,
}: {
  open: boolean
  line: ReportLine | null
  projectId: string
  onClose: () => void
  onOpenSchedule?: () => void
}) {
  const qc = useQueryClient()
  const itemId = line?.selectedBoqId || ''

  const query = useQuery({
    queryKey: ['boq-takeoff', projectId, itemId],
    queryFn: () => getSelectedBoqTakeoff(projectId, itemId),
    enabled: open && !!projectId && !!itemId,
  })

  const mut = useMutation({
    mutationFn: (
      body:
        | {
            kind: 'dim'
            wastePct: number
            lines: TakeoffLine[]
            measurementSetId?: string | null
          }
        | { kind: 'bbs'; wastePct: number; bars: BbsBar[] },
    ) => applySelectedBoqTakeoff(projectId, itemId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports', projectId] })
      void qc.invalidateQueries({ queryKey: ['selected-boq', projectId] })
      void qc.invalidateQueries({ queryKey: ['boq-takeoff', projectId] })
      onClose()
    },
  })

  if (!open || !line) return null

  const takeoff = query.data?.takeoff
  const kind = takeoff?.kind || (line.unit === 't' || line.unit === 'kg' ? 'bbs' : 'dim')

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/50 p-3"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        {query.isLoading || !takeoff ? (
          <div className="w-[min(32rem,90vw)] border border-steel-border bg-panel px-4 py-6 text-[13px] text-steel">
            {query.isError ? 'Failed to load takeoff.' : 'Opening takeoff…'}
          </div>
        ) : kind === 'bbs' ? (
          <BbsTakeoffSheet
            open
            onClose={onClose}
            itemRef={takeoff.ref}
            description={takeoff.description}
            unit={takeoff.unit}
            elementKey={takeoff.elementKey}
            initialBars={takeoff.bars}
            initialWaste={takeoff.wastePct}
            onApply={({ wastePct, bars }) => mut.mutate({ kind: 'bbs', wastePct, bars })}
          />
        ) : (
          <TakeoffSheet
            open
            onClose={onClose}
            itemRef={takeoff.ref}
            description={takeoff.description}
            unit={takeoff.unit}
            elementKey={takeoff.elementKey}
            initialLines={takeoff.lines}
            initialWaste={takeoff.wastePct}
            measurementSetId={takeoff.measurementSetId}
            sharedBy={takeoff.sharedBy}
            linkTargets={takeoff.linkTargets}
            onOpenSchedule={onOpenSchedule}
            onApply={({ wastePct, lines, measurementSetId }) =>
              mut.mutate({ kind: 'dim', wastePct, lines, measurementSetId })
            }
          />
        )}
        {mut.isError ? (
          <p className="mt-2 text-center text-[12px] text-danger">
            Could not apply takeoff. Try again.
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
