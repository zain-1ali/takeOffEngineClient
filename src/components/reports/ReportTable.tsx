import { formatMoney } from '../../lib/units'
import type { ReportLine } from '../../types/reports'
import { DataTable } from '../ui'

function fmtQty(qty: number | undefined, line: ReportLine): string {
  if (qty == null || Number.isNaN(qty)) return '—'
  const dec =
    line.dec ??
    (line.unit === 't' ? 3 : line.unit === 'bags' || line.unit === 'L' || line.unit === 'nos' ? 1 : 2)
  if (line.unit === 'nos' || (line.dec === 0 && Number.isInteger(qty))) return String(Math.round(qty))
  return qty.toFixed(dec === 0 ? 0 : dec)
}

export function ReportTable({
  lines,
  currency,
  emptyMessage = 'No quantities to bill.',
  onQtyClick,
}: {
  lines: ReportLine[]
  currency: string
  emptyMessage?: string
  /** Click a catalogue qty cell to open the takeoff sheet / BBS. */
  onQtyClick?: (line: ReportLine) => void
}) {
  if (!lines.length) {
    return <p className="text-sm text-steel py-4">{emptyMessage}</p>
  }

  return (
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
            <DataTable.HeaderCell align="right" className="w-16 !py-1.5 text-[11px]">
              Qty
            </DataTable.HeaderCell>
            <DataTable.HeaderCell className="w-10 !py-1.5 text-[11px]">
              Unit
            </DataTable.HeaderCell>
            <DataTable.HeaderCell align="right" className="w-20 !py-1.5 text-[11px]">
              Rate
            </DataTable.HeaderCell>
            <DataTable.HeaderCell align="right" className="w-24 !py-1.5 text-[11px]">
              Amount
            </DataTable.HeaderCell>
          </DataTable.Row>
        </DataTable.Header>
        <DataTable.Body>
          {lines.map((line, i) => {
            if (line.kind === 'group') {
              return (
                <DataTable.Row key={i} className="!border-0 hover:!bg-transparent">
                  <DataTable.Cell
                    colSpan={6}
                    className="!py-1 bg-panel-hover font-semibold text-ink uppercase tracking-wide text-[10px]"
                  >
                    {line.source === 'MANUAL' && (
                      <span className="normal-case tracking-normal text-signal mr-1.5 font-medium">
                        Manual
                      </span>
                    )}
                    {line.description}
                  </DataTable.Cell>
                </DataTable.Row>
              )
            }
            if (line.kind === 'total') {
              return (
                <DataTable.Row key={i} totals>
                  <DataTable.Cell colSpan={5} className="!py-1.5 text-[12px]">
                    {line.description}
                  </DataTable.Cell>
                  <DataTable.Cell numeric className="text-ink font-bold !py-1.5 text-[12px]">
                    {formatMoney(line.amount, currency)}
                  </DataTable.Cell>
                </DataTable.Row>
              )
            }
            return (
              <DataTable.Row key={i}>
                <DataTable.Cell className="font-mono text-[11px] text-steel !py-1">
                  {line.ref}
                </DataTable.Cell>
                <DataTable.Cell className="!py-1 text-[12px] leading-snug">
                  <span className="inline-flex items-start gap-1 flex-wrap">
                    {line.source === 'MANUAL' && (
                      <span className="text-[9px] uppercase tracking-wide text-signal border border-signal/40 px-0.5 leading-4">
                        Manual
                      </span>
                    )}
                    {line.source === 'CATALOGUE' && Number(line.qty) === 0 && (
                      <span
                        className="text-[9px] uppercase tracking-wide text-steel border border-steel-border px-0.5 leading-4"
                        title="Click Qty to open the takeoff sheet"
                      >
                        No qty
                      </span>
                    )}
                    <span className="line-clamp-2">{line.description}</span>
                  </span>
                </DataTable.Cell>
                <DataTable.Cell
                  numeric
                  className={`!py-1 text-[12px] ${line.isRebar ? 'text-chalk' : ''}`}
                >
                  {onQtyClick && line.selectedBoqId ? (
                    <button
                      type="button"
                      className="w-full text-right underline decoration-dotted underline-offset-2 hover:text-signal"
                      title={
                        line.unit === 't' || line.unit === 'kg'
                          ? 'Open bar bending schedule'
                          : 'Open takeoff sheet'
                      }
                      onClick={() => onQtyClick(line)}
                    >
                      <span className="inline-flex items-baseline justify-end gap-1">
                        {line.takeoffLinked ? (
                          <span className="text-[10px] text-chalk" title="Linked measurements">
                            ↗
                          </span>
                        ) : null}
                        {fmtQty(line.qty, line)}
                        {line.takeoffLineCount ? (
                          <span className="text-[10px] text-steel no-underline">
                            ({line.takeoffLineCount})
                          </span>
                        ) : null}
                      </span>
                    </button>
                  ) : (
                    fmtQty(line.qty, line)
                  )}
                </DataTable.Cell>
                <DataTable.Cell className="text-steel !py-1 text-[11px]">
                  {line.unit}
                </DataTable.Cell>
                <DataTable.Cell numeric className="text-steel !py-1 text-[12px]">
                  {formatMoney(line.rate, currency)}
                </DataTable.Cell>
                <DataTable.Cell numeric className="!py-1 text-[12px]">
                  {formatMoney(line.amount, currency)}
                </DataTable.Cell>
              </DataTable.Row>
            )
          })}
        </DataTable.Body>
      </DataTable>
    </div>
  )
}
