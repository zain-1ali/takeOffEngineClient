import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createManualBoqItem,
  deleteManualBoqItem,
  listManualBoqItems,
} from '../../api/projectsApi'
import {
  formatUniformatOption,
  UNIFORMAT_CODE_OPTIONS,
} from '../../lib/uniformatOptions'
import { formatMoney } from '../../lib/units'
import type { Project } from '../../types/api'
import type {
  ManualBoqLabourMode,
  ManualBoqLinkKind,
} from '../../types/manualBoq'
import { Field, inputClass } from '../modals/Modal'
import { GhostButton, NumericInput, PrimaryButton } from '../ui'

type RateOption = {
  key: string
  label: string
  linkKind: 'analysis' | 'resource'
  analysisCode?: string
  resourceGroup?: 'materials' | 'labour' | 'equipment'
  resourceCode?: string
  unit: string
  rate: number
  hasLabour: boolean
}

function buildRateOptions(project: Project): RateOption[] {
  const lib = project.rateLib
  const opts: RateOption[] = []
  Object.entries(lib.analyses || {}).forEach(([code, a]) => {
    opts.push({
      key: `a:${code}`,
      label: `${a.label} (${code}) · ${a.unit}`,
      linkKind: 'analysis',
      analysisCode: code,
      unit: a.unit,
      rate: 0,
      hasLabour: (a.labour?.length || 0) > 0,
    })
  })
  ;(['materials', 'labour', 'equipment'] as const).forEach((group) => {
    for (const r of lib[group] || []) {
      opts.push({
        key: `r:${group}:${r.code}`,
        label: `${r.desc} [${group}/${r.code}] · ${r.unit} · ${project.currency} ${r.rate}`,
        linkKind: 'resource',
        resourceGroup: group,
        resourceCode: r.code,
        unit: r.unit,
        rate: r.rate,
        hasLabour: group === 'labour',
      })
    }
  })
  return opts
}

export function ManualBoqForm({
  project,
  floorId,
  scope,
}: {
  project: Project
  floorId: string
  scope: 'floor' | 'project'
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [unit, setUnit] = useState('Item')
  const [quantity, setQuantity] = useState(1)
  const [unitRate, setUnitRate] = useState<number | ''>('')
  const [uniformatCode, setUniformatCode] = useState('')
  const [rateKey, setRateKey] = useState('')
  const [rateQuery, setRateQuery] = useState('')
  const [labourMode, setLabourMode] = useState<ManualBoqLabourMode>('none')
  const [outputPerDay, setOutputPerDay] = useState<number | ''>('')
  const [gangDescription, setGangDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const options = useMemo(() => buildRateOptions(project), [project])
  const filtered = useMemo(() => {
    const q = rateQuery.trim().toLowerCase()
    if (!q) return options.slice(0, 40)
    return options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 40)
  }, [options, rateQuery])

  const selected = options.find((o) => o.key === rateKey) || null

  const listQuery = useQuery({
    queryKey: ['manual-boq', project.id, scope, scope === 'floor' ? floorId : 'all'],
    queryFn: () =>
      listManualBoqItems(
        project.id,
        scope === 'floor' ? floorId : undefined,
      ),
  })

  function invalidateReports() {
    void qc.invalidateQueries({ queryKey: ['manual-boq', project.id] })
    void qc.invalidateQueries({ queryKey: ['reports', project.id] })
    void qc.invalidateQueries({ queryKey: ['cost-plan', project.id] })
  }

  const createMut = useMutation({
    mutationFn: () => {
      let linkKind: ManualBoqLinkKind = 'none'
      let analysisCode: string | null = null
      let resourceGroup: 'materials' | 'labour' | 'equipment' | null = null
      let resourceCode: string | null = null
      if (selected?.linkKind === 'analysis') {
        linkKind = 'analysis'
        analysisCode = selected.analysisCode || null
      } else if (selected?.linkKind === 'resource') {
        linkKind = 'resource'
        resourceGroup = selected.resourceGroup || null
        resourceCode = selected.resourceCode || null
      }
      return createManualBoqItem(project.id, {
        floorId: scope === 'floor' ? floorId : null,
        description: description.trim(),
        unit: unit.trim() || 'Item',
        quantity: Number(quantity) || 0,
        linkKind,
        analysisCode,
        resourceGroup,
        resourceCode,
        labourMode,
        outputPerDay:
          labourMode === 'outputRate' && outputPerDay !== ''
            ? Number(outputPerDay)
            : null,
        gangDescription:
          labourMode === 'outputRate' ? gangDescription.trim() || null : null,
        uniformatCode: uniformatCode.trim() || null,
        unitRate:
          linkKind === 'none' && unitRate !== '' ? Number(unitRate) : null,
      })
    },
    onSuccess: () => {
      setError(null)
      setDescription('')
      setQuantity(1)
      setUnit('Item')
      setUnitRate('')
      setUniformatCode('')
      setRateKey('')
      setRateQuery('')
      setLabourMode('none')
      setOutputPerDay('')
      setGangDescription('')
      setOpen(false)
      invalidateReports()
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Could not create item')
    },
  })

  const delMut = useMutation({
    mutationFn: (id: string) => deleteManualBoqItem(project.id, id),
    onSuccess: () => {
      invalidateReports()
    },
  })

  const items = listQuery.data?.items ?? []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton
          className="!text-xs !py-1.5 !px-3"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Close form' : 'New BOQ item'}
        </PrimaryButton>
        <p className="text-xs text-steel">
          Ad-hoc / lump-sum lines (e.g. unit Item) — assign a UniFormat code for
          Cost Plan grouping. Linked rates follow the same revision gate as mix
          ratios.
        </p>
      </div>

      {open && (
        <div className="border border-steel-border bg-panel p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Description">
              <input
                className={inputClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Survey control for setting out"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unit">
                <input
                  className={inputClass}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="Item"
                  list="manual-boq-units"
                />
                <datalist id="manual-boq-units">
                  <option value="Item" />
                  <option value="sum" />
                  <option value="nr" />
                  <option value="m" />
                  <option value="m²" />
                  <option value="m³" />
                </datalist>
              </Field>
              <Field label="Quantity">
                <NumericInput
                  min={0}
                  className={inputClass}
                  value={quantity}
                  emptyValue={0}
                  onChange={(n) => setQuantity(n ?? 0)}
                />
              </Field>
            </div>
          </div>

          <Field label="UniFormat code (Cost Plan)">
            <select
              className={inputClass}
              value={uniformatCode}
              onChange={(e) => setUniformatCode(e.target.value)}
            >
              <option value="">Unclassified (Z9990)</option>
              {UNIFORMAT_CODE_OPTIONS.filter((c) => c.code !== 'Z9990').map(
                (c) => (
                  <option key={c.code} value={c.code}>
                    {formatUniformatOption(c.code, c.title)}
                  </option>
                ),
              )}
            </select>
          </Field>

          <Field label="Linked rate (optional — from rate databank)">
            <input
              className={inputClass}
              value={rateQuery}
              onChange={(e) => {
                setRateQuery(e.target.value)
                setRateKey('')
              }}
              placeholder="Search analyses or resources…"
            />
            <select
              className={`${inputClass} mt-1`}
              value={rateKey}
              onChange={(e) => {
                setRateKey(e.target.value)
                const opt = options.find((o) => o.key === e.target.value)
                if (opt?.unit) setUnit(opt.unit)
              }}
            >
              <option value="">No linked rate — enter unit rate below</option>
              {filtered.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          {!selected && (
            <Field label={`Unit rate (${project.currency})`}>
              <NumericInput
                min={0}
                className={inputClass}
                value={unitRate === '' ? null : unitRate}
                allowEmpty
                placeholder="Required for priced Cost Plan / BOQ amount"
                onChange={(n) => setUnitRate(n == null ? '' : n)}
              />
            </Field>
          )}

          <div className="border border-steel-border/70 px-3 py-3 space-y-2">
            <p className="text-xs font-medium text-ink">
              Labour generation (pick one path — not both)
            </p>
            <p className="text-[11px] text-steel leading-relaxed">
              Use an <strong>output rate</strong> when you know productivity
              (man-days = qty ÷ output/day). Or use a{' '}
              <strong>linked build-up rate</strong> that already includes a
              labour component — BOM/Labour come from that analysis. You do not
              need both.
            </p>
            <div className="flex flex-col gap-1.5 text-xs text-ink">
              {(
                [
                  ['none', 'No labour from this item'],
                  ['outputRate', 'From output rate / gang (enter below)'],
                  [
                    'fromLinkedRate',
                    'From linked rate labour component (requires analysis or labour resource)',
                  ],
                ] as const
              ).map(([id, label]) => (
                <label key={id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="labourMode"
                    checked={labourMode === id}
                    onChange={() => setLabourMode(id)}
                    className="accent-signal"
                  />
                  {label}
                </label>
              ))}
            </div>
            {labourMode === 'outputRate' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <Field label="Output rate (units per day)">
                  <NumericInput
                    min={0.01}
                    className={inputClass}
                    value={outputPerDay === '' ? null : outputPerDay}
                    allowEmpty
                    onChange={(n) => setOutputPerDay(n == null ? '' : n)}
                  />
                </Field>
                <Field label="Gang / trade description">
                  <input
                    className={inputClass}
                    value={gangDescription}
                    onChange={(e) => setGangDescription(e.target.value)}
                    placeholder="e.g. 1 Mason + 2 Labourer"
                  />
                </Field>
              </div>
            )}
            {labourMode === 'fromLinkedRate' &&
              selected &&
              !selected.hasLabour && (
                <p className="text-xs text-danger">
                  Selected rate has no labour component — pick a build-up
                  analysis (or a labour resource), or switch to output rate.
                </p>
              )}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2">
            <GhostButton
              className="!text-xs !py-1.5 !px-3"
              onClick={() => setOpen(false)}
            >
              Cancel
            </GhostButton>
            <PrimaryButton
              className="!text-xs !py-2"
              disabled={!description.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? 'Saving…' : 'Add to BOQ'}
            </PrimaryButton>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="border border-steel-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-panel-hover text-steel text-left">
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">UniFormat</th>
                <th className="px-3 py-2 font-medium">Qty</th>
                <th className="px-3 py-2 font-medium">Applied rate</th>
                <th className="px-3 py-2 font-medium">Labour</th>
                <th className="px-3 py-2 font-medium w-16" />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-steel-border">
                  <td className="px-3 py-2 text-ink">
                    <span className="text-[10px] uppercase tracking-wide text-signal mr-1.5">
                      Manual
                    </span>
                    {it.description}
                    {it.floorId ? (
                      <span className="text-steel ml-1">· {it.floorId}</span>
                    ) : (
                      <span className="text-steel ml-1">· project-wide</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-steel">
                    {it.uniformatCode || 'Z9990'}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {it.quantity} {it.unit}
                  </td>
                  <td className="px-3 py-2 font-mono text-steel">
                    {formatMoney(it.appliedUnitRate, project.currency)}
                    {it.appliedAtRevision ? (
                      <span className="block text-[10px]">
                        rev {it.appliedAtRevision}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-steel">
                    {it.labourMode === 'outputRate'
                      ? 'Output rate'
                      : it.labourMode === 'fromLinkedRate'
                        ? 'Linked rate'
                        : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-danger"
                      onClick={() => {
                        if (confirm(`Delete “${it.description}”?`)) {
                          delMut.mutate(it.id)
                        }
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
