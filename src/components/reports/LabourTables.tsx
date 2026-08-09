import { formatMoney } from '../../lib/units'
import type { LabourActivity, TradeSummary } from '../../types/reports'
import { DataTable } from '../ui'

export function LabourTables({
  activities,
  trades,
  totalManDays,
  totalCost,
  currency,
  showTradeCost = true,
}: {
  activities: LabourActivity[]
  trades: TradeSummary[]
  totalManDays: number
  totalCost: number
  currency: string
  showTradeCost?: boolean
}) {
  if (!activities.length) {
    return <p className="text-sm text-steel py-6">No labour quantities.</p>
  }

  return (
    <div className="space-y-6">
      <div className="panel-card !p-0 overflow-hidden">
        <DataTable>
          <DataTable.Header>
            <DataTable.Row>
              <DataTable.HeaderCell className="w-12">Item</DataTable.HeaderCell>
              <DataTable.HeaderCell>Activity</DataTable.HeaderCell>
              <DataTable.HeaderCell align="right" className="w-20">
                Qty
              </DataTable.HeaderCell>
              <DataTable.HeaderCell className="w-12">Unit</DataTable.HeaderCell>
              <DataTable.HeaderCell>Output rate</DataTable.HeaderCell>
              <DataTable.HeaderCell>Gang</DataTable.HeaderCell>
              <DataTable.HeaderCell align="right" className="w-16">
                Days
              </DataTable.HeaderCell>
            </DataTable.Row>
          </DataTable.Header>
          <DataTable.Body>
            {activities.map((a) => (
              <DataTable.Row key={a.ref}>
                <DataTable.Cell className="font-mono text-steel">{a.ref}</DataTable.Cell>
                <DataTable.Cell>
                  <span className="inline-flex items-center gap-1.5 flex-wrap">
                    {a.source === 'MANUAL' && (
                      <span className="text-[10px] uppercase tracking-wide text-signal border border-signal/40 px-1 py-0.5">
                        Manual
                      </span>
                    )}
                    {a.activity}
                  </span>
                </DataTable.Cell>
                <DataTable.Cell numeric>{a.qty.toFixed(2)}</DataTable.Cell>
                <DataTable.Cell className="text-steel">{a.unit}</DataTable.Cell>
                <DataTable.Cell className="text-steel">{a.outputRate}</DataTable.Cell>
                <DataTable.Cell>{a.gang}</DataTable.Cell>
                <DataTable.Cell numeric>{a.days}</DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable.Body>
        </DataTable>
      </div>

      <div className="panel-card !p-0 overflow-hidden max-w-lg">
        <div className="px-4 pt-4 pb-1">
          <h4 className="panel-card-title !mb-2">Labour summary by trade</h4>
        </div>
        <DataTable compact>
          <DataTable.Header>
            <DataTable.Row>
              <DataTable.HeaderCell>Trade</DataTable.HeaderCell>
              <DataTable.HeaderCell align="right">Man-days</DataTable.HeaderCell>
              {showTradeCost && (
                <>
                  <DataTable.HeaderCell align="right">Day rate</DataTable.HeaderCell>
                  <DataTable.HeaderCell align="right">Cost</DataTable.HeaderCell>
                </>
              )}
            </DataTable.Row>
          </DataTable.Header>
          <DataTable.Body>
            {trades.map((t) => (
              <DataTable.Row key={t.trade}>
                <DataTable.Cell>{t.trade}</DataTable.Cell>
                <DataTable.Cell numeric>{t.manDays}</DataTable.Cell>
                {showTradeCost && (
                  <>
                    <DataTable.Cell numeric className="text-steel">
                      {formatMoney(t.dayRate, currency)}
                    </DataTable.Cell>
                    <DataTable.Cell numeric>{formatMoney(t.cost, currency)}</DataTable.Cell>
                  </>
                )}
              </DataTable.Row>
            ))}
            <DataTable.Row totals>
              <DataTable.Cell>Total</DataTable.Cell>
              <DataTable.Cell numeric className="text-ink font-bold">
                {totalManDays}
              </DataTable.Cell>
              {showTradeCost && (
                <>
                  <DataTable.Cell />
                  <DataTable.Cell numeric className="text-ink font-bold">
                    {formatMoney(totalCost, currency)}
                  </DataTable.Cell>
                </>
              )}
            </DataTable.Row>
          </DataTable.Body>
        </DataTable>
      </div>
    </div>
  )
}
