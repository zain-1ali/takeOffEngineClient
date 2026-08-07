type ChipTone = 'default' | 'active' | 'dim'

const toneClass: Record<ChipTone, string> = {
  default: 'text-steel border-steel-border',
  active: 'text-signal-text border-signal',
  dim: 'text-steel/45 border-gridline',
}

export function ElementChip({
  number,
  tone = 'default',
  className = '',
}: {
  number: string | number
  tone?: ChipTone
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center justify-center min-w-5 px-1.5 py-px rounded-[3px] border font-mono text-[10.5px] leading-tight tabular-nums ${toneClass[tone]} ${className}`}
    >
      {number}
    </span>
  )
}
