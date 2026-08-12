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

/** Live bill-style preview matching themed PDF colors. */
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
  /** Preview paper is always light — never inherit app dark-mode --ink (near-white). */
  const bodyText = c.secondary
  const mutedText = c.tertiary

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
          {projectName || 'Project'} · UniFormat II
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
            {data.lines.map((line, i) => (
              <PreviewLine
                key={i}
                line={line}
                theme={theme}
                currency={currency}
                showRateM2={showRateM2}
                colCount={colCount}
                alt={i % 2 === 1}
                bodyText={bodyText}
                mutedText={mutedText}
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

function PreviewLine({
  line,
  theme,
  currency,
  showRateM2,
  colCount,
  alt,
  bodyText,
  mutedText,
}: {
  line: CostPlanLine
  theme: ReportTheme
  currency: string
  showRateM2: boolean
  colCount: number
  alt: boolean
  bodyText: string
  mutedText: string
}) {
  const c = theme.colors
  const border = '1px solid #e2e8f0'

  if (line.kind === 'group') {
    const isWorkCat = Boolean(line.workCategory)
    return (
      <tr
        style={{
          backgroundColor: isWorkCat ? c.paper : c.tint,
        }}
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
    <div className="mt-0 border-t" style={{ borderColor: c.primary, color: bodyText }}>
      <div
        className="px-4 py-2 font-semibold text-white text-[12px]"
        style={{ backgroundColor: c.primary }}
      >
        Design Allowance / Overhead &amp; Profit / Inflation
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ backgroundColor: c.secondary, color: THEME_HEADER_TEXT }}>
            <th className="text-left font-semibold px-2.5 py-2">Description</th>
            <th className="text-right font-semibold px-2.5 py-2">Amount</th>
            {showRateM2 && (
              <th className="text-right font-semibold px-2.5 py-2">Rate/m²</th>
            )}
            <th className="text-right font-semibold px-2.5 py-2">% of Elemental</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const isStage = line.kind === 'stage' || line.kind === 'total'
            const bg =
              line.kind === 'total'
                ? c.tint
                : i % 2 === 1
                  ? c.tint
                  : c.paper
            const textColor = bodyText
            return (
              <tr key={i} style={{ backgroundColor: bg, color: textColor }}>
                <td
                  className={`px-2.5 py-1.5 ${isStage ? 'font-semibold' : ''}`}
                  style={{
                    borderBottom: border,
                    color: textColor,
                    borderTop:
                      line.kind === 'total' ? `2px solid ${c.tertiary}` : undefined,
                  }}
                >
                  {line.description}
                </td>
                <td
                  className={`px-2.5 py-1.5 text-right tabular-nums ${isStage ? 'font-semibold' : ''}`}
                  style={{
                    borderBottom: border,
                    color: textColor,
                    borderTop:
                      line.kind === 'total' ? `2px solid ${c.tertiary}` : undefined,
                  }}
                >
                  {money(line.amount, currency)}
                </td>
                {showRateM2 && (
                  <td
                    className={`px-2.5 py-1.5 text-right tabular-nums ${isStage ? 'font-semibold' : ''}`}
                    style={{
                      borderBottom: border,
                      color: textColor,
                      borderTop:
                        line.kind === 'total' ? `2px solid ${c.tertiary}` : undefined,
                    }}
                  >
                    {money(line.ratePerM2, currency)}
                  </td>
                )}
                <td
                  className={`px-2.5 py-1.5 text-right tabular-nums ${isStage ? 'font-semibold' : ''}`}
                  style={{
                    borderBottom: border,
                    color: textColor,
                    borderTop:
                      line.kind === 'total' ? `2px solid ${c.tertiary}` : undefined,
                  }}
                >
                  {fmtPct(line.percentOfElemental)}
                </td>
              </tr>
            )
          })}
          {!lines.length && (
            <tr>
              <td colSpan={cols} className="px-2.5 py-4" style={{ color: mutedText }}>
                No cascade summary.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
