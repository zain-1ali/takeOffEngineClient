type RibbonStatus = 'verified' | 'unpriced' | (string & {})

function resolveRibbon(status: RibbonStatus): { text: string; tone: 'verified' | 'neutral' } {
  if (status === 'verified') return { text: '✓ verified', tone: 'verified' }
  if (status === 'unpriced') return { text: 'unpriced', tone: 'neutral' }
  return { text: String(status), tone: 'neutral' }
}

export function VerifiedRibbon({
  status = 'verified',
  className = '',
}: {
  status?: RibbonStatus
  className?: string
}) {
  const { text, tone } = resolveRibbon(status)
  const toneClass =
    tone === 'verified'
      ? 'text-verified bg-verified-bg border-verified'
      : 'text-steel bg-transparent border-steel-border'

  return (
    <span
      className={`inline-flex items-center font-mono text-[9.5px] font-medium tracking-wide whitespace-nowrap rounded-sm border px-1.5 py-0.5 ${toneClass} ${className}`}
    >
      {text}
    </span>
  )
}
