import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
  size = 'md',
  closeOnEscape = true,
  /** Stack above another open modal (e.g. Duplicate inside Floors). */
  layer = 0,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  /** Prefer `size` over `wide`. `wide` maps to `lg` for older call sites. */
  size?: 'md' | 'lg' | 'xl' | 'full'
  closeOnEscape?: boolean
  layer?: number
}) {
  const resolvedSize = wide && size === 'md' ? 'lg' : size
  const widthCls =
    resolvedSize === 'full'
      ? 'w-[min(96vw,1400px)]'
      : resolvedSize === 'xl'
        ? 'w-full max-w-4xl'
        : resolvedSize === 'lg'
          ? 'w-full max-w-2xl'
          : 'w-full max-w-lg'
  const zCls = layer > 0 ? 'z-[60]' : 'z-50'

  useEffect(() => {
    if (!open || !closeOnEscape) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, closeOnEscape])

  if (!open) return null

  return createPortal(
    <div
      className={`fixed inset-0 ${zCls} flex items-center justify-center p-4 bg-bg/75`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`border border-steel-border bg-panel shadow-xl max-h-[90vh] overflow-auto ${widthCls}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-steel-border">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-steel hover:text-ink text-lg leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block text-sm">
      <span className="text-steel text-xs">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

export const inputClass =
  'w-full border border-steel-border bg-panel-hover px-3 py-1.5 text-sm text-ink outline-none'
