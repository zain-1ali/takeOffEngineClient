/**
 * Parse a rate-databank Excel workbook into previewable import rows.
 * Columns: Category (Materials/Labour/Equipment), Name, Unit, Unit Cost.
 */
import * as XLSX from 'xlsx'
import type { RateLib, RateResource } from '../types/rateLib'

export type ImportCategory = 'materials' | 'labour' | 'equipment'

export type ValidImportRow = {
  excelRow: number
  category: ImportCategory
  resource: RateResource
}

export type SkippedImportRow = {
  excelRow: number
  reason: string
}

export type RateDatabankImportPreview = {
  sheetName: string
  valid: ValidImportRow[]
  skipped: SkippedImportRow[]
}

export type RateDatabankImportResult =
  | { ok: true; preview: RateDatabankImportPreview }
  | { ok: false; error: string }

const CATEGORY_ALIASES: Record<string, ImportCategory> = {
  materials: 'materials',
  material: 'materials',
  labour: 'labour',
  labor: 'labour',
  equipment: 'equipment',
  plant: 'equipment',
}

function normHeader(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, ' ')
}

function cellStr(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function findCol(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const i = headers.findIndex((h) => h === alias)
    if (i >= 0) return i
  }
  return -1
}

function parseCategory(raw: string): ImportCategory | null {
  const key = raw.trim().toLowerCase()
  return CATEGORY_ALIASES[key] ?? null
}

function parseUnitCost(raw: string): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[,$\s]/g, '').replace(/^\((.+)\)$/, '-$1')
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

/** Build a short unique resource code from the item name. */
export function makeImportCode(name: string, used: Set<string>): string {
  const base =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 6) || 'IMP'
  let code = base
  let n = 2
  while (used.has(code)) {
    const suffix = String(n)
    code = `${base.slice(0, Math.max(1, 6 - suffix.length))}${suffix}`
    n++
  }
  used.add(code)
  return code
}

export function parseRateDatabankWorkbook(
  data: ArrayBuffer | Uint8Array,
  existingLib: RateLib,
): RateDatabankImportResult {
  let workbook: XLSX.WorkBook
  try {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    workbook = XLSX.read(bytes, { type: 'array' })
  } catch {
    return { ok: false, error: 'Could not read the Excel file. Use a valid .xlsx workbook.' }
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { ok: false, error: 'The workbook has no sheets.' }
  }

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })

  if (!rows.length) {
    return { ok: false, error: 'The first sheet is empty.' }
  }

  const headerIdx = rows.findIndex((r) =>
    r.some((c) => {
      const h = normHeader(c)
      return h === 'category' || h === 'name'
    }),
  )
  if (headerIdx < 0) {
    return {
      ok: false,
      error:
        'Could not find a header row with Category / Name / Unit / Unit Cost columns.',
    }
  }

  const headers = (rows[headerIdx] || []).map(normHeader)
  const colCategory = findCol(headers, ['category', 'type', 'cat'])
  const colName = findCol(headers, ['name', 'description', 'desc', 'item'])
  const colUnit = findCol(headers, ['unit'])
  const colCost = findCol(headers, [
    'unit cost',
    'unitcost',
    'cost',
    'rate',
    'unit rate',
  ])

  if (colCategory < 0 || colName < 0 || colUnit < 0 || colCost < 0) {
    const missing: string[] = []
    if (colCategory < 0) missing.push('Category')
    if (colName < 0) missing.push('Name')
    if (colUnit < 0) missing.push('Unit')
    if (colCost < 0) missing.push('Unit Cost')
    return {
      ok: false,
      error: `Missing required column(s): ${missing.join(', ')}.`,
    }
  }

  const usedCodes: Record<ImportCategory, Set<string>> = {
    materials: new Set(existingLib.materials.map((r) => r.code)),
    labour: new Set(existingLib.labour.map((r) => r.code)),
    equipment: new Set(existingLib.equipment.map((r) => r.code)),
  }

  const valid: ValidImportRow[] = []
  const skipped: SkippedImportRow[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || []
    const excelRow = i + 1 // 1-based spreadsheet row
    const categoryRaw = cellStr(row[colCategory])
    const name = cellStr(row[colName])
    const unit = cellStr(row[colUnit])
    const costRaw = cellStr(row[colCost])

    if (!categoryRaw && !name && !unit && !costRaw) {
      continue // blank trailing / spacer rows
    }

    const reasons: string[] = []
    const category = parseCategory(categoryRaw)
    if (!categoryRaw) reasons.push('missing Category')
    else if (!category) {
      reasons.push(
        `Category "${categoryRaw}" is not Materials, Labour, or Equipment`,
      )
    }
    if (!name) reasons.push('missing Name')
    if (!unit) reasons.push('missing Unit')
    const rate = parseUnitCost(costRaw)
    if (!costRaw) reasons.push('missing Unit Cost')
    else if (rate == null) reasons.push(`Unit Cost "${costRaw}" is not a valid number`)

    if (reasons.length || !category || rate == null || !name || !unit) {
      skipped.push({ excelRow, reason: reasons.join('; ') })
      continue
    }

    const resource: RateResource = {
      code: makeImportCode(name, usedCodes[category]),
      desc: name,
      unit,
      rate,
      ...(category === 'materials' ? { wastage: 0 } : {}),
    }
    valid.push({ excelRow, category, resource })
  }

  if (!valid.length && !skipped.length) {
    return { ok: false, error: 'No data rows found under the header.' }
  }

  return {
    ok: true,
    preview: { sheetName, valid, skipped },
  }
}

/** Append previewed rows into a cloned rate library. */
export function applyRateDatabankImport(
  lib: RateLib,
  valid: ValidImportRow[],
): RateLib {
  const next: RateLib = JSON.parse(JSON.stringify(lib))
  for (const row of valid) {
    next[row.category].push(row.resource)
  }
  return next
}
