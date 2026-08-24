import { useState } from 'react'
import { GhostButton, NumericInput } from '../ui'
import {
  DiaSelect,
  RebarGroupsEditorShell,
} from './RebarGroupsEditorShell'

export type MeshBarGroup = {
  diameterMm: number
  spacingMm: number
}

export function formatMeshGroupsSummary(groups: MeshBarGroup[]): string {
  const cleaned = groups.filter((g) => g.diameterMm > 0 && g.spacingMm > 0)
  if (cleaned.length === 0) return '—'
  return cleaned.map((g) => `H${g.diameterMm}@${g.spacingMm}`).join(' + ')
}

export function cleanMeshGroups(groups: MeshBarGroup[]): MeshBarGroup[] {
  return groups
    .map((g) => ({
      diameterMm: Number(g.diameterMm) || 0,
      spacingMm: Number(g.spacingMm) || 0,
    }))
    .filter((g) => g.diameterMm > 0 && g.spacingMm > 0)
}

export function syncLegacyMeshGroups(
  groups: MeshBarGroup[],
  keys: {
    arrayKey: string
    diaKey: string
    spcKey: string
    fallbackDia?: number
    fallbackSpc?: number
  },
): Record<string, unknown> {
  const cleaned = cleanMeshGroups(groups)
  return {
    [keys.arrayKey]: cleaned,
    [keys.diaKey]: cleaned[0]?.diameterMm ?? keys.fallbackDia ?? 16,
    [keys.spcKey]: cleaned[0]?.spacingMm ?? keys.fallbackSpc ?? 150,
  }
}

export const MESH_GROUP_LEGACY: Record<
  string,
  {
    arrayKey: string
    diaKey: string
    spcKey: string
    fallbackDia: number
    fallbackSpc: number
    title: string
  }
> = {
  bottomMainBars: {
    arrayKey: 'bottomMainBars',
    diaKey: 'bottomMainDia',
    spcKey: 'bottomMainSpacing',
    fallbackDia: 16,
    fallbackSpc: 150,
    title: 'Bottom main',
  },
  bottomDistBars: {
    arrayKey: 'bottomDistBars',
    diaKey: 'bottomDistDia',
    spcKey: 'bottomDistSpacing',
    fallbackDia: 16,
    fallbackSpc: 150,
    title: 'Bottom distribution',
  },
  topMainBars: {
    arrayKey: 'topMainBars',
    diaKey: 'topMainDia',
    spcKey: 'topMainSpacing',
    fallbackDia: 16,
    fallbackSpc: 150,
    title: 'Top main',
  },
  topDistBars: {
    arrayKey: 'topDistBars',
    diaKey: 'topDistDia',
    spcKey: 'topDistSpacing',
    fallbackDia: 16,
    fallbackSpc: 150,
    title: 'Top distribution',
  },
  mainBars: {
    arrayKey: 'mainBars',
    diaKey: 'mainDia',
    spcKey: 'mainSpacing',
    fallbackDia: 12,
    fallbackSpc: 150,
    title: 'Transverse (main)',
  },
  distBars: {
    arrayKey: 'distBars',
    diaKey: 'distDia',
    spcKey: 'distSpacing',
    fallbackDia: 12,
    fallbackSpc: 250,
    title: 'Longitudinal (dist.)',
  },
  vertBars: {
    arrayKey: 'vertBars',
    diaKey: 'vertDia',
    spcKey: 'vertSpacing',
    fallbackDia: 12,
    fallbackSpc: 200,
    title: 'Vertical bars',
  },
  horizBars: {
    arrayKey: 'horizBars',
    diaKey: 'horizDia',
    spcKey: 'horizSpacing',
    fallbackDia: 12,
    fallbackSpc: 250,
    title: 'Horizontal bars',
  },
}

function seedMeshGroups(
  value: MeshBarGroup[],
  defaultDia: number,
  defaultSpc: number,
): MeshBarGroup[] {
  if (value.length > 0) return value.map((g) => ({ ...g }))
  return [{ diameterMm: defaultDia, spacingMm: defaultSpc }]
}

export function MeshBarsScheduleCell({
  title,
  value,
  onChange,
  defaultDia = 16,
  defaultSpc = 150,
  hint,
}: {
  title: string
  value: MeshBarGroup[]
  onChange: (groups: MeshBarGroup[]) => void
  defaultDia?: number
  defaultSpc?: number
  hint?: string
}) {
  const [draft, setDraft] = useState<MeshBarGroup[]>(() =>
    seedMeshGroups(value, defaultDia, defaultSpc),
  )
  const [error, setError] = useState('')

  const cleaned = cleanMeshGroups(draft)
  const canApply = cleaned.length > 0

  return (
    <RebarGroupsEditorShell
      title={title}
      summary={formatMeshGroupsSummary(value)}
      hint={
        hint ||
        'One row per diameter/spacing in this direction (e.g. H16@150 + H12@200). Bar count = floor(span/spacing)+1. Press Enter to apply.'
      }
      canApply={canApply}
      applyError={error}
      onOpen={() => {
        setDraft(seedMeshGroups(value, defaultDia, defaultSpc))
        setError('')
      }}
      onApply={() => {
        if (!canApply) {
          setError('Add at least one row with spacing > 0 and a diameter.')
          return false
        }
        setError('')
        onChange(cleaned)
      }}
    >
      <div className="grid grid-cols-[auto_5rem_1fr] gap-x-2 gap-y-1 items-center text-[10px] uppercase tracking-wide text-steel">
        <span>Dia</span>
        <span>Spc (mm)</span>
        <span />
      </div>
      {draft.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <DiaSelect
            value={row.diameterMm}
            onChange={(dia) => {
              const next = [...draft]
              next[i] = { ...row, diameterMm: dia }
              setDraft(next)
              setError('')
            }}
          />
          <NumericInput
            min={50}
            max={500}
            emptyValue={0}
            showError={false}
            className="w-20 border border-steel-border bg-bg px-1.5 py-1 text-xs font-mono text-ink"
            value={row.spacingMm}
            aria-label={`Spacing mm ${i + 1}`}
            onChange={(n) => {
              const next = [...draft]
              next[i] = { ...row, spacingMm: n ?? 0 }
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
          setDraft([...draft, { diameterMm: 12, spacingMm: defaultSpc }])
          setError('')
        }}
      >
        + Add diameter
      </GhostButton>
    </RebarGroupsEditorShell>
  )
}
