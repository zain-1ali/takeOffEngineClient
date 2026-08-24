import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchBlueprintPromotionOptions } from '../api/blueprintPromotions'
import type { PromotionMeasurementType } from '../api/blueprintPromotions'
import type { Floor } from '../types/api'

interface PromoteToElementDialogProps {
  projectId: string
  measurementType: PromotionMeasurementType
  sourceLabel: string
  value: number
  unit: string
  floors: Floor[]
  busy: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (input: { floorId: string; elementKey: string }) => void
}

export default function PromoteToElementDialog({
  projectId,
  measurementType,
  sourceLabel,
  value,
  unit,
  floors,
  busy,
  error,
  onCancel,
  onConfirm,
}: PromoteToElementDialogProps) {
  const [floorId, setFloorId] = useState(floors[0]?.floorId ?? '')
  const [elementKey, setElementKey] = useState('')
  const optionsQuery = useQuery({
    queryKey: ['blueprint-promotion-options', projectId, measurementType],
    queryFn: () =>
      fetchBlueprintPromotionOptions(projectId, measurementType),
  })
  const options = optionsQuery.data?.options ?? []

  useEffect(() => {
    if (!floorId && floors[0]) setFloorId(floors[0].floorId)
  }, [floorId, floors])

  useEffect(() => {
    if (!options.some((option) => option.elementKey === elementKey)) {
      setElementKey(options[0]?.elementKey ?? '')
    }
  }, [elementKey, options])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promote-dialog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <h2 id="promote-dialog-title" className="text-lg font-semibold text-white">
          Promote to Element
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {sourceLabel || 'Blueprint measurement'} · {value.toFixed(2)} {unit}
        </p>

        <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          Element type
          <select
            className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={elementKey}
            disabled={busy || optionsQuery.isLoading}
            onChange={(event) => setElementKey(event.target.value)}
          >
            {options.map((option) => (
              <option key={option.elementKey} value={option.elementKey}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          Floor
          <select
            className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={floorId}
            disabled={busy}
            onChange={(event) => setFloorId(event.target.value)}
          >
            {floors.map((floor) => (
              <option key={floor.id} value={floor.floorId}>
                {floor.label} ({floor.floorId})
              </option>
            ))}
          </select>
        </label>

        {optionsQuery.isError && (
          <p className="mt-3 text-sm text-red-400">
            Could not load compatible element types.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || !floorId || !elementKey || options.length === 0}
            onClick={() => onConfirm({ floorId, elementKey })}
          >
            {busy ? 'Promoting…' : 'Create Element'}
          </button>
        </div>
      </div>
    </div>
  )
}
