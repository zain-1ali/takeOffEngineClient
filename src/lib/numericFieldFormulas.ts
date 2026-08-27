/**
 * Optional formula strings stored beside Mixed bags (geometry / reinforcement).
 * Keys match field keys; engines ignore unknown Mixed keys.
 */

export function getFieldFormula(
  bag: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const raw = bag?.formulas
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const v = (raw as Record<string, unknown>)[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** Set or clear a field's formula on a Mixed bag (returns a shallow copy). */
export function withFieldFormula(
  bag: Record<string, unknown>,
  key: string,
  formula: string | null | undefined,
): Record<string, unknown> {
  const next = { ...bag }
  const prev =
    typeof next.formulas === 'object' &&
    next.formulas &&
    !Array.isArray(next.formulas)
      ? (next.formulas as Record<string, string>)
      : {}
  const formulas = { ...prev }
  if (formula && formula.trim()) {
    formulas[key] = formula.trim()
  } else {
    delete formulas[key]
  }
  if (Object.keys(formulas).length) next.formulas = formulas
  else delete next.formulas
  return next
}
