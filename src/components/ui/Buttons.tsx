import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 font-sans text-[13px] font-medium px-[18px] py-2.5 transition-colors disabled:opacity-50 disabled:pointer-events-none'

export function PrimaryButton({ children, className = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`${base} bg-signal text-bg hover:brightness-110 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function GhostButton({ children, className = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`${base} bg-transparent text-ink border border-steel-border hover:border-steel ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
