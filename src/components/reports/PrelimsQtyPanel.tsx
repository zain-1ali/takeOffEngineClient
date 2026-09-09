import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  applyPrelimsQty,
  type ApplyPrelimsQtyResult,
  type PrelimQtyLine,
} from '../../api/projectsApi'
import { ApiError } from '../../lib/api'
import { formatMoney } from '../../lib/units'
import type { Project } from '../../types/api'
import { GhostButton, PrimaryButton } from '../ui'

const SKIP_LABEL: Record<string, string> = {
  NOT_MODULE_0: 'Not Module 0',
  NOT_PROJECT_SCOPE: 'Not project-wide',
  TAKEOFF: 'Linked takeoff — skipped',
  NOT_ACTIVE: 'Needs review / orphaned',
  UNIT_UNSUPPORTED: 'Unit not auto-filled (item, nr, mth, …)',
  FORMULA_AMBIGUOUS: 'Formula needs a typed qty',
  FORMULA_CONDITIONAL: 'Conditional formula',
  MISSING_PROGRAMME_WEEKS: 'Set programme weeks in Project',
  MISSING_GFA: 'Set GFA in Project',
  MISSING_CONTRACT_VALUE: 'Set contract-value base in Project',
  RATE_INVALID: 'Pack % rate is not a decimal fraction (e.g. 0.05)',
  PERCENT_RATE_MISMATCH: 'Formula % does not match pack rate',
  SITE_AREA_NOT_GFA: 'Measured area — not GFA',
}

export function PrelimsQtyPanel({
  project,
}: {
  project: Project
}) {
  const qc = useQueryClient()
  const [preview, setPreview] = useState<ApplyPrelimsQtyResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(dryRun: boolean, itemIds?: string[]) {
    setBusy(true)
    setError(null)
    try {
      const result = await applyPrelimsQty(project.id, { dryRun, itemIds })
      setPreview(result)
      if (!dryRun) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['reports', project.id] }),
          qc.invalidateQueries({ queryKey: ['selected-boq', project.id] }),
        ])
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not preview prelim formulas',
      )
    } finally {
      setBusy(false)
    }
  }

  const eligible = preview?.lines.filter((l) => l.eligible) || []
  const skipped = preview?.lines.filter((l) => !l.eligible) || []

  return (
    <div className="border border-steel-border bg-bg px-3 py-2 space-y-2 mb-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-ink font-medium">Module 0 formula helpers</p>
        <span className="text-[11px] text-steel">
          Programme {project.programmeWeeks ?? '—'} wk · GFA{' '}
          {project.gfaM2 ?? '—'} m² · Contract base{' '}
          {project.contractValue != null
            ? formatMoney(project.contractValue, project.currency)
            : '—'}
        </span>
        <GhostButton
          className="!text-[11px] !py-1 !px-2 ml-auto"
          disabled={busy}
          onClick={() => {
            void run(true)
          }}
        >
          {busy ? 'Working…' : 'Preview eligible formulas'}
        </GhostButton>
      </div>
      <p className="text-[11px] text-steel">
        Apply does not run when you edit Project fields. Weeks, GFA, and % of
        contract-value base only — typed qty stays until you confirm.
      </p>
      {error && <p className="text-xs text-danger">{error}</p>}
      {preview && (
        <div className="space-y-2">
          <p className="text-[11px] text-steel">
            {eligible.length} eligible · {skipped.length} skipped
          </p>
          {eligible.length > 0 && (
            <div className="max-h-48 overflow-auto text-[11px]">
              {eligible.map((line) => (
                <PrelimRow
                  key={line.id}
                  line={line}
                  currency={project.currency}
                  busy={busy}
                  onApply={() => {
                    void run(false, [line.id])
                  }}
                />
              ))}
            </div>
          )}
          {skipped.length > 0 && (
            <details className="text-[11px] text-steel">
              <summary className="cursor-pointer">
                Skipped lines ({skipped.length})
              </summary>
              <ul className="mt-1 space-y-0.5">
                {skipped.slice(0, 20).map((line) => (
                  <li key={line.id}>
                    {line.catalogueRef}: {SKIP_LABEL[line.skipReason || ''] || line.skipReason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {eligible.length > 0 && (
            <PrimaryButton
              className="!text-[11px] !py-1.5 !px-3"
              disabled={busy}
              onClick={() => {
                void run(false, eligible.map((l) => l.id))
              }}
            >
              Apply {eligible.length} eligible
            </PrimaryButton>
          )}
        </div>
      )}
    </div>
  )
}

function PrelimRow({
  line,
  currency,
  busy,
  onApply,
}: {
  line: PrelimQtyLine
  currency: string
  busy: boolean
  onApply: () => void
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-2 py-0.5 border-b border-steel-border/60">
      <span className="font-mono w-10">{line.catalogueRef}</span>
      <span className="truncate flex-1 min-w-[8rem]">{line.description}</span>
      <span className="text-steel">
        {line.currentQty} → {line.proposedQty} {line.unit}
      </span>
      <span className="text-steel">
        {formatMoney(line.proposedAmount, currency)}
      </span>
      <button
        type="button"
        className="text-ink underline disabled:opacity-40"
        disabled={busy}
        onClick={onApply}
      >
        Apply
      </button>
    </div>
  )
}
