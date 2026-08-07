import * as XLSX from 'xlsx'
import { analyseRate } from '../lib/analyseRate'
import type { Project } from '../types/api'
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
    `<table><thead><tr><th>Item</th><th>Description</th><th class="num">Qty</th><th>Unit</th>` +
    `<th class="num">Rate (${escapeHtml(currency)})</th><th class="num">Amount</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>`
  )
}

function labourToHtml(reports: ProjectReports, currency: string): string {
  const actRows = reports.labour.activities
    .map(
      (a) =>
        `<tr><td>${escapeHtml(a.ref)}</td><td>${escapeHtml(a.activity)}</td>` +
        `<td class="num">${a.qty.toFixed(2)}</td><td>${escapeHtml(a.unit)}</td>` +
        `<td>${escapeHtml(a.outputRate)}</td><td>${escapeHtml(a.gang)}</td>` +
        `<td class="num">${a.days}</td></tr>`,
    )
    .join('')
  const tradeRows =
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
    `<table><thead><tr><th>Item</th><th>Activity</th><th class="num">Qty</th><th>Unit</th>` +
    `<th>Output rate</th><th>Gang</th><th class="num">Days</th></tr></thead>` +
    `<tbody>${actRows}</tbody></table>` +
    `<div class="section-label">Labour Summary by Trade &amp; Cost (${escapeHtml(currency)})</div>` +
    `<table style="max-width:480px"><thead><tr><th>Trade</th><th class="num">Man-days</th>` +
    `<th class="num">Day rate</th><th class="num">Cost</th></tr></thead>` +
    `<tbody>${tradeRows}</tbody></table>`
  )
}

/** PDF via print-window — port of AgileQS-Takeoff.html exportPDF */
export function exportPDF(project: Project, reports: ProjectReports) {
  const p = project
  const cur = reports.currency || p.currency
  const css =
    'body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:12px;}' +
    'h1{font-size:20px;margin:0 0 4px;}h2{font-size:15px;margin:22px 0 8px;border-bottom:2px solid #333;padding-bottom:4px;}' +
    '.meta{color:#555;font-size:12px;margin-bottom:6px;line-height:1.5;}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:10px;}' +
    'th,td{border:1px solid #ccc;padding:5px 7px;text-align:left;font-size:11px;}' +
    'th{background:#f0f0f0;} td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;}' +
    '.group-row td{background:#eaeaea;font-weight:bold;}' +
    '.total-row td{border-top:2px solid #333;font-weight:bold;background:#f7f7f7;}' +
    '.section-label{font-weight:bold;margin:12px 0 4px;font-size:12px;}'
  const win = window.open('', '_blank')
  if (!win) {
    alert('Please allow pop-ups to export the PDF.')
    return
  }
  win.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(p.name)} — Bills</title>` +
      `<style>${css}</style></head><body>` +
      `<h1>${escapeHtml(p.name)}</h1>` +
      `<div class="meta">Project ${escapeHtml(p.number)}` +
      (p.client ? ` &nbsp;·&nbsp; Client: ${escapeHtml(p.client)}` : '') +
      (p.location ? ` &nbsp;·&nbsp; ${escapeHtml(p.location)}` : '') +
      `<br>Currency ${escapeHtml(cur)}` +
      ` &nbsp;·&nbsp; Rev ${escapeHtml(p.revision)} &nbsp;·&nbsp; ${escapeHtml(p.date)}` +
      (p.preparedBy ? ` &nbsp;·&nbsp; Prepared by ${escapeHtml(p.preparedBy)}` : '') +
      `</div>` +
      `<h2>Bill of Quantities</h2>${linesToHtmlTable(reports.boq, cur)}` +
      `<h2>Bill of Materials</h2>${linesToHtmlTable(reports.bom, cur)}` +
      `<h2>Labour Schedule</h2>${labourToHtml(reports, cur)}` +
      `</body></html>`,
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
  const aoa: (string | number)[][] = [headers]
  lines.forEach((line) => {
    if (line.kind === 'group') {
      aoa.push([line.description, '', '', '', '', ''])
      return
    }
    if (line.kind === 'total') {
      aoa.push(['', line.description, '', '', '', line.amount != null ? +line.amount.toFixed(2) : ''])
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

/** Excel via SheetJS — port of AgileQS-Takeoff.html exportExcel, fed by API reports */
export function exportExcel(project: Project, reports: ProjectReports) {
  const p = project
  const cur = reports.currency || p.currency
  const info: (string | number)[][] = [
    ['Project', p.name],
    ['Number', p.number],
    ['Client', p.client],
    ['Contractor', p.contractor],
    ['Location', p.location],
    ['Currency', cur],
    ['Revision', p.revision],
    ['Date', p.date],
    ['Prepared by', p.preparedBy],
  ]

  const boqAoa = linesToAoa(reports.boq, cur)
  const bomAoa = linesToAoa(reports.bom, cur, [
    'Item',
    'Material',
    'Qty',
    'Unit',
    `Rate (${cur})`,
    `Amount (${cur})`,
  ])

  const labAoa: (string | number)[][] = [
    ['Trade', 'Man-days', `Day rate (${cur})`, `Cost (${cur})`],
  ]
  reports.labour.trades.forEach((t) => {
    labAoa.push([t.trade, t.manDays, t.dayRate, +t.cost.toFixed(2)])
  })
  labAoa.push(['Total', reports.labour.totalManDays, '', +reports.labour.totalCost.toFixed(2)])

  const raAoa: (string | number)[][] = [
    ['Item', 'Unit', 'Materials', 'Labour', 'Equipment', 'Prime', 'OH&P', `Rate (${cur})`],
  ]
  Object.keys(p.rateLib?.analyses || {}).forEach((code) => {
    const a = analyseRate(code, p.rateLib)
    if (a) {
      raAoa.push([
        a.label,
        a.unit,
        +a.matCost.toFixed(2),
        +a.labCost.toFixed(2),
        +a.eqCost.toFixed(2),
        +a.prime.toFixed(2),
        +a.ohpAmt.toFixed(2),
        +a.rate.toFixed(2),
      ])
    }
  })

  const fname = `${(p.name || 'project').replace(/[^\w\-]+/g, '_')}_bills.xlsx`

  try {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), 'Project Info')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(boqAoa), 'BOQ')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bomAoa), 'BOM')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(labAoa), 'Labour')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(raAoa), 'Rate Analysis')
    XLSX.writeFile(wb, fname)
  } catch {
    const csv = boqAoa
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = fname.replace('.xlsx', '.csv')
    a.click()
  }
}
