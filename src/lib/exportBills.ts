import * as XLSX from 'xlsx'
import {
  THEME_HEADER_TEXT,
  resolveReportTheme,
  type ReportThemeId,
} from '../lib/reportThemes'
import type { Project } from '../types/api'
import type { CostPlanPayload, CostPlanSummaryLine } from '../types/costPlan'
import type { ProjectReports, ReportLine } from '../types/reports'

function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

function money(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtQty(line: ReportLine): string {
  if (line.qty == null || Number.isNaN(line.qty)) return ''
  const dec = line.dec ?? (line.unit === 't' ? 3 : 2)
  return line.qty.toFixed(dec === 0 ? 0 : dec)
}

function linesToHtmlTable(lines: ReportLine[], currency: string): string {
  const rows = lines
    .map((line) => {
      if (line.kind === 'group') {
        return `<tr class="group-row"><td colspan="6">${escapeHtml(line.description)}</td></tr>`
      }
      if (line.kind === 'total') {
        return `<tr class="total-row"><td colspan="5">${escapeHtml(line.description)}</td><td class="num">${escapeHtml(money(line.amount))}</td></tr>`
      }
      return (
        `<tr><td>${escapeHtml(line.ref || '')}</td><td>${escapeHtml(line.description)}</td>` +
        `<td class="num">${escapeHtml(fmtQty(line))}</td><td>${escapeHtml(line.unit || '')}</td>` +
        `<td class="num">${escapeHtml(money(line.rate))}</td>` +
        `<td class="num">${escapeHtml(money(line.amount))}</td></tr>`
      )
    })
    .join('')
  return (
    `<table><thead><tr><th>Ref</th><th>Description</th><th class="num">Qty</th><th>Unit</th>` +
    `<th class="num">Rate (${escapeHtml(currency)})</th><th class="num">Amount</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>`
  )
}

export type BillExportKind = 'boq' | 'bom' | 'labour'

const BILL_TITLES: Record<BillExportKind, string> = {
  boq: 'Bill of Quantities',
  bom: 'Bill of Materials',
  labour: 'Labour Schedule',
}

function billCss(): string {
  return (
    'body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:12px;}' +
    'h1{font-size:20px;margin:0 0 4px;}h2{font-size:15px;margin:22px 0 8px;border-bottom:2px solid #333;padding-bottom:4px;}' +
    'h3{font-size:13px;margin:16px 0 6px;}' +
    '.meta{color:#555;font-size:12px;margin-bottom:6px;line-height:1.5;}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:10px;}' +
    'th,td{border:1px solid #ccc;padding:5px 7px;text-align:left;font-size:11px;}' +
    'th{background:#f0f0f0;} td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;}' +
    '.group-row td{background:#eaeaea;font-weight:bold;}' +
    '.total-row td{border-top:2px solid #333;font-weight:bold;background:#f7f7f7;}' +
    '.section-label{font-weight:bold;margin:12px 0 4px;font-size:12px;}'
  )
}

function projectMetaHtml(project: Project, currency: string): string {
  const p = project
  return (
    `<h1>${escapeHtml(p.name)}</h1>` +
    `<div class="meta">Project ${escapeHtml(p.number)}` +
    (p.client ? ` &nbsp;·&nbsp; Client: ${escapeHtml(p.client)}` : '') +
    (p.consultant ? ` &nbsp;·&nbsp; Consultant: ${escapeHtml(p.consultant)}` : '') +
    (p.location ? ` &nbsp;·&nbsp; ${escapeHtml(p.location)}` : '') +
    `<br>Currency ${escapeHtml(currency)}` +
    ` &nbsp;·&nbsp; Rev ${escapeHtml(p.revision)} &nbsp;·&nbsp; ${escapeHtml(p.date)}` +
    (p.preparedBy ? ` &nbsp;·&nbsp; Prepared by ${escapeHtml(p.preparedBy)}` : '') +
    `</div>`
  )
}

function labourToHtml(reports: ProjectReports, currency: string): string {
  const floors =
    reports.labour.byFloor && reports.labour.byFloor.length
      ? reports.labour.byFloor
      : [
          {
            floorId: reports.floorId || 'All',
            activities: reports.labour.activities,
            trades: reports.labour.trades,
            totalManDays: reports.labour.totalManDays,
            totalCost: reports.labour.totalCost,
          },
        ]

  const floorBlocks = floors
    .map((f) => {
      const actRows = f.activities
        .map(
          (a) =>
            `<tr><td>${escapeHtml(a.ref)}</td><td>${escapeHtml(a.activity)}</td>` +
            `<td class="num">${a.qty.toFixed(2)}</td><td>${escapeHtml(a.unit)}</td>` +
            `<td>${escapeHtml(a.outputRate)}</td><td>${escapeHtml(a.gang)}</td>` +
            `<td class="num">${a.days}</td></tr>`,
        )
        .join('')
      const tradeRows = f.trades
        .map(
          (t) =>
            `<tr><td>${escapeHtml(t.trade)}</td><td class="num">${t.manDays}</td>` +
            `<td class="num">${money(t.dayRate)}</td><td class="num">${money(t.cost)}</td></tr>`,
        )
        .join('')
      return (
        `<h3>Floor ${escapeHtml(f.floorId)} — resource loading</h3>` +
        `<table><thead><tr><th>Item</th><th>Activity</th><th class="num">Qty</th><th>Unit</th>` +
        `<th>Output rate</th><th>Gang / crew</th><th class="num">Days</th></tr></thead>` +
        `<tbody>${actRows || '<tr><td colspan="7">No activities</td></tr>'}</tbody></table>` +
        `<div class="section-label">Trade summary — ${escapeHtml(f.floorId)} (${escapeHtml(currency)})</div>` +
        `<table style="max-width:480px"><thead><tr><th>Trade</th><th class="num">Man-days</th>` +
        `<th class="num">Day rate</th><th class="num">Cost</th></tr></thead>` +
        `<tbody>${tradeRows}` +
        `<tr class="total-row"><td>Floor total</td><td class="num">${f.totalManDays}</td>` +
        `<td></td><td class="num">${money(f.totalCost)}</td></tr></tbody></table>`
      )
    })
    .join('')

  const projectTradeRows =
    reports.labour.trades
      .map(
        (t) =>
          `<tr><td>${escapeHtml(t.trade)}</td><td class="num">${t.manDays}</td>` +
          `<td class="num">${money(t.dayRate)}</td><td class="num">${money(t.cost)}</td></tr>`,
      )
      .join('') +
    `<tr class="total-row"><td>Total</td><td class="num">${reports.labour.totalManDays}</td>` +
    `<td></td><td class="num">${money(reports.labour.totalCost)}</td></tr>`

  return (
    floorBlocks +
    `<div class="section-label">Project labour summary by trade (${escapeHtml(currency)})</div>` +
    `<table style="max-width:480px"><thead><tr><th>Trade</th><th class="num">Man-days</th>` +
    `<th class="num">Day rate</th><th class="num">Cost</th></tr></thead>` +
    `<tbody>${projectTradeRows}</tbody></table>`
  )
}

function openPrintDocument(title: string, bodyHtml: string) {
  const win = window.open('', '_blank')
  if (!win) {
    alert('Please allow pop-ups to export the PDF.')
    return
  }
  win.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
      `<style>${billCss()}</style></head><body>${bodyHtml}</body></html>`,
  )
  win.document.close()
  setTimeout(() => {
    win.focus()
    win.print()
  }, 350)
}

/** Single-bill PDF (standalone document). */
export function exportBillPDF(
  project: Project,
  reports: ProjectReports,
  kind: BillExportKind,
) {
  const cur = reports.currency || project.currency
  const title = `${project.name} — ${BILL_TITLES[kind]}`
  let body =
    projectMetaHtml(project, cur) + `<h2>${escapeHtml(BILL_TITLES[kind])}</h2>`
  if (kind === 'boq') body += linesToHtmlTable(reports.boq, cur)
  else if (kind === 'bom') body += linesToHtmlTable(reports.bom, cur)
  else body += labourToHtml(reports, cur)
  openPrintDocument(title, body)
}

/** Download three separate PDF print documents (BOQ, BOM, Labour). */
export function exportAllBillPDFs(project: Project, reports: ProjectReports) {
  const kinds: BillExportKind[] = ['boq', 'bom', 'labour']
  kinds.forEach((kind, i) => {
    setTimeout(() => exportBillPDF(project, reports, kind), i * 450)
  })
}

/** @deprecated Use exportAllBillPDFs — kept as alias. */
export function exportPDF(project: Project, reports: ProjectReports) {
  exportAllBillPDFs(project, reports)
}

function costPlanLinesToHtml(
  data: CostPlanPayload,
  currency: string,
): string {
  const showRateM2 = data.gfaM2 != null && data.gfaM2 > 0
  const rows = data.lines
    .map((line) => {
      if (line.kind === 'group') {
        const cols = showRateM2 ? 7 : 6
        return `<tr class="group-row"><td colspan="${cols}">${escapeHtml(line.description)}</td></tr>`
      }
      if (line.kind === 'total') {
        return (
          `<tr class="total-row"><td colspan="5">${escapeHtml(line.description)}</td>` +
          `<td class="num">${escapeHtml(money(line.amount))}</td>` +
          (showRateM2
            ? `<td class="num">${escapeHtml(money(line.ratePerM2))}</td>`
            : '') +
          `</tr>`
        )
      }
      return (
        `<tr class="item-row"><td>${escapeHtml(line.ref || '')}</td>` +
        `<td>${line.source === 'MANUAL' ? '<span class="manual">Manual</span> ' : ''}${escapeHtml(line.description)}</td>` +
        `<td class="num">${escapeHtml(fmtQty(line))}</td><td>${escapeHtml(line.unit || '')}</td>` +
        `<td class="num">${escapeHtml(money(line.rate))}</td>` +
        `<td class="num">${escapeHtml(money(line.amount))}</td>` +
        (showRateM2
          ? `<td class="num">${escapeHtml(money(line.ratePerM2))}</td>`
          : '') +
        `</tr>`
      )
    })
    .join('')

  const head =
    `<tr><th>Item</th><th>Description</th><th class="num">Qty</th><th>Unit</th>` +
    `<th class="num">Rate (${escapeHtml(currency)})</th>` +
    `<th class="num">Amount</th>` +
    (showRateM2 ? `<th class="num">Rate/m²</th>` : '') +
    `</tr>`

  return `<table><thead>${head}</thead><tbody>${rows}</tbody></table>`
}

function cascadeToHtml(
  lines: CostPlanSummaryLine[],
  currency: string,
  showRateM2: boolean,
): string {
  const rows = lines
    .map((line) => {
      const cls =
        line.kind === 'total'
          ? 'total-row'
          : line.kind === 'stage'
            ? 'stage-row'
            : 'addon-row'
      return (
        `<tr class="${cls}"><td>${escapeHtml(line.description)}</td>` +
        `<td class="num">${escapeHtml(money(line.amount))}</td>` +
        (showRateM2
          ? `<td class="num">${escapeHtml(money(line.ratePerM2))}</td>`
          : '') +
        `<td class="num">${
          line.percentOfElemental != null
            ? escapeHtml(
                `${line.percentOfElemental.toFixed(
                  Number.isInteger(line.percentOfElemental) ? 0 : 2,
                )}%`,
              )
            : ''
        }</td></tr>`
      )
    })
    .join('')

  return (
    `<div class="section-banner">Design Allowance / Overhead &amp; Profit / Inflation</div>` +
    `<table><thead><tr><th>Description</th><th class="num">Amount (${escapeHtml(currency)})</th>` +
    (showRateM2 ? `<th class="num">Rate/m²</th>` : '') +
    `<th class="num">% of Elemental</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>`
  )
}

/** Themed Cost Plan PDF via print-window. */
export function exportCostPlanPDF(
  project: Project,
  costPlan: CostPlanPayload,
  themeId?: ReportThemeId | string | null,
) {
  const theme = resolveReportTheme(themeId ?? project.reportTheme)
  const c = theme.colors
  const cur = costPlan.currency || project.currency
  const showRateM2 = costPlan.gfaM2 != null && costPlan.gfaM2 > 0
  const p = project

  const css =
    `body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;font-size:11px;background:${c.paper};}` +
    `.page{padding:20px 24px;}` +
    `.banner{background:${c.primary};color:${THEME_HEADER_TEXT};padding:14px 18px;margin:0 0 16px;}` +
    `.banner h1{font-size:18px;margin:0 0 4px;}` +
    `.banner .meta{font-size:11px;opacity:.92;line-height:1.45;}` +
    `h2{font-size:13px;margin:18px 0 8px;color:${c.secondary};border-bottom:2px solid ${c.tertiary};padding-bottom:4px;}` +
    `table{width:100%;border-collapse:collapse;margin-bottom:12px;}` +
    `th,td{border:1px solid #d0d7de;padding:5px 7px;text-align:left;font-size:10.5px;}` +
    `th{background:${c.secondary};color:${THEME_HEADER_TEXT};border-color:${c.secondary};}` +
    `td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;}` +
    `.group-row td{background:${c.tint};font-weight:bold;color:${c.secondary};text-transform:uppercase;font-size:10px;letter-spacing:.03em;}` +
    `.total-row td{border-top:2px solid ${c.tertiary};font-weight:bold;background:${c.tint};color:${c.secondary};}` +
    `.stage-row td{font-weight:bold;color:${c.secondary};}` +
    `.item-row:nth-child(even) td{background:${c.tint};}` +
    `.manual{color:${c.tertiary};font-size:9px;text-transform:uppercase;font-weight:bold;margin-right:4px;}` +
    `.section-banner{background:${c.primary};color:${THEME_HEADER_TEXT};font-weight:bold;padding:8px 10px;margin:16px 0 0;}` +
    `@media print{body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}}`

  const win = window.open('', '_blank')
  if (!win) {
    alert('Please allow pop-ups to export the PDF.')
    return
  }
  win.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8">` +
      `<title>${escapeHtml(p.name)} — Cost Plan</title>` +
      `<style>${css}</style></head><body>` +
      `<div class="banner"><h1>${escapeHtml(p.name)} — Cost Plan</h1>` +
      `<div class="meta">Project ${escapeHtml(p.number)}` +
      (p.client ? ` · Client: ${escapeHtml(p.client)}` : '') +
      (p.consultant ? ` · Consultant: ${escapeHtml(p.consultant)}` : '') +
      (p.location ? ` · ${escapeHtml(p.location)}` : '') +
      `<br>Currency ${escapeHtml(cur)} · Rev ${escapeHtml(p.revision)} · ${escapeHtml(p.date)}` +
      (p.preparedBy ? ` · Prepared by ${escapeHtml(p.preparedBy)}` : '') +
      ` · Theme: ${escapeHtml(theme.name)}` +
      (costPlan.gfaM2 != null ? ` · GFA ${costPlan.gfaM2} m²` : '') +
      `</div></div>` +
      `<div class="page">` +
      `<h2>UniFormat II elemental costs</h2>` +
      costPlanLinesToHtml(costPlan, cur) +
      cascadeToHtml(costPlan.cascade.summaryLines, cur, showRateM2) +
      `</div></body></html>`,
  )
  win.document.close()
  setTimeout(() => {
    win.focus()
    win.print()
  }, 350)
}

function linesToAoa(
  lines: ReportLine[],
  currency: string,
  headers = ['Item', 'Description', 'Qty', 'Unit', `Rate (${currency})`, `Amount (${currency})`],
): (string | number)[][] {
  const head = headers.map((h) => (h === 'Item' ? 'Ref' : h))
  const aoa: (string | number)[][] = [head]
  lines.forEach((line) => {
    if (line.kind === 'group') {
      aoa.push([line.description, '', '', '', '', ''])
      return
    }
    if (line.kind === 'total') {
      aoa.push([
        '',
        line.description,
        '',
        '',
        '',
        line.amount != null ? +line.amount.toFixed(2) : '',
      ])
      return
    }
    aoa.push([
      line.ref || '',
      line.description,
      line.qty != null ? +fmtQty(line) : '',
      line.unit || '',
      line.rate != null ? +line.rate.toFixed(2) : '',
      line.amount != null ? +line.amount.toFixed(2) : '',
    ])
  })
  return aoa
}

function projectInfoAoa(project: Project, currency: string): (string | number)[][] {
  const p = project
  return [
    ['Project', p.name],
    ['Number', p.number],
    ['Client', p.client],
    ['Contractor', p.contractor],
    ['Consultant', p.consultant || ''],
    ['Location', p.location],
    ['Currency', currency],
    ['Revision', p.revision],
    ['Date', p.date],
    ['Prepared by', p.preparedBy],
  ]
}

function safeFileBase(project: Project): string {
  return (project.name || 'project').replace(/[^\w\-]+/g, '_')
}

function labourAoa(reports: ProjectReports, currency: string): (string | number)[][] {
  const aoa: (string | number)[][] = [
    [
      'Floor',
      'Item',
      'Activity',
      'Qty',
      'Unit',
      'Output rate',
      'Gang / crew',
      'Days',
    ],
  ]
  const floors =
    reports.labour.byFloor && reports.labour.byFloor.length
      ? reports.labour.byFloor
      : [
          {
            floorId: reports.floorId || 'All',
            activities: reports.labour.activities,
            trades: reports.labour.trades,
            totalManDays: reports.labour.totalManDays,
            totalCost: reports.labour.totalCost,
          },
        ]

  floors.forEach((f) => {
    aoa.push([`Floor ${f.floorId}`, '', '', '', '', '', '', ''])
    f.activities.forEach((a) => {
      aoa.push([
        f.floorId,
        a.ref,
        a.activity,
        +a.qty.toFixed(2),
        a.unit,
        a.outputRate,
        a.gang,
        a.days,
      ])
    })
    aoa.push([
      f.floorId,
      '',
      `Floor ${f.floorId} — trade roll-up`,
      '',
      '',
      '',
      '',
      '',
    ])
    f.trades.forEach((t) => {
      aoa.push([
        f.floorId,
        '',
        t.trade,
        t.manDays,
        'man-days',
        '',
        '',
        '',
      ])
    })
    aoa.push([])
  })

  aoa.push(['Project trade summary', '', '', '', '', '', '', ''])
  aoa.push(['', 'Trade', 'Man-days', `Day rate (${currency})`, `Cost (${currency})`, '', '', ''])
  reports.labour.trades.forEach((t) => {
    aoa.push(['', t.trade, t.manDays, t.dayRate, +t.cost.toFixed(2), '', '', ''])
  })
  aoa.push([
    '',
    'Total',
    reports.labour.totalManDays,
    '',
    +reports.labour.totalCost.toFixed(2),
    '',
    '',
    '',
  ])
  return aoa
}

function writeWorkbook(
  fname: string,
  sheets: { name: string; aoa: (string | number)[][] }[],
) {
  try {
    const wb = XLSX.utils.book_new()
    sheets.forEach((s) => {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.aoa), s.name)
    })
    XLSX.writeFile(wb, fname)
  } catch {
    const csv = sheets[0].aoa
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = fname.replace(/\.xlsx$/i, '.csv')
    a.click()
  }
}

/** Single-bill Excel (standalone workbook). */
export function exportBillExcel(
  project: Project,
  reports: ProjectReports,
  kind: BillExportKind,
) {
  const cur = reports.currency || project.currency
  const base = safeFileBase(project)
  const info = projectInfoAoa(project, cur)

  if (kind === 'boq') {
    writeWorkbook(`${base}_BOQ.xlsx`, [
      { name: 'Project Info', aoa: info },
      { name: 'BOQ', aoa: linesToAoa(reports.boq, cur) },
    ])
    return
  }
  if (kind === 'bom') {
    writeWorkbook(`${base}_BOM.xlsx`, [
      { name: 'Project Info', aoa: info },
      {
        name: 'BOM',
        aoa: linesToAoa(reports.bom, cur, [
          'Item',
          'Material',
          'Qty',
          'Unit',
          `Rate (${cur})`,
          `Amount (${cur})`,
        ]),
      },
    ])
    return
  }

  writeWorkbook(`${base}_Labour.xlsx`, [
    { name: 'Project Info', aoa: info },
    { name: 'Labour', aoa: labourAoa(reports, cur) },
  ])
}

/** Download three separate Excel files (BOQ, BOM, Labour). */
export function exportAllBillExcels(project: Project, reports: ProjectReports) {
  const kinds: BillExportKind[] = ['boq', 'bom', 'labour']
  kinds.forEach((kind, i) => {
    setTimeout(() => exportBillExcel(project, reports, kind), i * 200)
  })
}

/** @deprecated Use exportAllBillExcels — kept as alias. */
export function exportExcel(project: Project, reports: ProjectReports) {
  exportAllBillExcels(project, reports)
}
