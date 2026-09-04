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

function basisLabel(basis: ReportLine['quantityBasis']): string | null {
  if (!basis) return null
  if (basis === 'independent') return 'Ind.'
  if (basis === 'derived') return 'Der.'
  return 'Cond.'
}

export function ReportTable({
  lines,
  currency,
  emptyMessage = 'No quantities to bill.',
}: {
  lines: ReportLine[]
  currency: string
  emptyMessage?: string
}) {
  if (!lines.length) {
    return <p className="text-sm text-steel py-6">{emptyMessage}</p>
  }

  const showCatalogueCols = lines.some(
    (l) => l.kind === 'item' && (l.nrm2Ref || l.quantityBasis),
  )
  const colCount = showCatalogueCols ? 8 : 6

  return (
    <div className="panel-card !p-0 overflow-hidden">
      <DataTable>
        <DataTable.Header>
          <DataTable.Row>
            <DataTable.HeaderCell className="w-14">Ref</DataTable.HeaderCell>
            <DataTable.HeaderCell>Description</DataTable.HeaderCell>
            {showCatalogueCols && (
              <>
                <DataTable.HeaderCell className="w-20">NRM2</DataTable.HeaderCell>
                <DataTable.HeaderCell className="w-14">Basis</DataTable.HeaderCell>
              </>
            )}
            <DataTable.HeaderCell align="right" className="w-20">
              Qty
            </DataTable.HeaderCell>
            <DataTable.HeaderCell className="w-12">Unit</DataTable.HeaderCell>
            <DataTable.HeaderCell align="right" className="w-24">
              Rate
            </DataTable.HeaderCell>
            <DataTable.HeaderCell align="right" className="w-28">
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
                    colSpan={colCount}
                    className="!py-2 bg-panel-hover font-semibold text-ink uppercase tracking-wide text-[11px]"
                  >
                    {line.source === 'MANUAL' && (
                      <span className="normal-case tracking-normal text-signal mr-2 font-medium">
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
                  <DataTable.Cell colSpan={colCount - 1}>{line.description}</DataTable.Cell>
                  <DataTable.Cell numeric className="text-ink font-bold">
                    {formatMoney(line.amount, currency)}
                  </DataTable.Cell>
                </DataTable.Row>
              )
            }
            return (
              <DataTable.Row key={i}>
                <DataTable.Cell className="font-mono text-steel">{line.ref}</DataTable.Cell>
                <DataTable.Cell>
                  <span className="inline-flex items-center gap-1.5 flex-wrap">
                    {line.source === 'MANUAL' && (
                      <span className="text-[10px] uppercase tracking-wide text-signal border border-signal/40 px-1 py-0.5">
                        Manual
                      </span>
                    )}
                    {line.source === 'CATALOGUE' && (
                      <span className="text-[10px] uppercase tracking-wide text-steel border border-steel-border px-1 py-0.5">
                        Catalogue
                      </span>
                    )}
                    {line.description}
                  </span>
                </DataTable.Cell>
                {showCatalogueCols && (
                  <>
                    <DataTable.Cell className="font-mono text-[11px] text-steel">
                      {line.nrm2Ref || '—'}
                    </DataTable.Cell>
                    <DataTable.Cell className="text-[11px] text-steel" title={line.quantityBasis}>
                      {basisLabel(line.quantityBasis) || '—'}
                    </DataTable.Cell>
                  </>
                )}
                <DataTable.Cell
                  numeric
                  className={line.isRebar ? 'text-chalk' : undefined}
                >
                  {fmtQty(line.qty, line)}
                </DataTable.Cell>
                <DataTable.Cell className="text-steel">{line.unit}</DataTable.Cell>
                <DataTable.Cell numeric className="text-steel">
                  {formatMoney(line.rate, currency)}
                </DataTable.Cell>
                <DataTable.Cell numeric>{formatMoney(line.amount, currency)}</DataTable.Cell>
              </DataTable.Row>
            )
          })}
        </DataTable.Body>
      </DataTable>
    </div>
  )
}
