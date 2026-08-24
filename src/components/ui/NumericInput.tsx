import {
  useId,
  useRef,
  useState,
  type FocusEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from 'react'
import {
  formatNumericDisplay,
  parseNumericInput,
  type ParseNumericOptions,
} from '../../lib/parseNumericInput'

export type NumericInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'inputMode' | 'defaultValue'
> &
  ParseNumericOptions & {
    value: number | null | undefined
    onChange: (value: number | null) => void
    /** When false, errors only appear via aria/title (compact table cells). Default true. */
    showError?: boolean
  }

/**
 * Number field that keeps the raw typing string while focused, commits on blur/Enter,
 * supports `=` formulas via expr-eval, and never silently coerces junk to 0.
 */
export function NumericInput({
  value,
  onChange,
  allowEmpty = false,
  emptyValue,
  min,
  max,
  integer = false,
  showError = true,
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
  const inputRef = useRef<HTMLInputElement>(null)
  const skipCommitRef = useRef(false)

  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

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

  function commit(raw: string): boolean {
    const result = parseNumericInput(raw, parseOptions)
    if (!result.ok) {
      setError(result.error)
      setDraft(raw)
      return false
    }
    setError(null)
    const next = result.value
    setDraft(next == null ? '' : formatNumericDisplay(next))
    const prev = value == null || !Number.isFinite(value) ? null : value
    if (next !== prev) {
      onChange(next)
    }
    return true
  }

  function handleFocus(event: FocusEvent<HTMLInputElement>): void {
    setFocused(true)
    setError(null)
    const seed =
      value == null || !Number.isFinite(value)
        ? ''
        : formatNumericDisplay(value)
    setDraft(seed)
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
    commit(draft)
    setFocused(false)
    onBlur?.(event)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (commit(draft)) {
        inputRef.current?.blur()
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setError(null)
      setDraft(
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

  return (
    <span className={`inline-flex min-w-0 flex-col gap-0.5${wrapperWidth}`}>
      <input
        {...rest}
        ref={inputRef}
        id={inputId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={display}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid && showError ? errorId : undefined}
        title={error ?? rest.title}
        className={`${className}${invalid ? ' border-danger' : ''}`}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onChange={(event) => {
          setDraft(event.target.value)
          if (error) setError(null)
        }}
      />
      {showError && error ? (
        <span id={errorId} className="text-[10px] leading-tight text-danger">
          {error}
        </span>
      ) : null}
    </span>
  )
}
