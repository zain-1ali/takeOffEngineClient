import { useEffect, useState } from 'react'
import { GhostButton, PrimaryButton } from '../ui'
import { Modal } from './Modal'

export type StairFlightDraft = {
  kind: 'flight'
  id: string
  label: string
  run: number
  rise: number
  width: number
  stepCount: number
  waistThickness: number
  exposedSides: number
}

export type StairLandingDraft = {
  kind: 'landing'
  id: string
  label: string
  length: number
  width: number
  thickness: number
  exposedEdgeLm: number | ''
  stairBeamEnabled: boolean
  stairBeamSpan: number
  stairBeamWidth: number
  stairBeamDepth: number
}

export type StairSegmentDraft = StairFlightDraft | StairLandingDraft

function newId() {
  return `seg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function defaultFlight(i: number): StairFlightDraft {
  return {
    kind: 'flight',
    id: newId(),
    label: `Flight ${i}`,
    run: 4,
    rise: 3,
    width: 1.2,
    stepCount: 12,
    waistThickness: 0.15,
    exposedSides: 2,
  }
}

function defaultLanding(i: number): StairLandingDraft {
  return {
    kind: 'landing',
    id: newId(),
    label: `Landing ${i}`,
    length: 1.5,
    width: 1.2,
    thickness: 0.15,
    exposedEdgeLm: '',
    stairBeamEnabled: false,
    stairBeamSpan: 1.2,
    stairBeamWidth: 0.2,
    stairBeamDepth: 0.3,
  }
}

function parseSegments(raw: unknown, fallback: StairSegmentDraft[]): StairSegmentDraft[] {
  if (!Array.isArray(raw) || !raw.length) return fallback
  const out: StairSegmentDraft[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    if (o.kind === 'landing') {
      out.push({
        kind: 'landing',
        id: typeof o.id === 'string' ? o.id : newId(),
        label: String(o.label || `Landing ${out.length + 1}`),
        length: Number(o.length) || 1.5,
        width: Number(o.width) || 1.2,
        thickness: Number(o.thickness) || 0.15,
        exposedEdgeLm:
          o.exposedEdgeLm != null && o.exposedEdgeLm !== ''
            ? Number(o.exposedEdgeLm)
            : '',
        stairBeamEnabled: Boolean(
          o.stairBeam &&
            typeof o.stairBeam === 'object' &&
            (o.stairBeam as { width?: number }).width,
        ),
        stairBeamSpan: Number(
          (o.stairBeam as { spanLength?: number } | undefined)?.spanLength,
        ) || Number(o.length) || 1.2,
        stairBeamWidth: Number(
          (o.stairBeam as { width?: number } | undefined)?.width,
        ) || 0.2,
        stairBeamDepth: Number(
          (o.stairBeam as { depth?: number } | undefined)?.depth,
        ) || 0.3,
      })
    } else if (o.kind === 'flight' || o.run != null || o.rise != null) {
      out.push({
        kind: 'flight',
        id: typeof o.id === 'string' ? o.id : newId(),
        label: String(o.label || `Flight ${out.length + 1}`),
        run: Number(o.run) || 0,
        rise: Number(o.rise) || 3,
        width: Number(o.width) || 1.2,
        stepCount: Math.max(1, Math.floor(Number(o.stepCount) || 12)),
        waistThickness: Number(o.waistThickness) || 0.15,
        exposedSides:
          o.exposedSides != null ? Math.max(0, Number(o.exposedSides)) : 2,
      })
    }
  }
  return out.length ? out : fallback
}

const inputCls =
  'w-full border border-steel-border bg-panel-hover px-2 py-1 text-xs font-mono text-ink outline-none'

/**
 * Multi-flight / landing editor (Assumption 1).
 * Riser/side lm formulas flagged as Assumption 2 in the note below.
 */
export function StairSegmentsModal({
  open,
  onClose,
  onConfirm,
  segments,
  legacy,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (segments: Record<string, unknown>[]) => void
  segments?: unknown
  /** Seed from flat schedule fields when no segments yet. */
  legacy?: {
    run?: number
    rise?: number
    width?: number
    stepCount?: number
    waistThickness?: number
    exposedSides?: number
  }
}) {
  const seed: StairSegmentDraft[] = [
    {
      ...defaultFlight(1),
      run: legacy?.run ?? 4,
      rise: legacy?.rise ?? 3,
      width: legacy?.width ?? 1.2,
      stepCount: legacy?.stepCount ?? 12,
      waistThickness: legacy?.waistThickness ?? 0.15,
      exposedSides: legacy?.exposedSides ?? 2,
    },
  ]
  const [rows, setRows] = useState<StairSegmentDraft[]>(seed)

  useEffect(() => {
    if (!open) return
    setRows(parseSegments(segments, seed))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function update(id: string, patch: Partial<StairSegmentDraft>) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? ({ ...r, ...patch } as StairSegmentDraft) : r)),
    )
  }

  function toPersisted(): Record<string, unknown>[] {
    return rows.map((r) => {
      if (r.kind === 'flight') {
        return {
          kind: 'flight',
          id: r.id,
          label: r.label,
          run: r.run,
          rise: r.rise,
          width: r.width,
          stepCount: r.stepCount,
          waistThickness: r.waistThickness,
          exposedSides: r.exposedSides,
        }
      }
      const landing: Record<string, unknown> = {
        kind: 'landing',
        id: r.id,
        label: r.label,
        length: r.length,
        width: r.width,
        thickness: r.thickness,
      }
      if (r.exposedEdgeLm !== '' && Number.isFinite(Number(r.exposedEdgeLm))) {
        landing.exposedEdgeLm = Number(r.exposedEdgeLm)
      }
      if (r.stairBeamEnabled) {
        landing.stairBeam = {
          count: 1,
          spanLength: r.stairBeamSpan,
          width: r.stairBeamWidth,
          depth: r.stairBeamDepth,
        }
      }
      return landing
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Stair segments" size="xl">
      <p className="text-[11px] text-steel mb-2 leading-relaxed">
        Ordered Flight / Landing segments (Assumption 1 — pending client
        confirmation). A single flight alone is valid.
      </p>
      <p className="text-[11px] text-signal mb-3 leading-relaxed">
        Formwork riser/side (lm) = steps×width and sloping length×exposed sides
        (Assumption 2 — indicative, verify before procurement).
      </p>

      <div className="space-y-3 max-h-[55vh] overflow-auto">
        {rows.map((row, idx) => (
          <div
            key={row.id}
            className="border border-steel-border p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <input
                className={`${inputCls} max-w-[12rem]`}
                value={row.label}
                onChange={(e) => update(row.id, { label: e.target.value })}
              />
              <span className="text-[10px] uppercase text-steel">
                {row.kind}
              </span>
              <button
                type="button"
                className="text-danger text-sm"
                disabled={rows.length <= 1}
                onClick={() =>
                  setRows((prev) => prev.filter((r) => r.id !== row.id))
                }
              >
                Remove
              </button>
            </div>
            {row.kind === 'flight' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(
                  [
                    ['run', 'Run (m)'],
                    ['rise', 'Rise (m)'],
                    ['width', 'Width (m)'],
                    ['stepCount', 'Steps'],
                    ['waistThickness', 'Waist T (m)'],
                    ['exposedSides', 'Exposed sides'],
                  ] as const
                ).map(([key, lab]) => (
                  <label key={key} className="text-[10px] text-steel">
                    {lab}
                    <input
                      type="number"
                      className={`${inputCls} mt-0.5`}
                      value={row[key]}
                      onChange={(e) =>
                        update(row.id, {
                          [key]: parseFloat(e.target.value) || 0,
                        } as Partial<StairFlightDraft>)
                      }
                    />
                  </label>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(
                  [
                    ['length', 'Length (m)'],
                    ['width', 'Width (m)'],
                    ['thickness', 'Thickness (m)'],
                  ] as const
                ).map(([key, lab]) => (
                  <label key={key} className="text-[10px] text-steel">
                    {lab}
                    <input
                      type="number"
                      className={`${inputCls} mt-0.5`}
                      value={row[key]}
                      onChange={(e) =>
                        update(row.id, {
                          [key]: parseFloat(e.target.value) || 0,
                        } as Partial<StairLandingDraft>)
                      }
                    />
                  </label>
                ))}
                <label className="text-[10px] text-steel">
                  Edge lm (blank = 2×(L+W))
                  <input
                    type="number"
                    className={`${inputCls} mt-0.5`}
                    value={row.exposedEdgeLm}
                    placeholder="auto"
                    onChange={(e) =>
                      update(row.id, {
                        exposedEdgeLm:
                          e.target.value === ''
                            ? ''
                            : parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </label>
                <label className="text-[10px] text-steel flex items-center gap-2 col-span-2">
                  <input
                    type="checkbox"
                    checked={row.stairBeamEnabled}
                    onChange={(e) =>
                      update(row.id, { stairBeamEnabled: e.target.checked })
                    }
                  />
                  Stair beam (Beams engine)
                </label>
                {row.stairBeamEnabled && (
                  <>
                    {(
                      [
                        ['stairBeamSpan', 'Beam span (m)'],
                        ['stairBeamWidth', 'Beam W (m)'],
                        ['stairBeamDepth', 'Beam D (m)'],
                      ] as const
                    ).map(([key, lab]) => (
                      <label key={key} className="text-[10px] text-steel">
                        {lab}
                        <input
                          type="number"
                          className={`${inputCls} mt-0.5`}
                          value={row[key]}
                          onChange={(e) =>
                            update(row.id, {
                              [key]: parseFloat(e.target.value) || 0,
                            } as Partial<StairLandingDraft>)
                          }
                        />
                      </label>
                    ))}
                  </>
                )}
              </div>
            )}
            <p className="text-[9px] text-steel">Segment {idx + 1}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 justify-between">
        <div className="flex gap-2">
          <GhostButton
            className="!text-xs !py-1.5 !px-3"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                defaultFlight(prev.filter((r) => r.kind === 'flight').length + 1),
              ])
            }
          >
            + Flight
          </GhostButton>
          <GhostButton
            className="!text-xs !py-1.5 !px-3"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                defaultLanding(
                  prev.filter((r) => r.kind === 'landing').length + 1,
                ),
              ])
            }
          >
            + Landing
          </GhostButton>
        </div>
        <div className="flex gap-2">
          <GhostButton className="!text-xs !py-1.5 !px-3" onClick={onClose}>
            Cancel
          </GhostButton>
          <PrimaryButton
            className="!text-xs !py-1.5 !px-3"
            onClick={() => {
              onConfirm(toPersisted())
              onClose()
            }}
          >
            Confirm segments
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  )
}
