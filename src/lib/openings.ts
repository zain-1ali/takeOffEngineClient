/** Reusable opening-deduction rows (Wall Finish now; structural Walls later). */

export const OPENING_TYPES = [
  'Door',
  'Window',
  'Louvre',
  'Penetration',
  'Other',
] as const

export type OpeningType = (typeof OPENING_TYPES)[number]

export type OpeningRow = {
  id: string
  type: OpeningType
  /** Width in metres (canonical storage). */
  width: number
  /** Height in metres (canonical storage). */
  height: number
  count: number
}

export type OpeningPreset = {
  id: string
  label: string
  type: OpeningType
  width: number
  height: number
}

/** Common sizes — auto-fill W×H when picked; still editable afterward. */
export const OPENING_PRESETS: OpeningPreset[] = [
  {
    id: 'std-door',
    label: 'Standard Door 0.9×2.1m',
    type: 'Door',
    width: 0.9,
    height: 2.1,
  },
  {
    id: 'std-door-double',
    label: 'Double Door 1.8×2.1m',
    type: 'Door',
    width: 1.8,
    height: 2.1,
  },
  {
    id: 'std-window',
    label: 'Standard Window 1.2×1.2m',
    type: 'Window',
    width: 1.2,
    height: 1.2,
  },
  {
    id: 'std-window-wide',
    label: 'Wide Window 1.8×1.2m',
    type: 'Window',
    width: 1.8,
    height: 1.2,
  },
  {
    id: 'std-louvre',
    label: 'Standard Louvre 0.6×0.6m',
    type: 'Louvre',
    width: 0.6,
    height: 0.6,
  },
]

export function newOpeningId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `opn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function emptyOpeningRow(partial?: Partial<OpeningRow>): OpeningRow {
  return {
    id: newOpeningId(),
    type: 'Door',
    width: 0.9,
    height: 2.1,
    count: 1,
    ...partial,
  }
}

export function openingRowArea(row: Pick<OpeningRow, 'width' | 'height' | 'count'>): number {
  const w = Number(row.width) || 0
  const h = Number(row.height) || 0
  const n = Math.max(0, Math.floor(Number(row.count) || 0))
  return w * h * n
}

export function openingsTotalArea(rows: OpeningRow[]): number {
  return rows.reduce((s, r) => s + openingRowArea(r), 0)
}

export function isOpeningType(v: unknown): v is OpeningType {
  return typeof v === 'string' && (OPENING_TYPES as readonly string[]).includes(v)
}

/** Normalize geometry.openings from persisted Mixed JSON. */
export function parseOpenings(raw: unknown): OpeningRow[] {
  if (!Array.isArray(raw)) return []
  const out: OpeningRow[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const type = isOpeningType(o.type) ? o.type : 'Other'
    const width = Number(o.width)
    const height = Number(o.height)
    const count = Math.max(0, Math.floor(Number(o.count) || 0))
    if (!Number.isFinite(width) || !Number.isFinite(height)) continue
    out.push({
      id: typeof o.id === 'string' && o.id ? o.id : newOpeningId(),
      type,
      width: Math.max(0, width),
      height: Math.max(0, height),
      count: count || 1,
    })
  }
  return out
}

export function roundOpeningArea(area: number, dec = 2): number {
  const f = 10 ** dec
  return Math.round((area + Number.EPSILON) * f) / f
}
