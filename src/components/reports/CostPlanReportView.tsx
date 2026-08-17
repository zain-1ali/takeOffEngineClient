import { useMemo, useState } from 'react'
import { formatMoney } from '../../lib/units'
import type { CostPlanLine, CostPlanPayload, CostPlanSummaryLine } from '../../types/costPlan'
import { DataTable } from '../ui'

function fmtQty(qty: number | undefined, line: CostPlanLine): string {
  if (qty == null || Number.isNaN(qty)) return '—'
  const dec =
    line.dec ??
    (line.unit === 't' ? 3 : line.unit === 'bags' || line.unit === 'L' || line.unit === 'nos' ? 1 : 2)
  if (line.unit === 'nos' || (line.dec === 0 && Number.isInteger(qty))) return String(Math.round(qty))
  return qty.toFixed(dec === 0 ? 0 : dec)
}

function fmtPct(p: number | undefined): string {
  if (p == null) return ''
  return `${p.toFixed(Number.isInteger(p) ? 0 : 2)}%`
}

function fmtRate(v: number | undefined | null, currency: string): string {
  if (v == null || Number.isNaN(v)) return '—'
  return formatMoney(v, currency)
}

type AccordionRow = {
  key: string
  line: CostPlanLine
  expanded?: boolean
  toggleKind?: 'element' | 'category'
  sectionKey?: string
}

function buildAccordionRows(
  lines: CostPlanLine[],
  collapsedElements: Set<string>,
  collapsedCategories: Set<string>,
): AccordionRow[] {
  const rows: AccordionRow[] = []
  let elementKey: string | null = null
  let elementCollapsed = false
  let categoryCollapsed = false
  let i = 0

  for (const line of lines) {
    const level = line.outlineLevel
    const isElementHeader =
      line.kind === 'group' && !line.workCategory && (level === 0 || level == null)
    const isCategoryHeader = line.kind === 'group' && Boolean(line.workCategory)
    const isElementTotal =
      line.kind === 'total' &&
      !/COST PLAN TOTAL/i.test(line.description || '') &&
      (level === 0 || level == null)
    const isGrand = line.kind === 'total' && /COST PLAN TOTAL/i.test(line.description || '')

    if (isElementHeader) {
      elementKey = `el-${i}-${line.description}`
      elementCollapsed = collapsedElements.has(elementKey)
      categoryCollapsed = false
      rows.push({
        key: `r-${i}`,
        line,
        expanded: !elementCollapsed,
        toggleKind: 'element',
        sectionKey: elementKey,
      })
      i++
      continue
    }

    if (isCategoryHeader) {
      if (elementCollapsed) {
        i++
        continue
      }
      const categoryKey = `${elementKey || 'root'}::cat-${line.workCategory}-${i}`
      categoryCollapsed = collapsedCategories.has(categoryKey)
      rows.push({
        key: `r-${i}`,
        line,
        expanded: !categoryCollapsed,
        toggleKind: 'category',
        sectionKey: categoryKey,
      })
      i++
      continue
    }

    if (line.kind === 'item') {
      if (elementCollapsed || categoryCollapsed) {
        i++
        continue
      }
      rows.push({ key: `r-${i}`, line })
      i++
      continue
    }

    if (isElementTotal || isGrand) {
      elementCollapsed = false
      categoryCollapsed = false
      rows.push({ key: `r-${i}`, line })
      i++
      continue
    }

    rows.push({ key: `r-${i}`, line })
    i++
  }

  return rows
}

export function CostPlanReportView({
  data,
}: {
  data: CostPlanPayload
}) {
  const showRateM2 = data.gfaM2 != null && data.gfaM2 > 0
  const currency = data.currency
  const colCount = showRateM2 ? 7 : 6

  const [collapsedElements, setCollapsedElements] = useState<Set<string>>(
    () => new Set(),
  )
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    () => new Set(),
  )

  const accordionRows = useMemo(
    () =>
      buildAccordionRows(data.lines, collapsedElements, collapsedCategories),
    [data.lines, collapsedElements, collapsedCategories],
  )

  function toggleElement(key: string) {
    setCollapsedElements((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleCategory(key: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-6">
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
              {showRateM2 && (
                <DataTable.HeaderCell align="right" className="w-24">
                  Rate/m²
                </DataTable.HeaderCell>
              )}
            </DataTable.Row>
          </DataTable.Header>
          <DataTable.Body>
            {data.lines.length === 0 && (
              <DataTable.Row>
                <DataTable.Cell colSpan={colCount} className="text-steel py-6">
                  No priced cost-plan lines in this scope.
                </DataTable.Cell>
              </DataTable.Row>
            )}
            {accordionRows.map((row) => {
              const line = row.line
              if (line.kind === 'group') {
                const isWorkCat = Boolean(line.workCategory)
                const chevron =
                  row.toggleKind != null ? (row.expanded ? '▾' : '▸') : null
                const onToggle =
                  row.toggleKind === 'element'
                    ? () => toggleElement(row.sectionKey!)
                    : row.toggleKind === 'category'
                      ? () => toggleCategory(row.sectionKey!)
                      : undefined
                return (
                  <DataTable.Row
                    key={row.key}
                    className="!border-0 hover:!bg-transparent"
                  >
                    <DataTable.Cell
                      colSpan={colCount}
                      className={
                        isWorkCat
                          ? '!py-1.5 pl-4 font-semibold text-ink text-[12px] border-l-2 border-signal cursor-pointer'
                          : '!py-2 bg-panel-hover font-semibold text-ink uppercase tracking-wide text-[11px] cursor-pointer'
                      }
                      onClick={onToggle}
                    >
                      {chevron != null && (
                        <span className="inline-block w-4 mr-1 opacity-70" aria-hidden>
                          {chevron}
                        </span>
                      )}
                      {line.description}
                    </DataTable.Cell>
                  </DataTable.Row>
                )
              }
              if (line.kind === 'total') {
                return (
                  <DataTable.Row key={row.key} totals>
                    <DataTable.Cell colSpan={5}>{line.description}</DataTable.Cell>
                    <DataTable.Cell numeric className="text-ink font-bold">
                      {formatMoney(line.amount, currency)}
                    </DataTable.Cell>
                    {showRateM2 && (
                      <DataTable.Cell numeric className="text-ink font-bold">
                        {fmtRate(line.ratePerM2, currency)}
                      </DataTable.Cell>
                    )}
                  </DataTable.Row>
                )
              }
              return (
                <DataTable.Row key={row.key}>
                  <DataTable.Cell className="font-mono text-steel">{line.ref}</DataTable.Cell>
                  <DataTable.Cell>
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      {line.source === 'MANUAL' && (
                        <span className="text-[10px] uppercase tracking-wide text-signal font-medium">
                          Manual
                        </span>
                      )}
                      {line.description}
                    </span>
                  </DataTable.Cell>
                  <DataTable.Cell numeric>{fmtQty(line.qty, line)}</DataTable.Cell>
                  <DataTable.Cell>{line.unit || '—'}</DataTable.Cell>
                  <DataTable.Cell numeric>{fmtRate(line.rate, currency)}</DataTable.Cell>
                  <DataTable.Cell numeric>{formatMoney(line.amount, currency)}</DataTable.Cell>
                  {showRateM2 && (
                    <DataTable.Cell numeric>
                      {fmtRate(line.ratePerM2, currency)}
                    </DataTable.Cell>
                  )}
                </DataTable.Row>
              )
            })}
          </DataTable.Body>
        </DataTable>
      </div>

      <CascadeSummary
        lines={data.cascade.summaryLines}
        currency={currency}
        showRateM2={showRateM2}
      />
    </div>
  )
}

function CascadeSummary({
  lines,
  currency,
  showRateM2,
}: {
  lines: CostPlanSummaryLine[]
  currency: string
  showRateM2: boolean
}) {
  const cols = showRateM2 ? 4 : 3

  return (
    <div className="panel-card !p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-steel-border bg-panel-hover">
        <h3 className="text-sm font-semibold text-ink">
          Design Allowance / Overhead &amp; Profit / Inflation
        </h3>
        <p className="text-[12px] text-steel mt-0.5">
          % of Elemental is each cumulative total ÷ elemental cost
        </p>
      </div>
      <DataTable>
        <DataTable.Header>
          <DataTable.Row>
            <DataTable.HeaderCell>Description</DataTable.HeaderCell>
            <DataTable.HeaderCell align="right" className="w-32">
              Amount
            </DataTable.HeaderCell>
            {showRateM2 && (
              <DataTable.HeaderCell align="right" className="w-24">
                Rate/m²
              </DataTable.HeaderCell>
            )}
            <DataTable.HeaderCell align="right" className="w-28">
              % of Elemental
            </DataTable.HeaderCell>
          </DataTable.Row>
        </DataTable.Header>
        <DataTable.Body>
          {lines.map((line, i) => {
            const isTotal = line.kind === 'total'
            const isStage = line.kind === 'stage' || isTotal
            return (
              <DataTable.Row key={i} totals={isTotal}>
                <DataTable.Cell
                  className={
                    isTotal
                      ? 'font-bold uppercase tracking-wide'
                      : isStage
                        ? 'font-semibold text-ink'
                        : ''
                  }
                >
                  {line.description}
                </DataTable.Cell>
                <DataTable.Cell
                  numeric
                  className={isStage ? 'font-semibold text-ink' : ''}
                >
                  {formatMoney(line.amount, currency)}
                </DataTable.Cell>
                {showRateM2 && (
                  <DataTable.Cell
                    numeric
                    className={isStage ? 'font-semibold text-ink' : ''}
                  >
                    {fmtRate(line.ratePerM2, currency)}
                  </DataTable.Cell>
                )}
                <DataTable.Cell
                  numeric
                  className={isStage ? 'font-semibold text-ink' : 'text-steel'}
                >
                  {line.percentOfElemental != null
                    ? fmtPct(line.percentOfElemental)
                    : ''}
                </DataTable.Cell>
              </DataTable.Row>
            )
          })}
          {!lines.length && (
            <DataTable.Row>
              <DataTable.Cell colSpan={cols} className="text-steel">
                No cascade summary.
              </DataTable.Cell>
            </DataTable.Row>
          )}
        </DataTable.Body>
      </DataTable>
    </div>
  )
}
