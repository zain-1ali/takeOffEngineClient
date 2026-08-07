/**
 * Rate-analysis engine — formula-identical port of backend/src/engines/rateAnalysis.ts
 * for live Rate Library UI (build-ups reprice as resources change).
 */
import type {
  AnalysedRate,
  RateCoeffLine,
  RateLib,
  RateLineDetail,
  RateMethod,
  RateResource,
} from '../types/rateLib'

export function libIndex(arr: RateResource[]): Record<string, RateResource> {
  const m: Record<string, RateResource> = {}
  arr.forEach((x) => {
    m[x.code] = x
  })
  return m
}

export function methodByCode(code: string, methods: RateMethod[]): RateMethod | null {
  return methods.find((m) => m.code === code) || null
}

export function analyseRate(code: string, rateLib: RateLib): AnalysedRate | null {
  const a = rateLib.analyses[code]
  if (!a) return null
  const mat = libIndex(rateLib.materials)
  const lab = libIndex(rateLib.labour)
  const eq = libIndex(rateLib.equipment)
  const lineOf = (
    l: RateCoeffLine,
    lib: Record<string, RateResource>,
    withWastage: boolean,
  ): RateLineDetail => {
    const r = lib[l.ref]
    if (!r) {
      return {
        ref: l.ref,
        desc: l.ref + ' (missing)',
        unit: '',
        coeff: l.coeff,
        rate: 0,
        wastage: 0,
        amount: 0,
      }
    }
    const w = withWastage ? r.wastage || 0 : 0
    const amount = r.rate * (1 + w) * l.coeff
    return {
      ref: r.code,
      desc: r.desc,
      unit: r.unit,
      coeff: l.coeff,
      rate: r.rate,
      wastage: w,
      amount,
    }
  }
  const matLines = (a.materials || []).map((l) => lineOf(l, mat, true))
  const labLines = (a.labour || []).map((l) => lineOf(l, lab, false))
  const eqLines = (a.equipment || []).map((l) => lineOf(l, eq, false))
  const sum = (arr: RateLineDetail[]) => arr.reduce((s, x) => s + x.amount, 0)
  const matCost = sum(matLines)
  const labCost = sum(labLines)
  const eqCost = sum(eqLines)
  const prime = matCost + labCost + eqCost
  const ohpAmt = prime * (a.ohp || 0)
  const rate = prime + ohpAmt
  return {
    code,
    label: a.label,
    unit: a.unit,
    method: a.method,
    ohp: a.ohp || 0,
    matLines,
    labLines,
    eqLines,
    matCost,
    labCost,
    eqCost,
    prime,
    ohpAmt,
    rate,
  }
}
