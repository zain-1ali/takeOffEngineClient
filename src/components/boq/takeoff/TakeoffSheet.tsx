import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import {
  syntheticTakeoffMeasureInstance,
  takeoffItemTypeForKind,
  takeoffLineFromCapture,
} from '../../../lib/boqTakeoff/fromPdfMeasure'
import type { BoqTakeoffLinkTarget, BoqTakeoffSharedBy } from '../../../types/selectedBoq'
import { fetchSheets } from '../../../api/sheets'
import { createTakeoffItem } from '../../../api/takeoffItems'
import { sheetIsCalibrated } from '../../../lib/sheetCalibration'
import {
  FieldMeasureButton,
  MeasureSessionModal,
} from '../../MeasureSessionModal'
import { GhostButton, PrimaryButton } from '../../ui'
import { DupIcon, IconBtn, LinkIcon, NumInput, PlusIcon, TrashIcon, fmtNum } from './TakeoffBits'

export function TakeoffSheet({
  open,
  onClose,
  itemRef,
  description,
  unit,
  elementKey,
  projectId,
  floorId,
  initialLines,
  initialWaste = 0,
  measurementSetId,
  sharedBy,
  linkTargets,
  pdfMeasurements = [],
  onApply,
  onDescriptionChange,
  onOpenSchedule,
}: {
  open: boolean
  onClose: () => void
  itemRef: string
  description: string
  unit: string
  elementKey?: string
  projectId?: string
  floorId?: string
  initialLines: TakeoffLine[]
  initialWaste?: number
  measurementSetId: string | null
  sharedBy: BoqTakeoffSharedBy[]
  linkTargets: BoqTakeoffLinkTarget[]
  pdfMeasurements?: Array<{
    id: string
    sheetId: string
    sheetName: string
    label: string
    type: 'LINEAR' | 'AREA' | 'COUNT'
    value: number
    unit: string
    line: TakeoffLine
  }>
  onApply: (payload: {
    wastePct: number
    lines: TakeoffLine[]
    measurementSetId: string | null
  }) => void
  onDescriptionChange?: (description: string) => void
  onOpenSchedule?: () => void
}) {
  const prim = autoPrim(unit)
  const [wastePct, setWastePct] = useState(String(initialWaste ?? 0))
  const [lines, setLines] = useState<TakeoffLine[]>([])
  const [activeSetId, setActiveSetId] = useState<string | null>(measurementSetId)
  const [showLink, setShowLink] = useState(false)
  const [showPdfMeasures, setShowPdfMeasures] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState(description)
  const [measureLineId, setMeasureLineId] = useState<string | null>(null)
  const measureOpen = measureLineId !== null

  const sheetsQuery = useQuery({
    queryKey: ['projects', projectId, 'sheets', floorId],
    queryFn: () => fetchSheets(projectId!, floorId!),
    enabled: open && Boolean(projectId && floorId),
  })
  const sheets = sheetsQuery.data ?? []
  const measureDisabled =
    !projectId || !floorId
      ? 'Open takeoff from a floor with a drawing'
      : sheets.length === 0
        ? 'Upload the floor drawing first'
        : sheets.some(sheetIsCalibrated)
          ? null
          : 'Calibrate the drawing first'
  const measureTarget = syntheticTakeoffMeasureInstance({
    floorId: floorId || '',
    mark: itemRef || 'TAKEOFF',
    prim,
  })

  useEffect(() => {
    if (!open) return
    setWastePct(String(initialWaste ?? 0))
    setActiveSetId(measurementSetId)
    setShowLink(false)
    setShowPdfMeasures(false)
    setMeasureLineId(null)
    setDescriptionDraft(description)
    const seeded =
      initialLines.length > 0
        ? initialLines.map((l) => ({ ...l, dims: { ...(l.dims || {}) } }))
        : starterLines(elementKey)
    setLines(seeded)
  }, [
    open,
    itemRef,
    description,
    initialWaste,
    measurementSetId,
    initialLines,
    elementKey,
  ])

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

  const addPdfMeasurement = (line: TakeoffLine) => {
    setLines((current) => {
      if (
        line.pdfTakeoffItemId &&
        current.some((row) => row.pdfTakeoffItemId === line.pdfTakeoffItemId)
      ) {
        return current
      }
      const starter = current[0]
      const withoutBlankStarter =
        current.length === 1 &&
        !starter.pdfTakeoffItemId &&
        !String(starter.label || '').trim() &&
        !Object.values(starter.dims || {}).some(Boolean)
          ? []
          : current
      return [...withoutBlankStarter, { ...line }]
    })
    setShowPdfMeasures(false)
  }

  const applyPdfCapture = async (capture: {
    kind: string
    value: number
    points: { x: number; y: number }[]
    sheetId: string
    label: string
  }) => {
    let takeoffItemId: string | undefined
    const type = takeoffItemTypeForKind(capture.kind)
    const pointsOk =
      type === 'COUNT'
        ? capture.points.length > 0
        : type === 'LINEAR'
          ? capture.points.length >= 2
          : capture.points.length >= 3
    if (pointsOk) {
      try {
        const item = await createTakeoffItem(capture.sheetId, {
          type,
          points: capture.points,
          color: type === 'AREA' ? '#22c55e' : type === 'COUNT' ? '#e29a12' : '#3b82f6',
          label: capture.label || itemRef,
        })
        takeoffItemId = item.id
      } catch {
        /* keep the takeoff line even if the drawing item could not be stored */
      }
    }
    const existingId =
      measureLineId && measureLineId !== '__new__' ? measureLineId : undefined
    const nextLine = {
      ...takeoffLineFromCapture(capture, unit, existingId),
      pdfTakeoffItemId: takeoffItemId,
    }
    setLines((current) => {
      if (existingId && current.some((row) => row.id === existingId)) {
        return current.map((row) => (row.id === existingId ? { ...nextLine, id: row.id } : row))
      }
      const starter = current[0]
      const withoutBlankStarter =
        current.length === 1 &&
        !starter.pdfTakeoffItemId &&
        !String(starter.label || '').trim() &&
        !Object.values(starter.dims || {}).some(Boolean)
          ? []
          : current
      return [...withoutBlankStarter, nextLine]
    })
    setMeasureLineId(null)
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
          <textarea
            value={descriptionDraft}
            maxLength={4000}
            rows={Math.min(6, Math.max(2, descriptionDraft.split('\n').length + Math.floor(descriptionDraft.length / 80)))}
            aria-label="Takeoff item description"
            title="Edit description — full text is shown"
            onChange={(event) => setDescriptionDraft(event.target.value)}
            onBlur={() => {
              const next = descriptionDraft.trim()
              if (!next) setDescriptionDraft(description)
              else if (next !== description) onDescriptionChange?.(next)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setDescriptionDraft(description)
                event.currentTarget.blur()
              }
            }}
            className="mt-1 w-full resize-y whitespace-pre-wrap break-words border-b border-transparent bg-transparent text-[11px] leading-snug text-steel outline-none hover:border-steel-border focus:border-signal focus:text-ink"
          />
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
          <button
            type="button"
            onClick={() => setShowPdfMeasures((shown) => !shown)}
            disabled={pdfMeasurements.length === 0}
            className="inline-flex items-center gap-1 rounded border border-steel-border px-2 py-1 text-[11px] text-steel hover:text-ink disabled:opacity-40"
            title={
              pdfMeasurements.length
                ? 'Use a measurement traced on the floor PDF'
                : 'No compatible measurements exist on this floor PDF'
            }
          >
            PDF measure ({pdfMeasurements.length})
          </button>
          <FieldMeasureButton
            disabledReason={measureDisabled}
            label="PDF"
            onClick={() => setMeasureLineId('__new__')}
          />
          {showPdfMeasures ? (
            <div className="absolute left-40 top-10 z-20 max-h-72 w-[28rem] overflow-auto border border-steel-border bg-panel p-1 shadow-xl">
              {pdfMeasurements.map((measurement) => {
                const alreadyUsed = lines.some(
                  (line) => line.pdfTakeoffItemId === measurement.id,
                )
                return (
                  <button
                    key={measurement.id}
                    type="button"
                    disabled={alreadyUsed}
                    onClick={() => addPdfMeasurement(measurement.line)}
                    className="block w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-panel-hover disabled:opacity-40"
                  >
                    <span className="font-medium text-ink">
                      {measurement.label}
                    </span>{' '}
                    <span className="text-steel">
                      · {measurement.value.toLocaleString()} {measurement.unit}
                    </span>
                    <span className="block truncate text-steel">
                      {measurement.sheetName}
                      {alreadyUsed ? ' · already linked' : ''}
                    </span>
                  </button>
                )
              })}
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
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={line.label || ''}
                        onChange={(e) => updateLine(line.id, { label: e.target.value })}
                        placeholder="e.g. Wall W1, grid A–C"
                        className="w-40 rounded border border-transparent bg-transparent px-2 py-1 text-ink placeholder:text-steel/40 hover:border-steel-border focus:border-signal focus:bg-bg focus:outline-none"
                      />
                      <FieldMeasureButton
                        disabledReason={measureDisabled}
                        label="line"
                        onClick={() => setMeasureLineId(line.id)}
                      />
                    </div>
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
      {measureOpen && projectId && floorId ? (
        <MeasureSessionModal
          open
          projectId={projectId}
          floorId={floorId}
          instance={measureTarget.instance}
          fieldKey={measureTarget.fieldKey}
          onClose={() => setMeasureLineId(null)}
          onApply={() => undefined}
          onTakeoffCapture={(event) => {
            void applyPdfCapture(event)
          }}
        />
      ) : null}
    </div>
  )
}
