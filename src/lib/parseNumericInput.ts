import { Parser } from 'expr-eval'

/** Allowed formula characters: digits, operators, parentheses, whitespace, decimal point. */
const FORMULA_SAFE = /^[0-9+\-*/().\s]+$/

/** Plain number (optional leading -, integer or decimal). No scientific notation. */
const PLAIN_NUMBER = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/

const formulaParser = new Parser({
  operators: {
    add: true,
    subtract: true,
    multiply: true,
    divide: true,
    power: false,
    remainder: false,
    factorial: false,
    comparison: false,
    logical: false,
    concatenate: false,
    conditional: false,
    assignment: false,
    sin: false,
    cos: false,
    tan: false,
    asin: false,
    acos: false,
    atan: false,
    sinh: false,
    cosh: false,
    tanh: false,
    asinh: false,
    acosh: false,
    atanh: false,
    sqrt: false,
    log: false,
    ln: false,
    lg: false,
    log10: false,
    abs: false,
    ceil: false,
    floor: false,
    round: false,
    trunc: false,
    exp: false,
    length: false,
    in: false,
    random: false,
    min: false,
    max: false,
    fndef: false,
    cbrt: false,
    expm1: false,
    log1p: false,
    sign: false,
    log2: false,
  },
})

export type ParseNumericOptions = {
  allowEmpty?: boolean
  /** Commit this when the field is empty and allowEmpty is false. */
  emptyValue?: number
  min?: number
  max?: number
  integer?: boolean
}

export type ParseNumericOk = {
  ok: true
  value: number | null
}

export type ParseNumericErr = {
  ok: false
  error: string
}

export type ParseNumericResult = ParseNumericOk | ParseNumericErr

/** Format a committed number for display when the field is not focused. */
export function formatNumericDisplay(value: number): string {
  if (!Number.isFinite(value)) return ''
  if (Object.is(value, -0)) return '0'
  if (Number.isInteger(value)) return String(value)
  const trimmed = value.toFixed(10).replace(/\.?0+$/, '')
  return trimmed === '-0' ? '0' : trimmed
}

function applyBounds(
  value: number,
  options: ParseNumericOptions,
): ParseNumericResult {
  let next = value
  if (options.integer) {
    next = Math.trunc(next)
  }
  if (options.min != null && next < options.min) {
    return { ok: false, error: `Must be at least ${options.min}` }
  }
  if (options.max != null && next > options.max) {
    return { ok: false, error: `Must be at most ${options.max}` }
  }
  if (!Number.isFinite(next)) {
    return { ok: false, error: 'Enter a valid number' }
  }
  return { ok: true, value: next }
}

function evaluateFormula(expression: string): ParseNumericResult {
  const expr = expression.trim()
  if (!expr) {
    return { ok: false, error: 'Enter a formula after =' }
  }
  if (!FORMULA_SAFE.test(expr)) {
    return {
      ok: false,
      error: 'Formula may only use +, -, *, /, parentheses, and numbers',
    }
  }
  try {
    const result = formulaParser.evaluate(expr)
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      return { ok: false, error: 'Formula did not produce a number' }
    }
    return { ok: true, value: result }
  } catch {
    return { ok: false, error: 'Invalid formula' }
  }
}

/**
 * Parse a draft string from NumericInput on blur/Enter.
 * Supports plain numbers and arithmetic formulas (with or without a leading `=`),
 * evaluated via expr-eval — never `eval`.
 */
export function parseNumericInput(
  raw: string,
  options: ParseNumericOptions = {},
): ParseNumericResult {
  const trimmed = raw.trim()

  if (trimmed === '') {
    if (options.allowEmpty) {
      return { ok: true, value: null }
    }
    if (options.emptyValue !== undefined) {
      return applyBounds(options.emptyValue, options)
    }
    return { ok: false, error: 'Enter a number' }
  }

  // Explicit `=` formula, or an expression like `2+4*4` (not a plain number).
  if (trimmed.startsWith('=')) {
    const formulaResult = evaluateFormula(trimmed.slice(1))
    if (!formulaResult.ok) return formulaResult
    return applyBounds(formulaResult.value as number, options)
  }

  if (trimmed === '-' || trimmed === '.' || trimmed === '-.') {
    return { ok: false, error: 'Enter a valid number' }
  }

  if (PLAIN_NUMBER.test(trimmed)) {
    const n = Number(trimmed)
    if (!Number.isFinite(n)) {
      return { ok: false, error: 'Enter a valid number' }
    }
    return applyBounds(n, options)
  }

  if (looksLikeFormula(trimmed)) {
    const formulaResult = evaluateFormula(trimmed)
    if (!formulaResult.ok) return formulaResult
    return applyBounds(formulaResult.value as number, options)
  }

  return { ok: false, error: 'Enter a valid number' }
}

/** True when the string is a safe arithmetic expression, not a lone plain number. */
function looksLikeFormula(trimmed: string): boolean {
  if (!FORMULA_SAFE.test(trimmed)) return false
  // Must include an operator or parentheses beyond a leading unary minus.
  return /[+*/()]/.test(trimmed) || /-.+/.test(trimmed.slice(1))
}
