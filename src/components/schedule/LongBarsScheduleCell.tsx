import { useState } from 'react'
import { GhostButton, NumericInput } from '../ui'
import {
  DiaSelect,
  RebarGroupsEditorShell,
} from './RebarGroupsEditorShell'

export type BarGroup = {
  diameterMm: number
  barCount: number
}

export function formatBarGroupsSummary(groups: BarGroup[]): string {
  const cleaned = groups.filter((g) => g.barCount > 0 && g.diameterMm > 0)
  if (cleaned.length === 0) return '—'
  return cleaned.map((g) => `${g.barCount}×H${g.diameterMm}`).join(' + ')
}

export function cleanBarGroups(groups: BarGroup[]): BarGroup[] {
  return groups
    .map((g) => ({
      diameterMm: Number(g.diameterMm) || 0,
      barCount: Number(g.barCount) || 0,
    }))
    .filter((g) => g.diameterMm > 0 && g.barCount > 0)
}

/** Legacy scalar mirrors for older instances / 3D fallback. */
export function syncLegacyBarGroups(
  groups: BarGroup[],
  keys: { arrayKey: string; countKey: string; diaKey: string; fallbackDia?: number },
): Record<string, unknown> {
  const cleaned = cleanBarGroups(groups)
  return {
    [keys.arrayKey]: cleaned,
    [keys.countKey]: cleaned.reduce((s, g) => s + g.barCount, 0),
    [keys.diaKey]: cleaned[0]?.diameterMm ?? keys.fallbackDia ?? 16,
  }
}

export const BAR_GROUP_LEGACY: Record<
  string,
  { arrayKey: string; countKey: string; diaKey: string; fallbackDia: number; title: string }
> = {
  longBars: {
    arrayKey: 'longBars',
    countKey: 'longBarCount',
    diaKey: 'longBarDia',
    fallbackDia: 16,
    title: 'Longitudinal bars',
  },
  topBars: {
    arrayKey: 'topBars',
    countKey: 'topBarCount',
    diaKey: 'topBarDia',
    fallbackDia: 16,
    title: 'Top bars',
  },
  bottomBars: {
    arrayKey: 'bottomBars',
    countKey: 'bottomBarCount',
    diaKey: 'bottomBarDia',
    fallbackDia: 20,
    title: 'Bottom bars',
  },
}

function seedBarGroups(
  value: BarGroup[],
  defaultDia: number,
  defaultCount: number,
): BarGroup[] {
  if (value.length > 0) return value.map((g) => ({ ...g }))
  return [{ diameterMm: defaultDia, barCount: defaultCount }]
}

export function BarGroupsScheduleCell({
  title,
  value,
  onChange,
  defaultDia = 16,
  defaultCount = 2,
  hint,
}: {
  title: string
  value: BarGroup[]
  onChange: (groups: BarGroup[]) => void
  defaultDia?: number
  defaultCount?: number
  hint?: string
}) {
  const [draft, setDraft] = useState<BarGroup[]>(() =>
    seedBarGroups(value, defaultDia, defaultCount),
  )
  const [error, setError] = useState('')

  const cleaned = cleanBarGroups(draft)
  const canApply = cleaned.length > 0

  return (
    <RebarGroupsEditorShell
      title={title}
      summary={formatBarGroupsSummary(value)}
      hint={
        hint ||
        'One row per diameter (e.g. 2×H16 + 2×H12). Links/ties stay separate in the schedule. Press Enter to apply.'
      }
      canApply={canApply}
      applyError={error}
      onOpen={() => {
        setDraft(seedBarGroups(value, defaultDia, defaultCount))
        setError('')
      }}
      onApply={() => {
        if (!canApply) {
          setError('Add at least one row with count ≥ 1 and a diameter.')
          return false
        }
        setError('')
        onChange(cleaned)
      }}
    >
      <div className="grid grid-cols-[4rem_auto_1fr] gap-x-2 gap-y-1 items-center text-[10px] uppercase tracking-wide text-steel">
        <span>Count</span>
        <span>Dia</span>
        <span />
      </div>
      {draft.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <NumericInput
            min={1}
            max={60}
            integer
            emptyValue={0}
            showError={false}
            className="w-16 border border-steel-border bg-bg px-1.5 py-1 text-xs font-mono text-ink"
            value={row.barCount}
            aria-label={`Bar count ${i + 1}`}
            onChange={(n) => {
              const next = [...draft]
              next[i] = { ...row, barCount: n ?? 0 }
              setDraft(next)
              setError('')
            }}
          />
          <DiaSelect
            value={row.diameterMm}
            onChange={(dia) => {
              const next = [...draft]
              next[i] = { ...row, diameterMm: dia }
              setDraft(next)
              setError('')
            }}
          />
          <GhostButton
            type="button"
            className="!text-xs !py-1"
            disabled={draft.length <= 1}
            onClick={() => {
              setDraft(draft.filter((_, j) => j !== i))
              setError('')
            }}
          >
            Remove
          </GhostButton>
        </div>
      ))}
      <GhostButton
        type="button"
        className="!text-xs mt-1"
        onClick={() => {
          setDraft([...draft, { diameterMm: 12, barCount: defaultCount }])
          setError('')
        }}
      >
        + Add diameter
      </GhostButton>
    </RebarGroupsEditorShell>
  )
}

export type LongBarGroup = BarGroup
export const formatLongBarsSummary = formatBarGroupsSummary

export function syncLegacyLongBars(groups: BarGroup[]) {
  return syncLegacyBarGroups(groups, {
    arrayKey: 'longBars',
    countKey: 'longBarCount',
    diaKey: 'longBarDia',
    fallbackDia: 16,
  }) as {
    longBars: BarGroup[]
    longBarCount: number
    longBarDia: number
  }
}

export function LongBarsScheduleCell(props: {
  value: BarGroup[]
  onChange: (groups: BarGroup[]) => void
}) {
  return (
    <BarGroupsScheduleCell
      title="Longitudinal bars"
      value={props.value}
      onChange={props.onChange}
      defaultDia={16}
      defaultCount={8}
    />
  )
}
