import ExcelJS from 'exceljs'
import {
  resolveReportTheme,
  type ReportThemeId,
  type ReportThemePalette,
} from './reportThemes'
import type { Project } from '../types/api'
import type { CostPlanPayload } from '../types/costPlan'

function hexToArgb(hex: string): string {
  const h = hex.replace('#', '')
  return `FF${h.length === 6 ? h.toUpperCase() : '000000'}`
}

function fillSolid(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function fontWhiteBold(size = 10): Partial<ExcelJS.Font> {
  return { bold: true, color: { argb: 'FFFFFFFF' }, size, name: 'Calibri' }
}

function fontDark(colors: ReportThemePalette, bold = false, size = 10): Partial<ExcelJS.Font> {
  return {
    bold,
    color: { argb: hexToArgb(colors.secondary) },
    size,
    name: 'Calibri',
  }
}

function applyBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFD0D7DE' } },
    left: { style: 'thin', color: { argb: 'FFD0D7DE' } },
    bottom: { style: 'thin', color: { argb: 'FFD0D7DE' } },
    right: { style: 'thin', color: { argb: 'FFD0D7DE' } },
  }
}

function colLetter(col: number): string {
  let n = col
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function formula(
  expr: string,
  result?: number | string | null,
): ExcelJS.CellValue {
  if (result == null || result === '') return { formula: expr }
  return { formula: expr, result }
}

function sumFormula(rows: number[], col: number, result?: number | null): ExcelJS.CellValue {
  if (!rows.length) return result ?? 0
  const L = colLetter(col)
  if (rows.length === 1) return formula(`${L}${rows[0]}`, result)
  const sorted = [...rows].sort((a, b) => a - b)
  let contiguous = true
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) {
      contiguous = false
      break
    }
  }
  if (contiguous) {
    return formula(
      `SUM(${L}${sorted[0]}:${L}${sorted[sorted.length - 1]})`,
      result,
    )
  }
  return formula(`SUM(${sorted.map((r) => `${L}${r}`).join(',')})`, result)
}

/** Themed Cost Plan workbook with live Excel formulas (exceljs). */
export async function exportCostPlanExcel(
  project: Project,
  costPlan: CostPlanPayload,
  themeId?: ReportThemeId | string | null,
): Promise<void> {
  const theme = resolveReportTheme(themeId ?? project.reportTheme)
  const c = theme.colors
  const cur = costPlan.currency || project.currency
  const showRateM2 = costPlan.gfaM2 != null && costPlan.gfaM2 > 0
  const colCount = showRateM2 ? 7 : 6
  const AMT = 6 // column F
  const QTY = 3 // column C
  const RATE = 5 // column E
  const RATE_M2 = 7 // column G
  const gfaCell = '$B$3'

  const wb = new ExcelJS.Workbook()
  wb.creator = 'TakeoffEngine'
  wb.created = new Date()

  const ws = wb.addWorksheet('Cost Plan', {
    views: [{ state: 'frozen', ySplit: 5 }],
  })

  ws.columns = [
    { key: 'a', width: 12 },
    { key: 'b', width: 48 },
    { key: 'c', width: 12 },
    { key: 'd', width: 10 },
    { key: 'e', width: 14 },
    { key: 'f', width: 16 },
    ...(showRateM2 ? [{ key: 'g', width: 14 }] : []),
  ]

  // Title banner
  ws.mergeCells(1, 1, 1, colCount)
  const title = ws.getCell(1, 1)
  title.value = `${project.name} — Cost Plan`
  title.font = fontWhiteBold(14)
  title.fill = fillSolid(hexToArgb(c.primary))
  title.alignment = { vertical: 'middle', horizontal: 'left' }
  ws.getRow(1).height = 24

  ws.mergeCells(2, 1, 2, colCount)
  const meta = ws.getCell(2, 1)
  meta.value = [
    `Project ${project.number}`,
    project.client ? `Client: ${project.client}` : null,
    `Currency ${cur}`,
    `Rev ${project.revision}`,
    project.date,
    `Theme: ${theme.name}`,
  ]
    .filter(Boolean)
    .join(' · ')
  meta.font = { size: 9, color: { argb: 'FFFFFFFF' }, name: 'Calibri' }
  meta.fill = fillSolid(hexToArgb(c.primary))
  ws.getRow(2).height = 18

  // Editable GFA (used by Rate/m² formulas)
  ws.getCell(3, 1).value = 'GFA (m²)'
  ws.getCell(3, 1).font = { size: 9, bold: true, name: 'Calibri' }
  ws.getCell(3, 2).value = showRateM2 ? Number(costPlan.gfaM2) : null
  ws.getCell(3, 2).numFmt = '0.00'
  ws.getCell(3, 2).font = { size: 9, name: 'Calibri' }

  // Column headers (row 4)
  const headers = [
    'Item',
    'Description',
    'Qty',
    'Unit',
    `Rate (${cur})`,
    'Amount',
    ...(showRateM2 ? ['Rate/m²'] : []),
  ]
  const headerRow = ws.addRow(headers)
  // addRow after row 3 → this is row 4
  headerRow.eachCell((cell) => {
    cell.font = fontWhiteBold(10)
    cell.fill = fillSolid(hexToArgb(c.secondary))
    cell.alignment = {
      horizontal:
        cell.value === 'Item' || cell.value === 'Description' || cell.value === 'Unit'
          ? 'left'
          : 'right',
    }
    applyBorder(cell)
  })

  let alt = false
  let codeItemRows: number[] = []
  let groupSubtotalRows: number[] = []
  const allItemRows: number[] = []
  const groupTotalRows: number[] = []
  let grandTotalRow: number | null = null

  for (const line of costPlan.lines) {
    if (line.kind === 'group') {
      const isWorkCat = Boolean(line.workCategory)
      const row = ws.addRow([line.description, ...Array(colCount - 1).fill('')])
      ws.mergeCells(row.number, 1, row.number, colCount)
      const cell = row.getCell(1)
      cell.font = fontDark(c, true, isWorkCat ? 10 : 9)
      cell.fill = fillSolid(hexToArgb(isWorkCat ? c.paper : c.tint))
      applyBorder(cell)
      if (isWorkCat) {
        cell.border = {
          ...cell.border,
          left: { style: 'medium', color: { argb: hexToArgb(c.tertiary) } },
        }
      }
      alt = false
      continue
    }

    if (line.kind === 'total') {
      const desc = line.description || ''
      const isCodeSub = desc.includes('· Sub-total')
      const isGrand = desc.includes('COST PLAN TOTAL')
      const isGroupTot = !isCodeSub && !isGrand

      const row = ws.addRow(['', desc, '', '', '', null, ...(showRateM2 ? [null] : [])])
      const r = row.number
      const amtCell = row.getCell(AMT)

      if (isCodeSub) {
        amtCell.value = sumFormula(codeItemRows, AMT, line.amount)
        groupSubtotalRows.push(r)
        codeItemRows = []
      } else if (isGrand) {
        // Prefer summing group totals when present; else all item amounts
        const src = groupTotalRows.length ? groupTotalRows : allItemRows
        amtCell.value = sumFormula(src, AMT, line.amount)
        grandTotalRow = r
      } else if (isGroupTot) {
        amtCell.value = sumFormula(groupSubtotalRows, AMT, line.amount)
        groupTotalRows.push(r)
        groupSubtotalRows = []
      } else {
        amtCell.value = line.amount != null ? +Number(line.amount).toFixed(2) : ''
      }

      amtCell.numFmt = '#,##0.00'
      if (showRateM2) {
        const m2 = row.getCell(RATE_M2)
        m2.value = formula(
          `IF(OR(${gfaCell}="",${gfaCell}=0),"",${colLetter(AMT)}${r}/${gfaCell})`,
          line.ratePerM2 ?? undefined,
        )
        m2.numFmt = '#,##0.00'
      }

      row.eachCell((cell, col) => {
        cell.font = fontDark(c, true, 10)
        cell.fill = fillSolid(hexToArgb(c.tint))
        cell.alignment = { horizontal: col >= 5 ? 'right' : 'left' }
        applyBorder(cell)
        if (col === 1) {
          cell.border = {
            ...cell.border,
            top: { style: 'medium', color: { argb: hexToArgb(c.tertiary) } },
          }
        }
      })
      alt = false
      continue
    }

    // Item row — Amount = Qty * Rate
    const row = ws.addRow([
      line.ref || '',
      (line.source === 'MANUAL' ? '[Manual] ' : '') + line.description,
      line.qty != null ? Number(line.qty) : '',
      line.unit || '',
      line.rate != null ? Number(line.rate) : '',
      null,
      ...(showRateM2 ? [null] : []),
    ])
    const r = row.number
    const qtyCell = row.getCell(QTY)
    const rateCell = row.getCell(RATE)
    const amtCell = row.getCell(AMT)
    qtyCell.numFmt = '0.00##'
    rateCell.numFmt = '#,##0.00'
    amtCell.value = formula(
      `${colLetter(QTY)}${r}*${colLetter(RATE)}${r}`,
      line.amount ?? undefined,
    )
    amtCell.numFmt = '#,##0.00'
    if (showRateM2) {
      const m2 = row.getCell(RATE_M2)
      m2.value = formula(
        `IF(OR(${gfaCell}="",${gfaCell}=0),"",${colLetter(AMT)}${r}/${gfaCell})`,
        line.ratePerM2 ?? undefined,
      )
      m2.numFmt = '#,##0.00'
    }

    codeItemRows.push(r)
    allItemRows.push(r)

    row.eachCell((cell, col) => {
      cell.font = { size: 10, name: 'Calibri' }
      cell.fill = fillSolid(hexToArgb(alt ? c.tint : c.paper))
      cell.alignment = {
        horizontal: col === 1 || col === 2 || col === 4 ? 'left' : 'right',
      }
      applyBorder(cell)
    })
    alt = !alt
  }

  // —— Cascade (live formulas) ——
  ws.addRow([])
  const ban = ws.addRow(['Design Allowance / Overhead & Profit / Inflation'])
  ws.mergeCells(ban.number, 1, ban.number, colCount)
  ban.getCell(1).font = fontWhiteBold(10)
  ban.getCell(1).fill = fillSolid(hexToArgb(c.primary))

  // Cascade columns: B=Description, C=% Applied (editable), D=Amount, E=Rate/m²?, F=% of Elemental
  // Keep Amount in column D for cascade block clarity (independent of bill Amount col F).
  const cascHead = showRateM2
    ? ['', 'Description', '% Applied', 'Amount', 'Rate/m²', '% of Elemental']
    : ['', 'Description', '% Applied', 'Amount', '% of Elemental']
  const cascHeadRow = ws.addRow(cascHead)
  cascHeadRow.eachCell((cell, col) => {
    if (col === 1) return
    cell.font = fontWhiteBold(10)
    cell.fill = fillSolid(hexToArgb(c.secondary))
    applyBorder(cell)
  })

  const casc = costPlan.cascade
  const CASC_PCT = 3 // C
  const CASC_AMT = 4 // D
  const CASC_M2 = 5
  const CASC_PCT_EL = showRateM2 ? 6 : 5

  function styleCascadeRow(
    row: ExcelJS.Row,
    opts: { stage?: boolean; total?: boolean },
  ) {
    const isStage = !!opts.stage || !!opts.total
    row.eachCell((cell, col) => {
      if (col === 1) return
      cell.font = fontDark(c, isStage, 10)
      cell.fill = fillSolid(
        hexToArgb(opts.total || isStage ? c.tint : c.paper),
      )
      cell.alignment = {
        horizontal: col === 2 ? 'left' : 'right',
      }
      applyBorder(cell)
    })
  }

  function setPctOfElemental(rowNum: number, amtCol: number, elementalRow: number) {
    const cell = ws.getCell(rowNum, CASC_PCT_EL)
    cell.value = formula(
      `IF(D${elementalRow}=0,0,${colLetter(amtCol)}${rowNum}/D${elementalRow}*100)`,
    )
    cell.numFmt = '0.00'
  }

  function setCascRateM2(rowNum: number) {
    if (!showRateM2) return
    const cell = ws.getCell(rowNum, CASC_M2)
    cell.value = formula(
      `IF(OR(${gfaCell}="",${gfaCell}=0),"",D${rowNum}/${gfaCell})`,
    )
    cell.numFmt = '#,##0.00'
  }

  // 1. Elemental Cost (= bill grand total / sum of item amounts)
  const elemRow = ws.addRow([
    '',
    'Elemental Cost',
    '',
    null,
    ...(showRateM2 ? [null] : []),
    null,
  ]).number
  if (grandTotalRow != null) {
    ws.getCell(elemRow, CASC_AMT).value = formula(
      `${colLetter(AMT)}${grandTotalRow}`,
      casc.elementalCost,
    )
  } else if (allItemRows.length) {
    ws.getCell(elemRow, CASC_AMT).value = sumFormula(
      allItemRows,
      AMT,
      casc.elementalCost,
    )
  } else {
    ws.getCell(elemRow, CASC_AMT).value = casc.elementalCost
  }
  ws.getCell(elemRow, CASC_AMT).numFmt = '#,##0.00'
  ws.getCell(elemRow, CASC_PCT_EL).value = 100
  ws.getCell(elemRow, CASC_PCT_EL).numFmt = '0.00'
  setCascRateM2(elemRow)
  styleCascadeRow(ws.getRow(elemRow), { stage: true })

  // 2. Design Allowance @ %
  const daRow = ws.addRow([
    '',
    `Design Allowance @ ${casc.designAllowancePercent}%`,
    casc.designAllowancePercent,
    null,
    ...(showRateM2 ? [null] : []),
    null,
  ]).number
  ws.getCell(daRow, CASC_PCT).numFmt = '0.00'
  ws.getCell(daRow, CASC_AMT).value = formula(
    `D${elemRow}*C${daRow}/100`,
    casc.designAllowanceAmount,
  )
  ws.getCell(daRow, CASC_AMT).numFmt = '#,##0.00'
  setPctOfElemental(daRow, CASC_AMT, elemRow)
  setCascRateM2(daRow)
  styleCascadeRow(ws.getRow(daRow), {})

  // 3. Elemental + Design Allowance
  const edaRow = ws.addRow([
    '',
    'Elemental Cost including Design Allowance',
    '',
    null,
    ...(showRateM2 ? [null] : []),
    null,
  ]).number
  ws.getCell(edaRow, CASC_AMT).value = formula(
    `D${elemRow}+D${daRow}`,
    casc.elementalWithDesignAllowance,
  )
  ws.getCell(edaRow, CASC_AMT).numFmt = '#,##0.00'
  setPctOfElemental(edaRow, CASC_AMT, elemRow)
  setCascRateM2(edaRow)
  styleCascadeRow(ws.getRow(edaRow), { stage: true })

  // 4. Overhead @ %  (same base as profit — elemental with DA)
  const ohRow = ws.addRow([
    '',
    `Overheads @ ${casc.overheadPercent}%`,
    casc.overheadPercent,
    null,
    ...(showRateM2 ? [null] : []),
    null,
  ]).number
  ws.getCell(ohRow, CASC_PCT).numFmt = '0.00'
  ws.getCell(ohRow, CASC_AMT).value = formula(
    `D${edaRow}*C${ohRow}/100`,
    casc.overheadAmount,
  )
  ws.getCell(ohRow, CASC_AMT).numFmt = '#,##0.00'
  setPctOfElemental(ohRow, CASC_AMT, elemRow)
  setCascRateM2(ohRow)
  styleCascadeRow(ws.getRow(ohRow), {})

  // 5. Profit @ %
  const prRow = ws.addRow([
    '',
    `Profit @ ${casc.profitPercent}%`,
    casc.profitPercent,
    null,
    ...(showRateM2 ? [null] : []),
    null,
  ]).number
  ws.getCell(prRow, CASC_PCT).numFmt = '0.00'
  ws.getCell(prRow, CASC_AMT).value = formula(
    `D${edaRow}*C${prRow}/100`,
    casc.profitAmount,
  )
  ws.getCell(prRow, CASC_AMT).numFmt = '#,##0.00'
  setPctOfElemental(prRow, CASC_AMT, elemRow)
  setCascRateM2(prRow)
  styleCascadeRow(ws.getRow(prRow), {})

  // 6. Construction excl. inflation
  const constRow = ws.addRow([
    '',
    'Construction Cost excluding Inflation',
    '',
    null,
    ...(showRateM2 ? [null] : []),
    null,
  ]).number
  ws.getCell(constRow, CASC_AMT).value = formula(
    `D${edaRow}+D${ohRow}+D${prRow}`,
    casc.constructionCostWithoutInflation,
  )
  ws.getCell(constRow, CASC_AMT).numFmt = '#,##0.00'
  setPctOfElemental(constRow, CASC_AMT, elemRow)
  setCascRateM2(constRow)
  styleCascadeRow(ws.getRow(constRow), { stage: true })

  // 7. Inflation @ %
  const infRow = ws.addRow([
    '',
    `Inflation @ ${casc.inflationPercent}%`,
    casc.inflationPercent,
    null,
    ...(showRateM2 ? [null] : []),
    null,
  ]).number
  ws.getCell(infRow, CASC_PCT).numFmt = '0.00'
  ws.getCell(infRow, CASC_AMT).value = formula(
    `D${constRow}*C${infRow}/100`,
    casc.inflationAmount,
  )
  ws.getCell(infRow, CASC_AMT).numFmt = '#,##0.00'
  setPctOfElemental(infRow, CASC_AMT, elemRow)
  setCascRateM2(infRow)
  styleCascadeRow(ws.getRow(infRow), {})

  // 8. SCC
  const sccRow = ws.addRow([
    '',
    'CONSTRUCTION COST (SCC)',
    '',
    null,
    ...(showRateM2 ? [null] : []),
    null,
  ]).number
  ws.getCell(sccRow, CASC_AMT).value = formula(
    `D${constRow}+D${infRow}`,
    casc.constructionCostSCC,
  )
  ws.getCell(sccRow, CASC_AMT).numFmt = '#,##0.00'
  setPctOfElemental(sccRow, CASC_AMT, elemRow)
  setCascRateM2(sccRow)
  styleCascadeRow(ws.getRow(sccRow), { total: true })

  // Note for the user
  const noteRow = ws.addRow([])
  const note = ws.addRow([
    '',
    'Tip: edit Qty, Rate, GFA (B3), or cascade % Applied cells — Amounts and SCC recalculate automatically.',
  ])
  ws.mergeCells(note.number, 2, note.number, Math.min(colCount, 6))
  note.getCell(2).font = { size: 9, italic: true, color: { argb: 'FF64748B' }, name: 'Calibri' }
  void noteRow

  const fname = `${(project.name || 'project').replace(/[^\w\-]+/g, '_')}_cost_plan.xlsx`
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = fname
  a.click()
  URL.revokeObjectURL(a.href)
}
