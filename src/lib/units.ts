/**
 * Display-unit conversion — mirrors backend/src/engines/units.ts.
 * Engines always use metric; convert at render time only.
 */

export type UnitSystem = 'metric' | 'imperial'

export const M_TO_FT = 3.280839895
export const M2_TO_FT2 = M_TO_FT * M_TO_FT
export const M3_TO_FT3 = M_TO_FT * M_TO_FT * M_TO_FT

export function parseUnitSystem(units: string | null | undefined): UnitSystem {
  const s = String(units || '').toLowerCase()
  if (
    s === 'imperial' ||
    s.includes('imperial') ||
    s.includes('ft') ||
    s.includes('feet')
  ) {
    return 'imperial'
  }
  return 'metric'
}

export function unitSystemLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'Imperial (ft, ft³)' : 'Metric (m, m³)'
}

export function convertQuantity(
  value: number,
  unit: string,
  system: UnitSystem,
): { value: number; unit: string } {
  if (!Number.isFinite(value)) return { value, unit }
  if (system === 'metric') return { value, unit }
  const u = unit.trim()
  if (u === 'm³' || u === 'm3') return { value: value * M3_TO_FT3, unit: 'ft³' }
  if (u === 'm²' || u === 'm2') return { value: value * M2_TO_FT2, unit: 'ft²' }
  if (u === 'm') return { value: value * M_TO_FT, unit: 'ft' }
  return { value, unit }
}

export function lengthToDisplay(metres: number, system: UnitSystem): number {
  return system === 'imperial' ? metres * M_TO_FT : metres
}

export function lengthFromDisplay(display: number, system: UnitSystem): number {
  return system === 'imperial' ? display / M_TO_FT : display
}

/** True when a schedule geometry field is a length stored in metres. */
export function isMetricLengthLabel(label: string): boolean {
  return /\(m\)\s*$/.test(label) || /\s\(m\)$/.test(label)
}

export function displayLengthLabel(label: string, system: UnitSystem): string {
  if (system === 'imperial' && isMetricLengthLabel(label)) {
    return label.replace(/\(m\)\s*$/, '(ft)')
  }
  return label
}

export function displayOutputLabel(
  label: string,
  unit: string,
  system: UnitSystem,
): string {
  if (system !== 'imperial') return label
  const c = convertQuantity(1, unit, 'imperial')
  if (c.unit === unit) return label
  return label
    .replace(/\(m³\)/g, '(ft³)')
    .replace(/\(m²\)/g, '(ft²)')
    .replace(/\(m\)/g, '(ft)')
}

export function formatMoney(n: number | null | undefined, currency: string): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  return `${currency || 'USD'} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
