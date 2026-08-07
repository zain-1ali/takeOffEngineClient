import type { ReportLine } from '../../types/reports'
import { DataTable } from '../ui'

function money(n: number | null | undefined, currency: string): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

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
}: {
  lines: ReportLine[]
  currency: string
  emptyMessage?: string
}) {
  if (!lines.length) {
    return <p className="text-sm text-steel py-6">{emptyMessage}</p>
  }

  return (
    <div className="panel-card !p-0 overflow-hidden">
      <DataTable>
        <DataTable.Header>
          <DataTable.Row>
            <DataTable.HeaderCell className="w-14">Item</DataTable.HeaderCell>
            <DataTable.HeaderCell>Description</DataTable.HeaderCell>
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
                    colSpan={6}
                    className="!py-2 bg-panel-hover font-semibold text-ink uppercase tracking-wide text-[11px]"
                  >
                    {line.description}
                  </DataTable.Cell>
                </DataTable.Row>
              )
            }
            if (line.kind === 'total') {
              return (
                <DataTable.Row key={i} totals>
                  <DataTable.Cell colSpan={5}>{line.description}</DataTable.Cell>
                  <DataTable.Cell numeric className="text-ink font-bold">
                    {money(line.amount, currency)}
                  </DataTable.Cell>
                </DataTable.Row>
              )
            }
            return (
              <DataTable.Row key={i}>
                <DataTable.Cell className="font-mono text-steel">{line.ref}</DataTable.Cell>
                <DataTable.Cell>{line.description}</DataTable.Cell>
                <DataTable.Cell
                  numeric
                  className={line.isRebar ? 'text-chalk' : undefined}
                >
                  {fmtQty(line.qty, line)}
                </DataTable.Cell>
                <DataTable.Cell className="text-steel">{line.unit}</DataTable.Cell>
                <DataTable.Cell numeric className="text-steel">
                  {money(line.rate, currency)}
                </DataTable.Cell>
                <DataTable.Cell numeric>{money(line.amount, currency)}</DataTable.Cell>
              </DataTable.Row>
            )
          })}
        </DataTable.Body>
      </DataTable>
    </div>
  )
}
