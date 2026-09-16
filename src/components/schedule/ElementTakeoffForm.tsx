import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getTakeoffInputSchema,
  getTakeoffInputSet,
  updateTakeoffInputSet,
} from '../../api/projectsApi'
import type { TakeoffDriverField } from '../../types/takeoffInputs'

const inputClass =
  'border border-steel-border bg-panel px-2 py-1.5 text-xs text-ink outline-none'

function defaultValue(field: TakeoffDriverField): number | boolean | '' {
  if (field.type === 'switch') return field.default == null ? false : Boolean(field.default)
  if (field.default == null) return ''
  const n = Number(field.default)
  return Number.isFinite(n) ? n : ''
}

function serializableShared(value: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (raw === '' || raw === undefined) continue
    out[key] = raw
  }
  return out
}

export function ElementTakeoffForm({
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
  const qc = useQueryClient()
  const schemaQuery = useQuery({
    queryKey: ['takeoff-schema', projectId, floorId, elementKey],
    queryFn: () => getTakeoffInputSchema(projectId, { floorId, elementKey }),
  })
  const persistFloorId = schemaQuery.data?.persistFloorId || floorId
  const setQuery = useQuery({
    queryKey: ['takeoff-inputs', projectId, persistFloorId, elementKey],
    queryFn: () =>
      getTakeoffInputSet(projectId, { floorId: persistFloorId, elementKey }),
    enabled: Boolean(schemaQuery.data),
  })

  const fields = schemaQuery.data?.fields || []
  const [shared, setShared] = useState<Record<string, unknown>>({})
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!schemaQuery.data) return
    const stored = setQuery.data?.inputSet.shared || {}
    const next: Record<string, unknown> = { ...stored }
    for (const field of schemaQuery.data.fields) {
      if (next[field.key] == null) next[field.key] = defaultValue(field)
    }
    setShared(next)
  }, [schemaQuery.data, setQuery.data])

  const save = useMutation({
    mutationFn: (value: Record<string, unknown>) =>
      updateTakeoffInputSet(
        projectId,
        { floorId: persistFloorId, elementKey },
        { shared: value },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports', projectId] })
      void qc.invalidateQueries({ queryKey: ['cost-plan', projectId] })
    },
  })

  function patch(key: string, value: unknown) {
    setShared((current) => {
      const next = { ...current, [key]: value }
      if (saveTimer.current != null) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(
        () => save.mutate(serializableShared(next)),
        400,
      )
      return next
    })
  }

  const groups = useMemo(() => {
    const map = new Map<string, TakeoffDriverField[]>()
    for (const field of fields) {
      const list = map.get(field.group) || []
      list.push(field)
      map.set(field.group, list)
    }
    return [...map.entries()]
  }, [fields])

  if (schemaQuery.isLoading || setQuery.isLoading) {
    return <p className="text-xs text-steel">Loading takeoff drivers…</p>
  }
  if (!schemaQuery.data?.selectedCount) {
    return (
      <div className="border border-dashed border-steel-border p-4 text-sm text-steel">
        Select BOQ work items first. Drivers needed to quantify them will appear
        here.
      </div>
    )
  }
  if (!groups.length) {
    return (
      <p className="text-sm text-steel">
        Selected items on this heading are quantified from the instance grid
        or Module 0 prelims.
      </p>
    )
  }

  return (
    <div className={compact ? 'mt-4' : ''}>
      {persistFloorId.startsWith('__') && (
        <div className="mb-2 text-[11px] uppercase tracking-wide text-signal">
          Project-wide inputs
        </div>
      )}
      <div className="space-y-3">
        {groups.map(([group, groupFields]) => {
          const refs = [
            ...new Set(groupFields.flatMap((field) => field.feeds || [])),
          ]
          return (
            <details
              key={group}
              open
              className="border border-steel-border bg-panel/30"
            >
              <summary className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink">
                {group}
              </summary>
              <div className="grid gap-3 border-t border-steel-border p-3 sm:grid-cols-2 lg:grid-cols-3">
                {groupFields.map((field) => (
                  <DriverControl
                    key={field.key}
                    field={field}
                    value={shared[field.key]}
                    onChange={(value) => patch(field.key, value)}
                  />
                ))}
              </div>
              {refs.length > 0 && (
                <p className="px-3 pb-3 text-[10px] text-steel">
                  Feeds BOQ {refs.join(', ')}
                </p>
              )}
            </details>
          )
        })}
      </div>
      <p className="mt-2 text-[10px] text-steel">
        {save.isPending ? 'Saving…' : 'Quantities update BOQ from these drivers.'}
      </p>
      {save.isError && (
        <p className="mt-1 text-xs text-danger">Could not save takeoff drivers.</p>
      )}
    </div>
  )
}

function DriverControl({
  field,
  value,
  onChange,
}: {
  field: TakeoffDriverField
  value: unknown
  onChange: (value: unknown) => void
}) {
  if (field.type === 'switch') {
    return (
      <label className="flex items-center gap-2 text-xs text-ink">
        <input
          type="checkbox"
          className="accent-signal"
          checked={value === true || value === 'true'}
          onChange={(event) => onChange(event.target.checked)}
        />
        {field.label}
      </label>
    )
  }
  const numeric = value == null || value === '' ? '' : String(value)
  return (
    <label className="flex flex-col gap-1 text-[11px] text-steel">
      {field.label}
      {field.unit ? ` (${field.unit})` : ''}
      <input
        type="number"
        min={0}
        step="any"
        className={inputClass}
        value={numeric}
        onChange={(event) => {
          const raw = event.target.value
          onChange(raw === '' ? 0 : Math.max(0, Number(raw)))
        }}
      />
    </label>
  )
}
