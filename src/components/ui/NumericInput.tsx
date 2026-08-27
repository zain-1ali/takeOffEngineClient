import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from 'react'
import {
  formatNumericDisplay,
  formulaSourceForDisplay,
  isNumericFormulaInput,
  parseNumericInput,
  type ParseNumericOptions,
} from '../../lib/parseNumericInput'

export type NumericInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'inputMode' | 'defaultValue'
> &
  ParseNumericOptions & {
    value: number | null | undefined
    /**
     * Called on successful commit. Second arg is the formula source when
     * `rememberFormula` is on (`null` = plain number / cleared); omitted when off.
     */
    onChange: (value: number | null, formula?: string | null) => void
    /**
     * Persisted formula to show under the field and restore on focus.
     * When provided, acts as controlled source for the hint while blurred.
     */
    formula?: string | null
    /** When false, errors use compact caption styling (table cells). Default true. */
    showError?: boolean
    /**
     * When true (default), remember the last formula and show it under the field
     * (and restore it on focus). Stored value remains the evaluated number.
     */
    rememberFormula?: boolean
  }

/**
 * Number field that keeps the raw typing string while focused, commits on blur/Enter,
 * supports arithmetic formulas (`2+4*4` or `=2+4*4`) via expr-eval, and never silently
 * coerces junk to 0.
 *
 * After a formula commits, the field shows the result; the formula stays available
 * as a hint under the input and is restored when the user focuses again.
 */
export function NumericInput({
  value,
  onChange,
  formula,
  allowEmpty = false,
  emptyValue,
  min,
  max,
  integer = false,
  showError = true,
  rememberFormula = true,
  className = '',
  onFocus,
  onBlur,
  onKeyDown,
  disabled,
  id,
  ...rest
}: NumericInputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`
  const formulaId = `${inputId}-formula`
  const inputRef = useRef<HTMLInputElement>(null)
  const skipCommitRef = useRef(false)
  const draftRef = useRef('')
  /** Formula we last sent to the parent; avoids stale prop sync wiping it. */
  const pendingFormulaRef = useRef<string | null | undefined>(undefined)

  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  /** Last successful formula source (e.g. `3+5`), independent of the numeric value. */
  const [formulaHint, setFormulaHint] = useState<string | null>(() =>
    rememberFormula && formula ? formula : null,
  )

  function updateDraft(next: string): void {
    draftRef.current = next
    setDraft(next)
  }

  // Sync from parent when the persisted formula changes — not merely on blur,
  // so we never overwrite a just-committed hint with a stale `null` prop.
  useEffect(() => {
    if (!rememberFormula || formula === undefined) return
    if (pendingFormulaRef.current !== undefined) {
      if (formula === pendingFormulaRef.current) {
        pendingFormulaRef.current = undefined
      } else if (formula == null && pendingFormulaRef.current) {
        // Parent has not applied our commit yet; keep local hint.
        return
      }
    }
    if (!focused) setFormulaHint(formula)
  }, [formula, rememberFormula, focused])

  const parseOptions: ParseNumericOptions = {
    allowEmpty,
    emptyValue,
    min,
    max,
    integer,
  }

  // Keep showing the draft while invalid so blur does not wipe partial input.
  const display =
    focused || error
      ? draft
      : value == null || !Number.isFinite(value)
        ? ''
        : formatNumericDisplay(value)

  function resolveCommittedFormula(
    raw: string,
    next: number | null,
  ): string | null | undefined {
    if (!rememberFormula) return undefined
    if (isNumericFormulaInput(raw)) {
      return formulaSourceForDisplay(raw)
    }
    // After Enter evaluates `6+6` → draft `12`, a following blur must not clear
    // the remembered formula when the plain number still matches it.
    const existing = formulaHint
    if (existing && next != null && Number.isFinite(next)) {
      const existingResult = parseNumericInput(existing, parseOptions)
      if (
        existingResult.ok &&
        existingResult.value === next &&
        raw.trim() === formatNumericDisplay(next)
      ) {
        return existing
      }
    }
    return null
  }

  function commit(raw: string): boolean {
    const result = parseNumericInput(raw, parseOptions)
    if (!result.ok) {
      setError(result.error)
      updateDraft(raw)
      return false
    }
    setError(null)
    const next = result.value
    const nextFormula = resolveCommittedFormula(raw, next)
    if (rememberFormula) {
      setFormulaHint(nextFormula ?? null)
      pendingFormulaRef.current = nextFormula ?? null
    }
    updateDraft(next == null ? '' : formatNumericDisplay(next))
    const prev = value == null || !Number.isFinite(value) ? null : value
    const prevFormula = formula !== undefined ? (formula ?? null) : formulaHint
    const formulaChanged =
      rememberFormula && (nextFormula ?? null) !== (prevFormula ?? null)
    if (next !== prev || formulaChanged) {
      onChange(next, nextFormula)
    } else if (rememberFormula && nextFormula !== undefined) {
      // Keep pending marker aligned even when parent already has this state.
      pendingFormulaRef.current = undefined
    }
    return true
  }

  function handleFocus(event: FocusEvent<HTMLInputElement>): void {
    setFocused(true)
    setError(null)
    // Prefer the remembered formula so the user can see/edit `3+5` again.
    if (rememberFormula && formulaHint) {
      updateDraft(formulaHint)
    } else {
      const seed =
        value == null || !Number.isFinite(value)
          ? ''
          : formatNumericDisplay(value)
      updateDraft(seed)
    }
    onFocus?.(event)
    requestAnimationFrame(() => {
      inputRef.current?.select()
    })
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>): void {
    if (skipCommitRef.current) {
      skipCommitRef.current = false
      setFocused(false)
      onBlur?.(event)
      return
    }
    commit(draftRef.current)
    setFocused(false)
    onBlur?.(event)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      if (commit(draftRef.current)) {
        // Keep focus and show the resolved number (e.g. 2+4*4 → 18).
        requestAnimationFrame(() => {
          inputRef.current?.select()
        })
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setError(null)
      updateDraft(
        value == null || !Number.isFinite(value)
          ? ''
          : formatNumericDisplay(value),
      )
      skipCommitRef.current = true
      inputRef.current?.blur()
    }
    onKeyDown?.(event)
  }

  const invalid = Boolean(error)
  const wrapperWidth = /\bw-full\b/.test(className) ? ' w-full' : ''
  const showFormulaCaption =
    rememberFormula && Boolean(formulaHint) && !focused && !error
  const describedBy = [
    invalid ? errorId : null,
    showFormulaCaption ? formulaId : null,
  ]
    .filter(Boolean)
    .join(' ')

  const titleParts = [
    error ?? null,
    formulaHint && !error ? `Formula: ${formulaHint}` : null,
    typeof rest.title === 'string' ? rest.title : null,
  ].filter(Boolean)

  return (
    <span className={`inline-flex min-w-0 flex-col gap-0.5${wrapperWidth}`}>
      <input
        {...rest}
        ref={inputRef}
        id={inputId}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={display}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy || undefined}
        title={titleParts.length ? titleParts.join(' · ') : undefined}
        className={`${className}${invalid ? ' border-danger' : ''}`}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onChange={(event) => {
          updateDraft(event.target.value)
          if (error) setError(null)
        }}
      />
      {error ? (
        <span
          id={errorId}
          className={
            showError
              ? 'text-[10px] leading-tight text-danger'
              : 'truncate text-[9px] leading-tight text-danger'
          }
          title={error}
        >
          {error}
        </span>
      ) : null}
      {showFormulaCaption ? (
        <span
          id={formulaId}
          className="truncate font-mono text-[9px] leading-tight text-steel"
          title={formulaHint ?? undefined}
        >
          {formulaHint}
        </span>
      ) : null}
    </span>
  )
}
