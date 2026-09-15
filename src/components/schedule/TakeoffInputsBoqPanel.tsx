import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getReports, updateSelectedBoqItem } from '../../api/projectsApi'
import type { Project } from '../../types/api'
import type { ReportLine } from '../../types/reports'
import { BoqTakeoffDialog } from '../boq/BoqTakeoffDialog'
import { DataTable, GhostButton } from '../ui'

function fmtQty(qty: number | undefined, line: ReportLine): string {
  if (qty == null || Number.isNaN(qty)) return '—'
  const dec =
    line.dec ??
    (line.unit === 't'
      ? 3
      : line.unit === 'bags' || line.unit === 'L' || line.unit === 'nos'
        ? 1
        : 2)
  if (line.unit === 'nos' || (line.dec === 0 && Number.isInteger(qty))) {
    return String(Math.round(qty))
  }
  return qty.toFixed(dec === 0 ? 0 : dec)
}

function canMeasure(line: ReportLine): boolean {
  if (!line.selectedBoqId) return false
  if (line.unit === 't' || line.unit === 'kg') return true
  return line.qtySource !== 'engine'
}

/** BOQ qty list + dim/BBS sheet hosted on Take off Inputs (not the BOQ qty cell). */
export function TakeoffInputsBoqPanel({
  project,
  floorId,
  elementKey,
  catalogueOnly = false,
  packScope,
  variant = 'engine',
}: {
  project: Project
  floorId: string
  elementKey: string
  catalogueOnly?: boolean
  packScope?: 'PROJECT' | 'FLOOR'
  variant?: 'engine' | 'catalogue'
}) {
  const qc = useQueryClient()
  const projectScoped = catalogueOnly && packScope === 'PROJECT'
  const [measureLine, setMeasureLine] = useState<ReportLine | null>(null)

  const query = useQuery({
    queryKey: [
      'reports',
      project.id,
      projectScoped ? 'project' : 'floor',
      projectScoped ? 'all' : floorId,
      elementKey,
      project.units,
      project.currency,
      project.updatedAt,
    ],
    queryFn: () =>
      getReports(project.id, {
        scope: projectScoped ? 'project' : 'floor',
        floorId: projectScoped ? undefined : floorId,
        elementKey,
      }),
    enabled: Boolean(project.id && elementKey && (projectScoped || floorId)),
  })

  const followMut = useMutation({
    mutationFn: (id: string) =>
      updateSelectedBoqItem(project.id, id, { followInputs: true }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports', project.id] })
      void qc.invalidateQueries({ queryKey: ['selected-boq', project.id] })
      void qc.invalidateQueries({ queryKey: ['cost-plan', project.id] })
    },
  })

  const bundle =
    query.data?.byElement?.find((be) => be.elementKey === elementKey) ||
    query.data?.byElement?.[0]
  const items = (bundle?.boq || []).filter((l) => l.kind === 'item')
  const measureFloorId =
    projectScoped && measureLine?.measurementSetId
      ? floorId
      : floorId

  return (
    <div className="mt-6 border-t border-steel-border pt-5 px-0">
      <h2 className="font-display text-base font-semibold text-ink">
        BOQ quantities
      </h2>
      <p className="text-[12.5px] text-steel mt-1 mb-3 max-w-2xl">
        {variant === 'catalogue'
          ? 'Measure each line here to fill BOQ qty. You can also type a number on the BOQ table.'
          : 'Bound lines follow the instance table above unless you type a qty on BOQ. Measure unbound lines here — the BOQ table no longer opens a popup.'}
      </p>
      {query.isLoading ? (
        <p className="text-sm text-steel">Loading BOQ lines…</p>
      ) : query.isError ? (
        <p className="text-sm text-danger">Failed to load BOQ lines.</p>
      ) : !items.length ? (
        <p className="text-sm text-steel">No BOQ lines for this heading yet.</p>
      ) : (
        <div className="panel-card !p-0 overflow-hidden">
          <DataTable compact>
            <DataTable.Header>
              <DataTable.Row>
                <DataTable.HeaderCell className="w-12 !py-1.5 text-[11px]">
                  Ref
                </DataTable.HeaderCell>
                <DataTable.HeaderCell className="!py-1.5 text-[11px]">
                  Description
                </DataTable.HeaderCell>
                <DataTable.HeaderCell
                  align="right"
                  className="w-24 !py-1.5 text-[11px]"
                >
                  Qty
                </DataTable.HeaderCell>
                <DataTable.HeaderCell className="w-10 !py-1.5 text-[11px]">
                  Unit
                </DataTable.HeaderCell>
                <DataTable.HeaderCell className="w-28 !py-1.5 text-[11px]" />
              </DataTable.Row>
            </DataTable.Header>
            <DataTable.Body>
              {items.map((line) => (
                <DataTable.Row key={line.selectedBoqId || line.ref}>
                  <DataTable.Cell className="font-mono text-[11px] text-steel !py-1">
                    {line.ref}
                  </DataTable.Cell>
                  <DataTable.Cell className="!py-1 text-[12px] leading-snug">
                    <span className="whitespace-pre-wrap break-words">
                      {line.description}
                    </span>
                  </DataTable.Cell>
                  <DataTable.Cell numeric className="!py-1 text-[12px]">
                    {fmtQty(line.qty, line)}
                    {line.qtySource === 'engine' ? (
                      <div className="text-[9px] uppercase tracking-wide text-steel font-sans">
                        from inputs
                      </div>
                    ) : null}
                    {line.qtySource === 'takeoff' ? (
                      <div className="text-[9px] uppercase tracking-wide text-steel font-sans">
                        measured
                      </div>
                    ) : null}
                  </DataTable.Cell>
                  <DataTable.Cell className="text-steel !py-1 text-[11px]">
                    {line.unit}
                  </DataTable.Cell>
                  <DataTable.Cell className="!py-1">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {line.qtySource === 'typed' &&
                      line.suggestedQty != null &&
                      line.selectedBoqId ? (
                        <button
                          type="button"
                          className="text-[10px] text-signal underline decoration-dotted underline-offset-2 hover:text-ink"
                          onClick={() => followMut.mutate(line.selectedBoqId!)}
                        >
                          Use engine qty
                        </button>
                      ) : null}
                      {canMeasure(line) ? (
                        <GhostButton
                          type="button"
                          className="!text-[11px] !py-1 !px-2"
                          onClick={() => setMeasureLine(line)}
                        >
                          {line.unit === 't' || line.unit === 'kg'
                            ? 'BBS'
                            : 'Measure'}
                        </GhostButton>
                      ) : null}
                    </div>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable.Body>
          </DataTable>
        </div>
      )}
      <BoqTakeoffDialog
        open={Boolean(measureLine)}
        line={measureLine}
        projectId={project.id}
        floorId={measureFloorId}
        onClose={() => setMeasureLine(null)}
      />
    </div>
  )
}
