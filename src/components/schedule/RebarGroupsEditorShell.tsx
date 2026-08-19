import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { BAR_SIZES } from '../../constants/elementSchemas'
import { GhostButton, PrimaryButton } from '../ui'
import { Modal } from '../modals/Modal'

const cellBtnCls =
  'group w-full min-w-[7.5rem] max-w-[14rem] border border-steel-border bg-panel px-1.5 py-1 text-left text-xs font-mono text-ink hover:border-steel focus:outline-none focus:border-signal'

/** Shared schedule trigger + modal chrome for count- or spacing-based bar groups. */
export function RebarGroupsEditorShell({
  title,
  summary,
  hint,
  children,
  canApply,
  onApply,
  onOpen,
  applyError,
}: {
  title: string
  summary: string
  hint: string
  children: ReactNode
  canApply: boolean
  onApply: () => boolean | void
  /** Called when the editor opens so the parent can reset draft from value. */
  onOpen?: () => void
  applyError?: string
}) {
  const [open, setOpen] = useState(false)
  const formId = useId()

  function openEditor() {
    onOpen?.()
    setOpen(true)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canApply) return
    const ok = onApply()
    if (ok === false) return
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className={cellBtnCls}
        onClick={openEditor}
        title={`${title}: ${summary}`}
      >
        <span className="block truncate">{summary}</span>
        <span className="mt-0.5 block text-[9px] font-sans uppercase tracking-wide text-steel opacity-0 group-hover:opacity-100">
          Edit
        </span>
      </button>
      <Modal open={open} title={title} onClose={() => setOpen(false)} size="md">
        <form id={formId} onSubmit={handleSubmit}>
          <p className="text-xs text-steel mb-3 leading-relaxed">{hint}</p>
          <div className="space-y-2 mb-3">{children}</div>
          {applyError ? (
            <p className="text-xs text-danger mb-3" role="alert">
              {applyError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 justify-end border-t border-steel-border pt-3">
            <GhostButton type="button" onClick={() => setOpen(false)}>
              Cancel
            </GhostButton>
            <PrimaryButton type="submit" disabled={!canApply}>
              Apply
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  )
}

export function DiaSelect({
  value,
  onChange,
}: {
  value: number
  onChange: (dia: number) => void
}) {
  return (
    <select
      className="border border-steel-border bg-bg px-1.5 py-1 text-xs font-mono text-ink"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label="Bar diameter"
    >
      {BAR_SIZES.map((d) => (
        <option key={d} value={d}>
          H{d}
        </option>
      ))}
    </select>
  )
}

export function RebarInactiveCell({ reason }: { reason: string }) {
  return (
    <span
      className="inline-block min-w-[4rem] text-xs font-mono text-steel/60"
      title={reason}
    >
      —
    </span>
  )
}
