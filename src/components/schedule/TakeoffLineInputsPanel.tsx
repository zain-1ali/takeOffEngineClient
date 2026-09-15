import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getTakeoffInputSet,
  listSelectedBoqItems,
  updateTakeoffInputSet,
} from '../../api/projectsApi'
import type { SelectedBoqItem } from '../../types/selectedBoq'
import type {
  TakeoffInputMethod,
  TakeoffInputSet,
  TakeoffLineInput,
} from '../../types/takeoffInputs'

const inputClass =
  'border border-steel-border bg-panel px-2 py-1.5 text-xs text-ink outline-none'

const defaultMethod = (unit: string): TakeoffInputMethod => {
  const value = unit.toLowerCase().replace(/\s/g, '')
  if (/^(nr|no|nos|item|each|ea)$/.test(value)) return 'count'
  if (/^(m|lm|linm)$/.test(value)) return 'length'
  if (/^(m2|m²|sqm)$/.test(value)) return 'area'
  if (/^(m3|m³|cum)$/.test(value)) return 'volume'
  if (/^(kg|t|ton|tonne)$/.test(value)) return 'weight'
  if (/^(hr|hour|day|week|month)$/.test(value)) return 'time'
  if (/^(%|percent|percentage)$/.test(value)) return 'percent'
  return 'direct'
}

const lineId = (item: SelectedBoqItem) =>
  (item as SelectedBoqItem & { lineKey?: string }).lineKey ||
  item.catalogueRef

export function TakeoffLineInputsPanel({
  projectId,
  floorId,
  elementKey,
  compact = false,
}: {
  projectId: string
  floorId: string
  elementKey: string
  compact?: boolean
}) {
  const selectedQuery = useQuery({
    queryKey: ['selected-boq', projectId, floorId, elementKey],
    queryFn: () => listSelectedBoqItems(projectId, { floorId, elementKey }),
  })

  const groups = useMemo(() => {
    const byFloor = new Map<string, SelectedBoqItem[]>()
    for (const item of selectedQuery.data?.items ?? []) {
      const items = byFloor.get(item.floorId) ?? []
      items.push(item)
      byFloor.set(item.floorId, items)
    }
    return [...byFloor.entries()]
  }, [selectedQuery.data])

  if (selectedQuery.isLoading) {
    return <p className="text-xs text-steel">Loading selected work items…</p>
  }
  if (!groups.length) {
    return (
      <div className="border border-dashed border-steel-border p-4 text-sm text-steel">
        Select BOQ work items first. Their relevant drivers will appear here.
      </div>
    )
  }

  return (
    <div className={compact ? 'mt-5' : ''}>
      {!compact && (
        <p className="mb-4 text-sm text-steel">
          Enter dimensions, counts, allowances, or a direct measured quantity.
          Only selected work items are shown.
        </p>
      )}
      <div className="space-y-5">
        {groups.map(([scopeFloorId, items]) => (
          <InputScope
            key={scopeFloorId}
            projectId={projectId}
            floorId={scopeFloorId}
            elementKey={elementKey}
            items={items}
          />
        ))}
      </div>
    </div>
  )
}

function InputScope({
  projectId,
  floorId,
  elementKey,
  items,
}: {
  projectId: string
  floorId: string
  elementKey: string
  items: SelectedBoqItem[]
}) {
  const qc = useQueryClient()
  const queryKey = ['takeoff-inputs', projectId, floorId, elementKey]
  const query = useQuery({
    queryKey,
    queryFn: () => getTakeoffInputSet(projectId, { floorId, elementKey }),
  })
  const [draft, setDraft] = useState<TakeoffInputSet | null>(null)
  const saveTimer = useRef<number | null>(null)
  useEffect(() => {
    if (query.data?.inputSet) setDraft(query.data.inputSet)
  }, [query.data])

  const save = useMutation({
    mutationFn: (value: TakeoffInputSet) =>
      updateTakeoffInputSet(
        projectId,
        { floorId, elementKey },
        { shared: value.shared, lineInputs: value.lineInputs },
      ),
    onSuccess: (data) => {
      setDraft(data.inputSet)
      qc.setQueryData(queryKey, data)
      void qc.invalidateQueries({ queryKey: ['reports', projectId] })
      void qc.invalidateQueries({ queryKey: ['cost-plan', projectId] })
    },
  })

  const categories = useMemo(() => {
    const result = new Map<string, SelectedBoqItem[]>()
    for (const item of items) {
      const key = item.workCategory || 'General measured work'
      result.set(key, [...(result.get(key) ?? []), item])
    }
    return [...result.entries()]
  }, [items])

  if (!draft) return <p className="text-xs text-steel">Loading inputs…</p>

  const updateLine = (item: SelectedBoqItem, patch: Partial<TakeoffLineInput>) => {
    const key = lineId(item)
    setDraft((current) => {
      if (!current) return current
      const next = {
        ...current,
        lineInputs: {
          ...current.lineInputs,
          [key]: {
            method: defaultMethod(item.unit),
            enabled: true,
            ...(current.lineInputs[key] ?? {}),
            ...patch,
          },
        },
      }
      if (saveTimer.current != null) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => save.mutate(next), 400)
      return next
    })
  }

  return (
    <section>
      {floorId.startsWith('__') && (
        <div className="mb-2 text-[11px] uppercase tracking-wide text-signal">
          Project-wide inputs
        </div>
      )}
      <div className="space-y-3">
        {categories.map(([category, lines]) => (
          <details
            key={category}
            open
            className="border border-steel-border bg-panel/30"
          >
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink">
              {category} · {lines.length}
            </summary>
            <div className="grid gap-3 border-t border-steel-border p-3 lg:grid-cols-2">
              {lines.map((item) => {
                const key = lineId(item)
                const value = draft.lineInputs[key] ?? {}
                const method = value.method || defaultMethod(item.unit)
                return (
                  <LineInputCard
                    key={item.id}
                    item={item}
                    value={value}
                    method={method}
                    onChange={(patch) => updateLine(item, patch)}
                    onSave={() => {
                      const next = draft
                      save.mutate(next)
                    }}
                    saving={save.isPending}
                  />
                )
              })}
            </div>
          </details>
        ))}
      </div>
      {save.isError && (
        <p className="mt-2 text-xs text-danger">Could not save takeoff inputs.</p>
      )}
    </section>
  )
}

function NumberField({
  label,
  value,
  onChange,
  onBlur,
}: {
  label: string
  value?: number
  onChange: (value: number | undefined) => void
  onBlur: () => void
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-steel">
      {label}
      <input
        type="number"
        min={0}
        step="any"
        className={inputClass}
        value={value ?? ''}
        onChange={(event) => {
          const raw = event.target.value
          onChange(raw === '' ? undefined : Math.max(0, Number(raw)))
        }}
        onBlur={onBlur}
      />
    </label>
  )
}

function LineInputCard({
  item,
  value,
  method,
  onChange,
  onSave,
  saving,
}: {
  item: SelectedBoqItem
  value: TakeoffLineInput
  method: TakeoffInputMethod
  onChange: (patch: Partial<TakeoffLineInput>) => void
  onSave: () => void
  saving: boolean
}) {
  const number = (name: keyof TakeoffLineInput, label: string) => (
    <NumberField
      label={label}
      value={value[name] as number | undefined}
      onChange={(next) => onChange({ [name]: next })}
      onBlur={onSave}
    />
  )
  return (
    <article className="border border-steel-border bg-bg/50 p-3">
      <div className="flex items-start gap-2">
        <label className="mt-0.5 text-[11px] text-steel">
          <input
            type="checkbox"
            className="mr-1 accent-signal"
            checked={value.enabled !== false}
            onChange={(event) => {
              onChange({ enabled: event.target.checked })
              setTimeout(onSave, 0)
            }}
          />
          Include
        </label>
        <div className="min-w-0 flex-1">
          <div className="text-xs leading-snug text-ink">{item.description}</div>
          <div className="mt-0.5 font-mono text-[10px] text-steel">
            {item.catalogueRef} · {item.unit}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="col-span-2 flex flex-col gap-1 text-[11px] text-steel">
          Quantity driver
          <select
            className={inputClass}
            value={method}
            onChange={(event) => {
              onChange({ method: event.target.value as TakeoffInputMethod })
              setTimeout(onSave, 0)
            }}
          >
            <option value="count">Count</option>
            <option value="length">Length</option>
            <option value="area">Area (length × width)</option>
            <option value="volume">Volume (length × width × depth)</option>
            <option value="weight">Measured weight</option>
            <option value="time">Time</option>
            <option value="percent">Percentage</option>
            <option value="direct">Direct measured quantity</option>
          </select>
        </label>
        {method === 'count' && number('count', 'Count')}
        {['length', 'area', 'volume'].includes(method) &&
          number('count', 'Number (optional)')}
        {['length', 'area', 'volume'].includes(method) &&
          number('length', 'Length (m)')}
        {['area', 'volume'].includes(method) && number('width', 'Width (m)')}
        {method === 'volume' && number('depth', 'Depth / thickness (m)')}
        {method === 'percent' && number('percentage', 'Percentage (%)')}
        {['direct', 'weight', 'time'].includes(method) &&
          number('quantity', `Measured quantity (${item.unit})`)}
        {number('factor', 'Factor / allowance')}
        {number('wastePct', 'Waste / extra (%)')}
      </div>
      <div className="mt-2 text-right text-[10px] text-steel">
        {saving ? 'Saving…' : 'Saved on exit'}
      </div>
    </article>
  )
}
