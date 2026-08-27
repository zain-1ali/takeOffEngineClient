/**
 * Session / geometry helpers for measure-modal area parents + deductions.
 * Deduction polygons are subtractive; net = gross − Σ deduction areas.
 * (Manual W×H openings table remains for now — this is the plan-trace path.)
 */

import { netAreaAfterDeductions } from './measurementMath'

export type MeasureDeduction = {
  id: string
  label: string
  /** Deduction area in m². */
  areaM2: number
}

export type MeasureAreaParent = {
  id: string
  label: string
  /** Gross traced area in m² (before deductions). */
  grossM2: number
  deductions: MeasureDeduction[]
}

export function newMeasureId(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function parentNetM2(parent: MeasureAreaParent): number {
  return netAreaAfterDeductions(
    parent.grossM2,
    parent.deductions.map((d) => d.areaM2),
  )
}

export function totalDeductionsM2(parent: MeasureAreaParent): number {
  return parent.deductions.reduce(
    (s, d) => s + (Number.isFinite(d.areaM2) && d.areaM2 > 0 ? d.areaM2 : 0),
    0,
  )
}

/** Parse persisted parents from instance.geometry.measureAreaParents. */
export function parseMeasureAreaParents(raw: unknown): MeasureAreaParent[] {
  if (!Array.isArray(raw)) return []
  const out: MeasureAreaParent[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const id = typeof r.id === 'string' ? r.id : null
    const label = typeof r.label === 'string' ? r.label : null
    const grossM2 = Number(r.grossM2)
    if (!id || !label || !Number.isFinite(grossM2) || grossM2 < 0) continue
    const deductions: MeasureDeduction[] = []
    if (Array.isArray(r.deductions)) {
      for (const d of r.deductions) {
        if (!d || typeof d !== 'object') continue
        const dd = d as Record<string, unknown>
        const did = typeof dd.id === 'string' ? dd.id : null
        const dlabel = typeof dd.label === 'string' ? dd.label : null
        const areaM2 = Number(dd.areaM2)
        if (!did || !dlabel || !Number.isFinite(areaM2) || areaM2 < 0) continue
        deductions.push({ id: did, label: dlabel, areaM2 })
      }
    }
    out.push({ id, label, grossM2, deductions })
  }
  return out
}

export function addDeductionToParent(
  parents: MeasureAreaParent[],
  parentId: string,
  deduction: MeasureDeduction,
): MeasureAreaParent[] {
  return parents.map((p) =>
    p.id === parentId
      ? { ...p, deductions: [...p.deductions, deduction] }
      : p,
  )
}
