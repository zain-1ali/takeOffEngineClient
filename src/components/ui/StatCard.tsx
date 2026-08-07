import type { ReactNode } from 'react'

type Accent = 'signal' | 'verified' | 'default'

const valueAccent: Record<Accent, string> = {
  default: 'text-ink',
  signal: 'text-signal-text',
  verified: 'text-verified',
}

export function StatCard({
  label,
  value,
  unit,
  accent = 'default',
  className = '',
}: {
  label: string
  value: ReactNode
  unit?: string
  accent?: Accent
  className?: string
}) {
  return (
    <div className={`bg-panel border border-steel-border px-[18px] py-4 ${className}`}>
      <div className="text-[11px] uppercase tracking-[0.08em] text-steel mb-2 font-medium">
        {label}
      </div>
      <div className={`font-mono text-[22px] font-medium tabular-nums ${valueAccent[accent]}`}>
        {value}
        {unit != null && unit !== '' && (
          <small className="text-[13px] text-steel font-normal ml-1">{unit}</small>
        )}
      </div>
    </div>
  )
}
