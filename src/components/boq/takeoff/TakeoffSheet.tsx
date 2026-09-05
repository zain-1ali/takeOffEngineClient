import { useEffect, useMemo, useState } from 'react'
import {
  PRIMS,
  PRIM_LABEL,
  PRIM_UNIT,
  SHAPE_KEYS,
  SHAPES,
  autoPrim,
  decimalsForPrim,
  emptyLine,
  itemQuantity,
  lineOutputs,
  newTakeoffLineId,
  numOr,
  setTotals,
  starterLines,
  type TakeoffLine,
  type TakeoffPrim,
} from '../../../lib/boqTakeoff/measurement'
import type { BoqTakeoffLinkTarget, BoqTakeoffSharedBy } from '../../../types/selectedBoq'
import { GhostButton, PrimaryButton } from '../../ui'
import { DupIcon, IconBtn, LinkIcon, NumInput, PlusIcon, TrashIcon, fmtNum } from './TakeoffBits'

export function TakeoffSheet({
  open,
  onClose,
  itemRef,
  description,
  unit,
  elementKey,
  initialLines,
  initialWaste = 0,
  measurementSetId,
  sharedBy,
  linkTargets,
  onApply,
  onOpenSchedule,
}: {
  open: boolean
  onClose: () => void
  itemRef: string
  description: string
  unit: string
  elementKey?: string
  initialLines: TakeoffLine[]
  initialWaste?: number
  measurementSetId: string | null
  sharedBy: BoqTakeoffSharedBy[]
  linkTargets: BoqTakeoffLinkTarget[]
  onApply: (payload: {
    wastePct: number
    lines: TakeoffLine[]
    measurementSetId: string | null
  }) => void
  onOpenSchedule?: () => void
}) {
  const prim = autoPrim(unit)
  const [wastePct, setWastePct] = useState(String(initialWaste ?? 0))
  const [lines, setLines] = useState<TakeoffLine[]>([])
  const [activeSetId, setActiveSetId] = useState<string | null>(measurementSetId)
  const [showLink, setShowLink] = useState(false)

  useEffect(() => {
    if (!open) return
    setWastePct(String(initialWaste ?? 0))
    setActiveSetId(measurementSetId)
    setShowLink(false)
    const seeded =
      initialLines.length > 0
        ? initialLines.map((l) => ({ ...l, dims: { ...(l.dims || {}) } }))
        : starterLines(elementKey)
    setLines(seeded)
  }, [open, itemRef, initialWaste, measurementSetId, initialLines, elementKey])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const isLinked = Boolean(activeSetId && measurementSetId && activeSetId !== measurementSetId) ||
    (Boolean(activeSetId) && sharedBy.length > 0 && activeSetId === measurementSetId)
  const linkedToOther = Boolean(activeSetId && activeSetId !== measurementSetId)

  const totals = useMemo(() => setTotals(lines), [lines])
  const qty = itemQuantity(unit, lines, numOr(wastePct, 0))
  const dp = decimalsForPrim(prim)

  const addLine = (shape = 'rect') => setLines((p) => [...p, emptyLine(shape)])
  const updateLine = (id: string, patch: Partial<TakeoffLine>) =>
    setLines((p) => p.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const updateDim = (id: string, key: string, val: string) =>
    setLines((p) =>
      p.map((l) =>
        l.id === id ? { ...l, dims: { ...(l.dims || {}), [key]: val } } : l,
      ),
    )
  const removeLine = (id: string) =>
    setLines((p) => (p.length > 1 ? p.filter((l) => l.id !== id) : p))
  const duplicateLine = (id: string) =>
    setLines((p) => {
      const i = p.findIndex((l) => l.id === id)
      if (i < 0) return p
      const c = { ...p[i], id: newTakeoffLineId(), dims: { ...(p[i].dims || {}) } }
      return [...p.slice(0, i + 1), c, ...p.slice(i + 1)]
    })

  const linkTo = (t: BoqTakeoffLinkTarget) => {
    setActiveSetId(t.setId)
    setShowLink(false)
    setLines((t.lines || []).map((l) => ({ ...l, dims: { ...(l.dims || {}) } })))
  }

  const unlink = () => {
    setLines((p) =>
      p.map((l) => ({ ...l, id: newTakeoffLineId(), dims: { ...(l.dims || {}) } })),
    )
    setActiveSetId(null)
    setShowLink(false)
  }

  if (!open) return null

  const srcLabel =
    linkTargets.find((t) => t.setId === activeSetId)?.ref ||
    sharedBy[0]?.ref ||
    'another item'

  return (
    <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-steel-border bg-panel shadow-xl">
      <div className="flex items-start justify-between gap-4 border-b border-steel-border bg-panel-hover px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[12px] font-semibold tracking-wide text-ink">
              TAKEOFF SHEET
            </h2>
            {itemRef ? (
              <span className="rounded bg-ink px-1.5 py-0.5 text-[11px] font-medium text-bg">
                {itemRef}
              </span>
            ) : null}
            <span className="rounded border border-steel-border px-1.5 py-0.5 text-[11px] font-medium text-steel">
              {unit}
            </span>
            {isLinked ? (
              <span className="inline-flex items-center gap-1 rounded bg-chalk-bg px-1.5 py-0.5 text-[11px] font-medium text-chalk">
                <LinkIcon /> linked
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-1 line-clamp-2 text-[11px] text-steel">{description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 px-1 text-steel hover:text-ink"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-steel-border bg-panel px-4 py-2 text-[12px]">
        <span className="inline-flex items-center gap-1.5 text-steel">
          <span className="text-[10px] uppercase tracking-wide">Deriving</span>
          <span className="rounded bg-bg px-2 py-1 text-[11px] font-medium text-ink">
            {PRIM_LABEL[prim]} → {unit}
          </span>
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-steel">
            Measurements
          </span>
          {isLinked ? (
            <span className="inline-flex items-center gap-1 rounded bg-chalk-bg px-2 py-1 text-[11px] text-chalk">
              <LinkIcon /> from {srcLabel}
              <button
                type="button"
                onClick={unlink}
                className="ml-1 rounded px-1 text-chalk hover:bg-panel-hover"
                title="Detach and keep a private copy"
              >
                detach
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setShowLink((s) => !s)}
              disabled={linkTargets.length === 0}
              className="inline-flex items-center gap-1 rounded border border-steel-border px-2 py-1 text-[11px] text-steel hover:text-ink disabled:opacity-40"
            >
              <LinkIcon /> Link to another item…
            </button>
          )}
          {showLink && !isLinked ? (
            <div className="absolute left-40 top-10 z-20 max-h-64 w-80 overflow-auto border border-steel-border bg-panel p-1 shadow-xl">
              {linkTargets.map((t) => (
                <button
                  key={t.setId}
                  type="button"
                  onClick={() => linkTo(t)}
                  className="block w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-panel-hover"
                >
                  <span className="font-medium text-ink">{t.ref}</span>{' '}
                  <span className="text-steel">
                    · {t.unit} · {t.lineCount} lines
                  </span>
                  <span className="block truncate text-steel">{t.description}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {sharedBy.length > 0 && !linkedToOther ? (
          <span className="text-[11px] text-steel">
            shared with {sharedBy.map((i) => i.ref).join(', ')}
          </span>
        ) : null}
      </div>
      {isLinked ? (
        <div className="border-b border-chalk/30 bg-chalk-bg/50 px-4 py-1.5 text-[11px] text-chalk">
          Editing these measurements changes every item that uses them. Use
          “detach” to keep a private copy instead.
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-steel">
              <th className="sticky top-0 z-10 bg-panel px-2 py-2 text-left font-medium">
                Description / location
              </th>
              <th className="sticky top-0 z-10 bg-panel px-2 py-2 text-left font-medium">
                Shape
              </th>
              <th className="sticky top-0 z-10 bg-panel px-2 py-2 text-center font-medium">
                Ddt
              </th>
              <th className="sticky top-0 z-10 bg-panel px-2 py-2 text-right font-medium">
                Nr
              </th>
              <th className="sticky top-0 z-10 bg-panel px-2 py-2 text-left font-medium">
                Dimensions
              </th>
              <th className="sticky top-0 z-10 bg-panel px-2 py-2 text-right font-medium">
                Depth
              </th>
              <th className="sticky top-0 z-10 bg-panel px-2 py-2 text-right font-medium">
                {PRIM_LABEL[prim]} {PRIM_UNIT[prim]}
              </th>
              <th className="sticky top-0 z-10 bg-panel px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const out = lineOutputs(line)
              const sd = SHAPES[line.shape] || SHAPES.rect
              return (
                <tr key={line.id} className="group align-top">
                  <td className="border-t border-steel-border/50 px-1 py-1">
                    <input
                      type="text"
                      value={line.label || ''}
                      onChange={(e) => updateLine(line.id, { label: e.target.value })}
                      placeholder="e.g. Wall W1, grid A–C"
                      className="w-40 rounded border border-transparent bg-transparent px-2 py-1 text-ink placeholder:text-steel/40 hover:border-steel-border focus:border-signal focus:bg-bg focus:outline-none"
                    />
                  </td>
                  <td className="border-t border-steel-border/50 px-1 py-1">
                    <select
                      value={line.shape}
                      onChange={(e) =>
                        updateLine(line.id, { shape: e.target.value, dims: {} })
                      }
                      className="rounded border border-transparent bg-transparent px-1 py-1 text-ink hover:border-steel-border focus:border-signal focus:bg-bg focus:outline-none"
                    >
                      {SHAPE_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {SHAPES[k].name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-t border-steel-border/50 px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={!!line.ded}
                      onChange={(e) => updateLine(line.id, { ded: e.target.checked })}
                      title="Deduction (negative)"
                      className="mt-1 h-4 w-4"
                    />
                  </td>
                  <td className="border-t border-steel-border/50 px-1 py-1">
                    <NumInput
                      value={line.nr}
                      placeholder="1"
                      width="w-14"
                      onChange={(v) => updateLine(line.id, { nr: v })}
                      onEnter={() => addLine(line.shape)}
                    />
                  </td>
                  <td className="border-t border-steel-border/50 px-1 py-1">
                    {line.shape === 'direct' ? (
                      <div className="flex items-center gap-1">
                        <NumInput
                          value={line.direct?.value}
                          placeholder="qty"
                          width="w-24"
                          onChange={(v) =>
                            updateLine(line.id, {
                              direct: { ...(line.direct || {}), value: v },
                            })
                          }
                          onEnter={() => addLine('direct')}
                        />
                        <span className="text-[11px] text-steel">as</span>
                        <select
                          value={line.direct?.prim || 'area'}
                          onChange={(e) =>
                            updateLine(line.id, {
                              direct: {
                                ...(line.direct || {}),
                                prim: e.target.value as TakeoffPrim,
                              },
                            })
                          }
                          className="rounded border border-steel-border px-1 py-1 text-[11px] text-ink focus:border-signal focus:outline-none bg-panel"
                        >
                          {PRIMS.map((p) => (
                            <option key={p} value={p}>
                              {PRIM_LABEL[p]}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {sd.fields.map(([key, label]) => (
                          <label key={key} className="inline-flex items-center gap-1">
                            <span className="text-[11px] text-steel">{label}</span>
                            <NumInput
                              value={line.dims?.[key]}
                              placeholder="0"
                              width="w-16"
                              onChange={(v) => updateDim(line.id, key, v)}
                              onEnter={() => addLine(line.shape)}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="border-t border-steel-border/50 px-1 py-1 text-right">
                    {line.shape === 'direct' || line.shape === 'linear' ? (
                      <span className="text-[11px] text-steel/40">—</span>
                    ) : (
                      <NumInput
                        value={line.depth}
                        placeholder="—"
                        width="w-16"
                        onChange={(v) => updateLine(line.id, { depth: v })}
                        onEnter={() => addLine(line.shape)}
                      />
                    )}
                  </td>
                  <td className="border-t border-steel-border/50 px-2 py-1 text-right font-medium tabular-nums">
                    <span className={out[prim] < 0 ? 'text-danger' : 'text-ink'}>
                      {fmtNum(out[prim], dp)}
                    </span>
                  </td>
                  <td className="border-t border-steel-border/50 px-1 py-1">
                    <div className="flex items-center justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
                      <IconBtn title="Duplicate line" onClick={() => duplicateLine(line.id)}>
                        <DupIcon />
                      </IconBtn>
                      <IconBtn title="Remove line" onClick={() => removeLine(line.id)}>
                        <TrashIcon />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="mx-2 mt-1 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => addLine('rect')}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-[12px] font-medium text-signal hover:bg-panel-hover"
          >
            <PlusIcon /> Add shape
          </button>
          <button
            type="button"
            onClick={() => addLine('direct')}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-[12px] font-medium text-steel hover:bg-panel-hover hover:text-ink"
          >
            <PlusIcon /> Add direct quantity
          </button>
        </div>
      </div>

      <div className="border-t border-steel-border bg-panel-hover px-4 py-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-steel">
            This set yields
          </span>
          {PRIMS.filter((p) => Math.abs(totals[p]) > 1e-9).map((p) => (
            <span
              key={p}
              className={`rounded-full px-2.5 py-1 text-[11px] tabular-nums ${
                p === prim ? 'bg-signal text-bg' : 'bg-bg text-steel'
              }`}
            >
              {PRIM_LABEL[p]}:{' '}
              <span className="font-medium">
                {fmtNum(totals[p], decimalsForPrim(p))} {PRIM_UNIT[p]}
              </span>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[13px] text-steel">
              <span>Waste %</span>
              <input
                type="text"
                inputMode="decimal"
                value={wastePct}
                onChange={(e) => setWastePct(e.target.value)}
                className="w-16 rounded border border-steel-border bg-bg px-2 py-1 text-right tabular-nums text-ink focus:border-signal focus:outline-none"
              />
            </label>
            {onOpenSchedule ? (
              <button
                type="button"
                className="text-[11px] text-steel underline decoration-dotted hover:text-ink"
                onClick={onOpenSchedule}
              >
                Open schedule
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-steel">
                {PRIM_LABEL[prim]} → cell
              </div>
              <div className="text-lg font-semibold tabular-nums text-ink">
                {fmtNum(qty.total, dp)}{' '}
                <span className="text-sm font-normal text-steel">{unit}</span>
              </div>
            </div>
            <GhostButton type="button" className="!px-3 !py-1.5 text-[12px]" onClick={onClose}>
              Cancel
            </GhostButton>
            <PrimaryButton
              type="button"
              className="!px-3 !py-1.5 text-[12px]"
              onClick={() =>
                onApply({
                  wastePct: numOr(wastePct, 0),
                  lines,
                  measurementSetId: linkedToOther
                    ? activeSetId
                    : activeSetId === null
                      ? null
                      : measurementSetId,
                })
              }
            >
              Apply to cell
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}
