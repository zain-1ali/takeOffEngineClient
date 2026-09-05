import type { ReactNode } from 'react'
import { isFormula, evalNumber } from '../../../lib/boqTakeoff/measurement'

export function NumInput({
  value,
  onChange,
  onEnter,
  placeholder,
  width = 'w-16',
}: {
  value: string | number | undefined
  onChange: (v: string) => void
  onEnter?: () => void
  placeholder?: string
  width?: string
}) {
  const formula = isFormula(value)
  return (
    <input
      type="text"
      inputMode="text"
      value={value ?? ''}
      placeholder={placeholder}
      title={
        formula
          ? `= ${evalNumber(value, 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}`
          : undefined
      }
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onEnter?.()
        }
      }}
      className={`${width} rounded border bg-transparent px-2 py-1 text-right tabular-nums text-ink placeholder:text-steel/50 hover:border-steel-border focus:border-signal focus:bg-bg focus:outline-none ${
        formula ? 'border-chalk/50 text-chalk' : 'border-transparent'
      }`}
    />
  )
}

export function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded p-1 text-steel hover:bg-panel-hover hover:text-ink"
    >
      {children}
    </button>
  )
}

export function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function LinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function DupIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M5 15V5a2 2 0 012-2h10" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0v12a1 1 0 001 1h6a1 1 0 001-1V7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function fmtNum(n: number, dp = 2) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })
}
