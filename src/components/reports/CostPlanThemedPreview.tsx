import { useMemo, useState } from 'react'
import { formatMoney } from '../../lib/units'
import {
  THEME_HEADER_TEXT,
  resolveReportTheme,
  type ReportTheme,
  type ReportThemeId,
} from '../../lib/reportThemes'
import type { CostPlanLine, CostPlanPayload, CostPlanSummaryLine } from '../../types/costPlan'

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

function money(n: number | null | undefined, currency: string): string {
  if (n == null || Number.isNaN(n)) return '—'
  return formatMoney(n, currency)
}

type SectionKey = string

/** Live bill-style preview with element → category accordion. */
export function CostPlanThemedPreview({
  data,
  themeId,
  projectName,
}: {
  data: CostPlanPayload
  themeId?: ReportThemeId | string | null
  projectName?: string
}) {
  const theme = resolveReportTheme(themeId)
  const showRateM2 = data.gfaM2 != null && data.gfaM2 > 0
  const currency = data.currency
  const colCount = showRateM2 ? 7 : 6
  const c = theme.colors
  const bodyText = c.secondary
  const mutedText = c.tertiary

  const [collapsedElements, setCollapsedElements] = useState<Set<SectionKey>>(
    () => new Set(),
  )
  const [collapsedCategories, setCollapsedCategories] = useState<Set<SectionKey>>(
    () => new Set(),
  )

  const accordionRows = useMemo(
    () =>
      buildAccordionRows(data.lines, collapsedElements, collapsedCategories),
    [data.lines, collapsedElements, collapsedCategories],
  )

  function toggleElement(key: SectionKey) {
    setCollapsedElements((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleCategory(key: SectionKey) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div
      className="border border-steel-border overflow-hidden text-[12px]"
      style={{ backgroundColor: c.paper, color: bodyText }}
    >
      <div
        className="px-4 py-3 text-white"
        style={{ backgroundColor: c.primary }}
      >
        <p className="text-[11px] uppercase tracking-wider opacity-90">Cost Plan</p>
        <p className="text-base font-semibold mt-0.5">
          {projectName || 'Project'} · by element type
        </p>
        <p className="text-[11px] opacity-90 mt-1">
          Theme: {theme.name}
          {data.gfaM2 != null ? ` · GFA ${data.gfaM2} m²` : ''}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ backgroundColor: c.secondary, color: THEME_HEADER_TEXT }}>
              <th className="text-left font-semibold px-2.5 py-2 border-b" style={{ borderColor: c.secondary }}>
                Item
              </th>
              <th className="text-left font-semibold px-2.5 py-2 border-b" style={{ borderColor: c.secondary }}>
                Description
              </th>
              <th className="text-right font-semibold px-2.5 py-2 border-b" style={{ borderColor: c.secondary }}>
                Qty
              </th>
              <th className="text-left font-semibold px-2.5 py-2 border-b" style={{ borderColor: c.secondary }}>
                Unit
              </th>
              <th className="text-right font-semibold px-2.5 py-2 border-b" style={{ borderColor: c.secondary }}>
                Rate
              </th>
              <th className="text-right font-semibold px-2.5 py-2 border-b" style={{ borderColor: c.secondary }}>
                Amount
              </th>
              {showRateM2 && (
                <th className="text-right font-semibold px-2.5 py-2 border-b" style={{ borderColor: c.secondary }}>
                  Rate/m²
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.lines.length === 0 && (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-2.5 py-6 text-center"
                  style={{ color: mutedText }}
                >
                  No priced cost-plan lines in this scope.
                </td>
              </tr>
            )}
            {accordionRows.map((row) => (
              <PreviewLine
                key={row.key}
                line={row.line}
                theme={theme}
                currency={currency}
                showRateM2={showRateM2}
                colCount={colCount}
                alt={row.alt}
                bodyText={bodyText}
                mutedText={mutedText}
                expanded={row.expanded}
                onToggle={
                  row.toggleKind === 'element'
                    ? () => toggleElement(row.sectionKey!)
                    : row.toggleKind === 'category'
                      ? () => toggleCategory(row.sectionKey!)
                      : undefined
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      <CascadePreview
        lines={data.cascade.summaryLines}
        theme={theme}
        currency={currency}
        showRateM2={showRateM2}
        bodyText={bodyText}
        mutedText={mutedText}
      />
    </div>
  )
}

type AccordionRow = {
  key: string
  line: CostPlanLine
  alt: boolean
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
  let categoryKey: string | null = null
  let categoryCollapsed = false
  let alt = false
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

    if (isElementHeader) {
      elementKey = `el-${i}-${line.description}`
      elementCollapsed = collapsedElements.has(elementKey)
      categoryKey = null
      categoryCollapsed = false
      rows.push({
        key: `r-${i}`,
        line,
        alt: false,
        expanded: !elementCollapsed,
        toggleKind: 'element',
        sectionKey: elementKey,
      })
      alt = false
      i++
      continue
    }

    if (elementCollapsed && !isElementTotal && line.kind !== 'total') {
      // Hide category headers + items while element collapsed; still show element total if present later
      if (!(line.kind === 'total' && /COST PLAN TOTAL/i.test(line.description || ''))) {
        i++
        continue
      }
    }

    if (isCategoryHeader) {
      if (elementCollapsed) {
        i++
        continue
      }
      categoryKey = `${elementKey || 'root'}::cat-${line.workCategory}-${i}`
      categoryCollapsed = collapsedCategories.has(categoryKey)
      rows.push({
        key: `r-${i}`,
        line,
        alt: false,
        expanded: !categoryCollapsed,
        toggleKind: 'category',
        sectionKey: categoryKey,
      })
      alt = false
      i++
      continue
    }

    if (line.kind === 'item') {
      if (elementCollapsed || categoryCollapsed) {
        i++
        continue
      }
      rows.push({ key: `r-${i}`, line, alt })
      alt = !alt
      i++
      continue
    }

    // totals (element or grand)
    if (isElementTotal) {
      elementCollapsed = false
      categoryCollapsed = false
      categoryKey = null
    }
    rows.push({ key: `r-${i}`, line, alt: false })
    alt = false
    i++
  }

  return rows
}

function PreviewLine({
  line,
  theme,
  currency,
  showRateM2,
  colCount,
  alt,
  bodyText,
  mutedText,
  expanded,
  onToggle,
}: {
  line: CostPlanLine
  theme: ReportTheme
  currency: string
  showRateM2: boolean
  colCount: number
  alt: boolean
  bodyText: string
  mutedText: string
  expanded?: boolean
  onToggle?: () => void
}) {
  const c = theme.colors
  const border = '1px solid #e2e8f0'

  if (line.kind === 'group') {
    const isWorkCat = Boolean(line.workCategory)
    const chevron = onToggle != null ? (expanded ? '▾' : '▸') : null
    return (
      <tr
        style={{
          backgroundColor: isWorkCat ? c.paper : c.tint,
          cursor: onToggle ? 'pointer' : undefined,
        }}
        onClick={onToggle}
        onKeyDown={
          onToggle
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onToggle()
                }
              }
            : undefined
        }
        tabIndex={onToggle ? 0 : undefined}
        role={onToggle ? 'button' : undefined}
        aria-expanded={onToggle ? expanded : undefined}
      >
        <td
          colSpan={colCount}
          className={
            isWorkCat
              ? 'px-2.5 py-1.5 font-semibold text-[11px]'
              : 'px-2.5 py-1.5 font-semibold uppercase tracking-wide text-[11px]'
          }
          style={{
            color: bodyText,
            borderBottom: border,
            borderLeft: isWorkCat ? `3px solid ${c.tertiary}` : undefined,
            paddingLeft: isWorkCat ? 14 : undefined,
          }}
        >
          {chevron != null && (
            <span className="inline-block w-4 mr-1 opacity-70" aria-hidden>
              {chevron}
            </span>
          )}
          {line.description}
        </td>
      </tr>
    )
  }

  if (line.kind === 'total') {
    return (
      <tr style={{ backgroundColor: c.tint }}>
        <td
          colSpan={5}
          className="px-2.5 py-1.5 font-bold"
          style={{
            color: bodyText,
            borderTop: `2px solid ${c.tertiary}`,
            borderBottom: border,
          }}
        >
          {line.description}
        </td>
        <td
          className="px-2.5 py-1.5 text-right font-bold tabular-nums"
          style={{
            color: bodyText,
            borderTop: `2px solid ${c.tertiary}`,
            borderBottom: border,
          }}
        >
          {money(line.amount, currency)}
        </td>
        {showRateM2 && (
          <td
            className="px-2.5 py-1.5 text-right font-bold tabular-nums"
            style={{
              color: bodyText,
              borderTop: `2px solid ${c.tertiary}`,
              borderBottom: border,
            }}
          >
            {money(line.ratePerM2, currency)}
          </td>
        )}
      </tr>
    )
  }

  return (
    <tr style={{ backgroundColor: alt ? c.tint : c.paper, color: bodyText }}>
      <td
        className="px-2.5 py-1.5 font-mono text-[11px]"
        style={{ borderBottom: border, color: mutedText }}
      >
        {line.ref}
      </td>
      <td className="px-2.5 py-1.5" style={{ borderBottom: border, color: bodyText }}>
        {line.source === 'MANUAL' && (
          <span className="text-[10px] uppercase mr-1.5" style={{ color: c.tertiary }}>
            Manual
          </span>
        )}
        {line.description}
      </td>
      <td
        className="px-2.5 py-1.5 text-right tabular-nums"
        style={{ borderBottom: border, color: bodyText }}
      >
        {fmtQty(line.qty, line)}
      </td>
      <td className="px-2.5 py-1.5" style={{ borderBottom: border, color: bodyText }}>
        {line.unit || '—'}
      </td>
      <td
        className="px-2.5 py-1.5 text-right tabular-nums"
        style={{ borderBottom: border, color: bodyText }}
      >
        {money(line.rate, currency)}
      </td>
      <td
        className="px-2.5 py-1.5 text-right tabular-nums"
        style={{ borderBottom: border, color: bodyText }}
      >
        {money(line.amount, currency)}
      </td>
      {showRateM2 && (
        <td
          className="px-2.5 py-1.5 text-right tabular-nums"
          style={{ borderBottom: border, color: bodyText }}
        >
          {money(line.ratePerM2, currency)}
        </td>
      )}
    </tr>
  )
}

function CascadePreview({
  lines,
  theme,
  currency,
  showRateM2,
  bodyText,
  mutedText,
}: {
  lines: CostPlanSummaryLine[]
  theme: ReportTheme
  currency: string
  showRateM2: boolean
  bodyText: string
  mutedText: string
}) {
  const c = theme.colors
  const border = '1px solid #e2e8f0'
  const cols = showRateM2 ? 4 : 3

  return (
    <div className="border-t" style={{ borderColor: '#e2e8f0' }}>
      <div
        className="px-4 py-2 text-white text-[11px] font-semibold uppercase tracking-wide"
        style={{ backgroundColor: c.primary }}
      >
        Design Allowance / Overhead &amp; Profit / Inflation
      </div>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr style={{ backgroundColor: c.secondary, color: THEME_HEADER_TEXT }}>
            <th className="text-left font-semibold px-2.5 py-1.5">Description</th>
            <th className="text-right font-semibold px-2.5 py-1.5">Amount</th>
            {showRateM2 && (
              <th className="text-right font-semibold px-2.5 py-1.5">Rate/m²</th>
            )}
            <th className="text-right font-semibold px-2.5 py-1.5">% of Elemental</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const emphasize = line.kind === 'stage' || line.kind === 'total'
            return (
              <tr
                key={i}
                style={{
                  backgroundColor: emphasize ? c.tint : c.paper,
                  color: bodyText,
                }}
              >
                <td
                  className={`px-2.5 py-1.5 ${emphasize ? 'font-semibold' : ''}`}
                  style={{ borderBottom: border }}
                >
                  {line.description}
                </td>
                <td
                  className={`px-2.5 py-1.5 text-right tabular-nums ${emphasize ? 'font-semibold' : ''}`}
                  style={{ borderBottom: border }}
                >
                  {money(line.amount, currency)}
                </td>
                {showRateM2 && (
                  <td
                    className="px-2.5 py-1.5 text-right tabular-nums"
                    style={{ borderBottom: border }}
                  >
                    {money(line.ratePerM2, currency)}
                  </td>
                )}
                <td
                  className="px-2.5 py-1.5 text-right tabular-nums"
                  style={{ borderBottom: border, color: mutedText }}
                >
                  {line.percentOfElemental != null
                    ? fmtPct(line.percentOfElemental)
                    : ''}
                </td>
              </tr>
            )
          })}
          {lines.length === 0 && (
            <tr>
              <td colSpan={cols} className="px-2.5 py-4 text-center" style={{ color: mutedText }}>
                No cascade summary.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
