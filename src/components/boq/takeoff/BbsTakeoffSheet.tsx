import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  BAR_SHAPES,
  BAR_SIZES,
  SHAPE_CODES,
  barCalc,
  bbsQuantity,
  cuttingLength,
  emptyBar,
  formerRadius,
  linkHook,
  newBarId,
  starterBars,
  type BbsBar,
} from '../../../lib/boqTakeoff/bbs'
import { numOr } from '../../../lib/boqTakeoff/measurement'
import { GhostButton, PrimaryButton } from '../../ui'
import { DupIcon, IconBtn, NumInput, PlusIcon, TrashIcon, fmtNum } from './TakeoffBits'

function ShapePreview({
  code,
  size = 56,
  showLabels = true,
  stroke = 2,
}: {
  code: string
  size?: number
  showLabels?: boolean
  stroke?: number
}) {
  const c = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  const L = (x: number, y: number, t: string) =>
    showLabels ? (
      <text x={x} y={y} fontSize="11" fill="currentColor" textAnchor="middle" opacity="0.65">
        {t}
      </text>
    ) : null
  let body: ReactNode = null
  if (code === '00')
    body = (
      <>
        <line x1="8" y1="32" x2="92" y2="32" {...c} />
        {L(50, 24, 'A')}
      </>
    )
  else if (code === '11')
    body = (
      <>
        <path d="M12 50 H70 V12" {...c} />
        {L(42, 45, 'A')}
        {L(78, 32, 'B')}
      </>
    )
  else if (code === '21')
    body = (
      <>
        <path d="M24 12 V50 H76 V12" {...c} />
        {L(16, 32, 'A')}
        {L(50, 45, 'B')}
        {L(84, 32, 'C')}
      </>
    )
  else if (code === '31')
    body = (
      <>
        <path d="M14 50 V16 H50 V50 H86" {...c} />
        {L(8, 34, 'A')}
        {L(32, 11, 'B')}
        {L(56, 34, 'C')}
        {L(68, 45, 'D')}
      </>
    )
  else if (code === '41')
    body = (
      <>
        <path d="M12 50 V16 H42 V50 H72 V16" {...c} />
        {L(7, 34, 'A')}
        {L(27, 11, 'B')}
        {L(48, 34, 'C')}
        {L(57, 45, 'D')}
        {L(78, 34, 'E')}
      </>
    )
  else if (code === '51')
    body = (
      <>
        <rect x="22" y="14" width="56" height="38" rx="2" {...c} />
        <path d="M22 14 l10 10 M22 14 l2 12" {...c} strokeWidth={stroke * 0.9} />
        {L(50, 10, 'A')}
        {L(84, 34, 'B')}
      </>
    )
  else if (code === '67')
    body = (
      <>
        <path d="M20 20 a30 7 0 0 0 60 0 M20 30 a30 7 0 0 0 60 0 M20 40 a30 7 0 0 0 60 0" {...c} />
        <path d="M20 20 v20 M80 20 v20" {...c} strokeWidth={stroke * 0.7} opacity="0.5" />
        {L(50, 15, 'D')}
        {L(88, 32, 'p')}
      </>
    )
  else
    body = (
      <>
        <line x1="12" y1="40" x2="88" y2="40" {...c} strokeDasharray="5 5" />
        <text x="50" y="26" fontSize="12" fill="currentColor" textAnchor="middle" opacity="0.6">
          L
        </text>
      </>
    )
  return (
    <svg viewBox="0 0 100 64" width={size} height={(size * 64) / 100} className="text-steel">
      {body}
    </svg>
  )
}

function ShapeSelect({
  value,
  onChange,
  size = 44,
}: {
  value: string
  onChange: (code: string) => void
  size?: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const shape = BAR_SHAPES[value] || BAR_SHAPES['00']

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        title={`Shape ${shape.code} — ${shape.name}`}
        className="flex items-center gap-1.5 rounded border border-steel-border bg-bg px-1.5 py-1 hover:border-steel focus:border-signal focus:outline-none"
      >
        <span className="text-steel">
          <ShapePreview code={value} size={size} showLabels={false} />
        </span>
        <span className="text-[11px] font-semibold text-ink">{shape.code}</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 grid w-[420px] grid-cols-2 gap-1 rounded border border-steel-border bg-panel p-1.5 shadow-xl">
          {SHAPE_CODES.map((code) => {
            const s = BAR_SHAPES[code]
            const active = code === value
            return (
              <button
                key={code}
                type="button"
                onClick={() => {
                  onChange(code)
                  setOpen(false)
                }}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-left ${
                  active ? 'bg-chalk-bg ring-1 ring-chalk' : 'hover:bg-panel-hover'
                }`}
              >
                <span className={active ? 'text-chalk' : 'text-steel'}>
                  <ShapePreview code={code} size={46} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold text-ink">
                    {s.manual ? 'Manual' : `Shape ${s.code}`}
                  </span>
                  <span className="block truncate text-[11px] text-steel">{s.name}</span>
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function BbsTakeoffSheet({
  open,
  onClose,
  itemRef,
  description,
  unit,
  elementKey,
  initialBars,
  initialWaste = 0,
  onApply,
}: {
  open: boolean
  onClose: () => void
  itemRef: string
  description: string
  unit: string
  elementKey?: string
  initialBars: BbsBar[]
  initialWaste?: number
  onApply: (payload: { wastePct: number; bars: BbsBar[] }) => void
}) {
  const [bars, setBars] = useState<BbsBar[]>([])
  const [wastePct, setWastePct] = useState(String(initialWaste ?? 0))

  useEffect(() => {
    if (!open) return
    setWastePct(String(initialWaste ?? 0))
    setBars(
      initialBars.length
        ? initialBars.map((b) => emptyBar({ ...b, dims: { ...(b.dims || {}) } }))
        : starterBars(elementKey),
    )
  }, [open, itemRef, initialBars, initialWaste, elementKey])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const rows = useMemo(() => bars.map((b) => ({ bar: b, ...barCalc(b) })), [bars])
  const totals = useMemo(() => {
    let no = 0
    let lenM = 0
    let kg = 0
    for (const r of rows) {
      no += r.totalNo
      lenM += r.totalLenM
      kg += r.massKg
    }
    return { no, lenM, kg }
  }, [rows])
  const qty = bbsQuantity(unit, bars, numOr(wastePct, 0))
  const byDia = useMemo(() => {
    const m = new Map<number, number>()
    for (const r of rows) {
      const d = numOr(r.bar.dia, 0)
      if (!d) continue
      m.set(d, (m.get(d) || 0) + r.massKg)
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [rows])

  const updateBar = (id: string, patch: Partial<BbsBar>) =>
    setBars((p) => p.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  const updateDim = (id: string, key: string, val: string) =>
    setBars((p) =>
      p.map((b) => (b.id === id ? { ...b, dims: { ...b.dims, [key]: val } } : b)),
    )
  const addBar = () => setBars((p) => [...p, emptyBar()])
  const removeBar = (id: string) =>
    setBars((p) => (p.length > 1 ? p.filter((b) => b.id !== id) : p))
  const duplicateBar = (id: string) =>
    setBars((p) => {
      const i = p.findIndex((b) => b.id === id)
      if (i < 0) return p
      const c = { ...p[i], id: newBarId(), dims: { ...p[i].dims } }
      return [...p.slice(0, i + 1), c, ...p.slice(i + 1)]
    })

  if (!open) return null

  return (
    <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden border border-steel-border bg-panel shadow-xl">
      <div className="flex items-start justify-between gap-4 border-b border-steel-border bg-panel-hover px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[12px] font-semibold tracking-wide text-ink">
              BAR BENDING SCHEDULE
            </h2>
            {itemRef ? (
              <span className="rounded bg-ink px-1.5 py-0.5 text-[11px] font-medium text-bg">
                {itemRef}
              </span>
            ) : null}
            <span className="rounded border border-steel-border px-1.5 py-0.5 text-[11px] font-medium text-steel">
              {unit}
            </span>
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

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-steel">
              {[
                ['Mark', 'left'],
                ['Member', 'left'],
                ['Shape', 'left'],
                ['Ø mm', 'right'],
                ['Dimensions (mm)', 'left'],
                ['No. mbrs', 'right'],
                ['No. each', 'right'],
                ['Total No.', 'right'],
                ['Cut length mm', 'right'],
                ['Total len m', 'right'],
                ['kg/m', 'right'],
                ['Mass kg', 'right'],
                ['', 'right'],
              ].map(([label, align], i) => (
                <th
                  key={i}
                  className={`sticky top-0 z-10 bg-panel px-2 py-2 font-medium ${
                    align === 'left' ? 'text-left' : 'text-right'
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ bar, totalNo, cut, totalLenM, unitMass: um, massKg }) => {
              const shape = BAR_SHAPES[bar.shapeCode] || BAR_SHAPES['00']
              const rDefault = formerRadius(numOr(bar.dia, 0))
              const manual = Boolean(shape.manual || bar.cutManual)
              return (
                <tr key={bar.id} className="group align-top">
                  <td className="border-t border-steel-border/50 px-1 py-1">
                    <input
                      type="text"
                      value={bar.mark}
                      placeholder="B1"
                      onChange={(e) => updateBar(bar.id, { mark: e.target.value })}
                      className="w-16 rounded border border-transparent bg-transparent px-2 py-1 text-ink placeholder:text-steel/40 hover:border-steel-border focus:border-signal focus:bg-bg focus:outline-none"
                    />
                  </td>
                  <td className="border-t border-steel-border/50 px-1 py-1">
                    <input
                      type="text"
                      value={bar.member}
                      placeholder="Pad P1"
                      onChange={(e) => updateBar(bar.id, { member: e.target.value })}
                      className="w-24 rounded border border-transparent bg-transparent px-2 py-1 text-ink placeholder:text-steel/40 hover:border-steel-border focus:border-signal focus:bg-bg focus:outline-none"
                    />
                  </td>
                  <td className="border-t border-steel-border/50 px-1 py-1">
                    <ShapeSelect
                      value={bar.shapeCode}
                      onChange={(code) => updateBar(bar.id, { shapeCode: code })}
                    />
                  </td>
                  <td className="border-t border-steel-border/50 px-1 py-1">
                    <select
                      value={String(bar.dia)}
                      onChange={(e) => updateBar(bar.id, { dia: e.target.value })}
                      className="w-16 rounded border border-transparent bg-transparent px-1 py-1 text-right tabular-nums text-ink hover:border-steel-border focus:border-signal focus:bg-bg focus:outline-none"
                    >
                      <option value="">—</option>
                      {BAR_SIZES.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-t border-steel-border/50 px-1 py-1">
                    {shape.manual ? (
                      <span className="text-[11px] text-steel">enter cut length →</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {shape.legs.map((leg) => (
                          <label key={leg} className="inline-flex items-center gap-1">
                            <span className="text-[11px] font-medium text-steel">
                              {shape.legLabels?.[leg] || leg}
                            </span>
                            <NumInput
                              value={bar.dims?.[leg]}
                              placeholder="0"
                              width="w-16"
                              onChange={(v) => updateDim(bar.id, leg, v)}
                              onEnter={addBar}
                            />
                          </label>
                        ))}
                        {shape.bends > 0 ? (
                          <label
                            className="inline-flex items-center gap-1"
                            title="Bending radius. Blank = BS 8666 default from Ø."
                          >
                            <span className="text-[11px] text-steel/60">r</span>
                            <NumInput
                              value={bar.r}
                              placeholder={rDefault ? String(rDefault) : 'auto'}
                              width="w-14"
                              onChange={(v) => updateBar(bar.id, { r: v })}
                              onEnter={addBar}
                            />
                          </label>
                        ) : null}
                        {shape.link ? (
                          <label
                            className="inline-flex items-center gap-1"
                            title="Hook length per end. Blank = max(10Ø, 75)."
                          >
                            <span className="text-[11px] text-steel/60">hook</span>
                            <NumInput
                              value={bar.hook}
                              placeholder={String(linkHook(numOr(bar.dia, 0)))}
                              width="w-14"
                              onChange={(v) => updateBar(bar.id, { hook: v })}
                              onEnter={addBar}
                            />
                          </label>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="border-t border-steel-border/50 px-1 py-1">
                    <NumInput
                      value={bar.mbrs}
                      placeholder="1"
                      width="w-16"
                      onChange={(v) => updateBar(bar.id, { mbrs: v })}
                      onEnter={addBar}
                    />
                  </td>
                  <td className="border-t border-steel-border/50 px-1 py-1">
                    <NumInput
                      value={bar.each}
                      placeholder="1"
                      width="w-16"
                      onChange={(v) => updateBar(bar.id, { each: v })}
                      onEnter={addBar}
                    />
                  </td>
                  <td className="border-t border-steel-border/50 px-2 py-1 text-right tabular-nums text-steel">
                    {fmtNum(totalNo, 0)}
                  </td>
                  <td className="border-t border-steel-border/50 px-1 py-1">
                    {manual ? (
                      <div className="flex items-center justify-end gap-1">
                        <NumInput
                          value={bar.cutOverride}
                          placeholder={shape.manual ? '0' : String(Math.round(cut))}
                          width="w-20"
                          onChange={(v) => updateBar(bar.id, { cutOverride: v, cutManual: true })}
                        />
                        {!shape.manual ? (
                          <button
                            type="button"
                            title="Back to auto"
                            onClick={() => updateBar(bar.id, { cutManual: false, cutOverride: '' })}
                            className="rounded px-1 text-[10px] font-semibold uppercase text-signal hover:bg-panel-hover"
                          >
                            auto
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <span className="tabular-nums text-ink">
                          {Number.isFinite(cut) ? Math.round(cut).toLocaleString() : '—'}
                        </span>
                        <button
                          type="button"
                          title="Override cutting length"
                          onClick={() =>
                            updateBar(bar.id, {
                              cutManual: true,
                              cutOverride: String(Math.round(cuttingLength(bar))),
                            })
                          }
                          className="rounded px-0.5 text-steel opacity-0 hover:text-ink group-hover:opacity-100"
                        >
                          ✎
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="border-t border-steel-border/50 px-2 py-1 text-right tabular-nums text-steel">
                    {fmtNum(totalLenM, 2)}
                  </td>
                  <td className="border-t border-steel-border/50 px-2 py-1 text-right tabular-nums text-steel/70">
                    {um ? fmtNum(um, 3) : '—'}
                  </td>
                  <td className="border-t border-steel-border/50 px-2 py-1 text-right font-medium tabular-nums text-ink">
                    {fmtNum(massKg, 2)}
                  </td>
                  <td className="border-t border-steel-border/50 px-1 py-1">
                    <div className="flex items-center justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
                      <IconBtn title="Duplicate" onClick={() => duplicateBar(bar.id)}>
                        <DupIcon />
                      </IconBtn>
                      <IconBtn title="Remove" onClick={() => removeBar(bar.id)}>
                        <TrashIcon />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <button
          type="button"
          onClick={addBar}
          className="mx-2 mt-1 inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-[12px] font-medium text-signal hover:bg-panel-hover"
        >
          <PlusIcon /> Add bar mark
        </button>
        {byDia.length > 0 ? (
          <div className="mx-2 mb-2 mt-1 flex flex-wrap items-center gap-2 border-t border-steel-border pt-2">
            <span className="text-[10px] uppercase tracking-wide text-steel">Mass by Ø</span>
            {byDia.map(([d, kg]) => (
              <span
                key={d}
                className="rounded-full bg-bg px-2.5 py-1 text-[11px] tabular-nums text-steel"
              >
                Ø{d}: <span className="font-medium text-ink">{fmtNum(kg, 1)} kg</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-t border-steel-border bg-panel-hover px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-[13px]">
            <label className="flex items-center gap-2 text-steel">
              <span title="Rolling margin / cutting waste">Rolling margin %</span>
              <input
                type="text"
                inputMode="decimal"
                value={wastePct}
                onChange={(e) => setWastePct(e.target.value)}
                className="w-16 rounded border border-steel-border bg-bg px-2 py-1 text-right tabular-nums text-ink focus:border-signal focus:outline-none"
              />
            </label>
            <div className="text-steel">
              {fmtNum(totals.no, 0)} bars ·{' '}
              <span className="tabular-nums">{fmtNum(totals.lenM, 1)} m</span> ·{' '}
              <span className="font-medium tabular-nums text-ink">
                {fmtNum(totals.kg, 1)} kg net
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-steel">
                Total quantity
              </div>
              <div className="text-lg font-semibold tabular-nums text-ink">
                {fmtNum(qty.total, qty.decimals)}{' '}
                <span className="text-sm font-normal text-steel">{unit}</span>
              </div>
            </div>
            <GhostButton type="button" className="!px-3 !py-1.5 text-[12px]" onClick={onClose}>
              Cancel
            </GhostButton>
            <PrimaryButton
              type="button"
              className="!px-3 !py-1.5 text-[12px]"
              onClick={() => onApply({ wastePct: numOr(wastePct, 0), bars })}
            >
              Apply to cell
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}
