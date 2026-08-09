import type { ConcreteMix, MortarMix, ProjectMaterials } from '../types/api'

const SPEC: Record<string, ConcreteMix> = {
  'C15/20': { cement: 220, sand: 0.52, agg: 0.9, water: 185 },
  'C16/20': { cement: 240, sand: 0.5, agg: 0.9, water: 180 },
  'C20/25': { cement: 280, sand: 0.48, agg: 0.87, water: 175 },
  'C25/30': { cement: 320, sand: 0.45, agg: 0.85, water: 170 },
  'C28/35': { cement: 340, sand: 0.44, agg: 0.84, water: 168 },
  'C30/37': { cement: 350, sand: 0.43, agg: 0.83, water: 166 },
  'C32/40': { cement: 360, sand: 0.43, agg: 0.83, water: 165 },
  'C35/45': { cement: 380, sand: 0.42, agg: 0.82, water: 163 },
  'C40/50': { cement: 400, sand: 0.41, agg: 0.8, water: 160 },
}

export const DEFAULT_MORTAR_MIX: MortarMix = {
  cementBagsPerM3: 7.2,
  sandM3PerM3: 1.0,
}

export function defaultMixForGrade(grade: string): ConcreteMix {
  return { ...(SPEC[grade] || SPEC['C25/30']) }
}

export function ensureClientMaterials(m: ProjectMaterials): ProjectMaterials {
  const classes = m.concreteClasses?.length
    ? m.concreteClasses
    : Object.keys(SPEC).slice(0, 6)
  const concreteMixes = { ...(m.concreteMixes || {}) }
  for (const g of classes) {
    if (!concreteMixes[g]) concreteMixes[g] = defaultMixForGrade(g)
  }
  const appliedConcreteMixes = { ...(m.appliedConcreteMixes || {}) }
  for (const g of classes) {
    if (!appliedConcreteMixes[g]) {
      appliedConcreteMixes[g] = { ...(concreteMixes[g] || defaultMixForGrade(g)) }
    }
  }
  const mortarMix = {
    cementBagsPerM3:
      m.mortarMix?.cementBagsPerM3 ?? DEFAULT_MORTAR_MIX.cementBagsPerM3,
    sandM3PerM3: m.mortarMix?.sandM3PerM3 ?? DEFAULT_MORTAR_MIX.sandM3PerM3,
  }
  const appliedMortarMix = {
    cementBagsPerM3:
      m.appliedMortarMix?.cementBagsPerM3 ?? mortarMix.cementBagsPerM3,
    sandM3PerM3: m.appliedMortarMix?.sandM3PerM3 ?? mortarMix.sandM3PerM3,
  }
  const verticalBracingRate = m.verticalBracingRate ?? 5
  const soffitPropRate = m.soffitPropRate ?? 12
  return {
    ...m,
    concreteClasses: classes,
    concreteMixes,
    appliedConcreteMixes,
    mortarMix,
    appliedMortarMix,
    appliedStoneMortarRatio: m.appliedStoneMortarRatio ?? m.stoneMortarRatio,
    appliedStoneMortarFraction:
      m.appliedStoneMortarFraction ?? m.stoneMortarFraction,
    verticalBracingRate,
    soffitPropRate,
    appliedVerticalBracingRate:
      m.appliedVerticalBracingRate ?? verticalBracingRate,
    appliedSoffitPropRate: m.appliedSoffitPropRate ?? soffitPropRate,
  }
}

export function mixesArePending(materials: ProjectMaterials): boolean {
  const m = ensureClientMaterials(materials)
  for (const g of m.concreteClasses) {
    const d = m.concreteMixes[g]
    const a = m.appliedConcreteMixes[g]
    if (!d || !a) return true
    if (
      d.cement !== a.cement ||
      d.sand !== a.sand ||
      d.agg !== a.agg ||
      d.water !== a.water
    ) {
      return true
    }
  }
  if (
    m.mortarMix.cementBagsPerM3 !== m.appliedMortarMix.cementBagsPerM3 ||
    m.mortarMix.sandM3PerM3 !== m.appliedMortarMix.sandM3PerM3
  ) {
    return true
  }
  if (m.stoneMortarRatio !== m.appliedStoneMortarRatio) return true
  if (m.stoneMortarFraction !== m.appliedStoneMortarFraction) return true
  if (m.verticalBracingRate !== m.appliedVerticalBracingRate) return true
  if (m.soffitPropRate !== m.appliedSoffitPropRate) return true
  return false
}
