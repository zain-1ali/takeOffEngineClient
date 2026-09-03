import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchBlueprintPromotionOptions } from '../api/blueprintPromotions'
import type { PromotionMeasurementType } from '../api/blueprintPromotions'
import { listInstances } from '../api/projectsApi'
import { findRegisterEntry } from '../constants/elementRegister'
import {
  emptyCompatibleFloorsMessage,
  filterFloorsForElement,
} from '../lib/levelCompatibility'
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
  const [floorId, setFloorId] = useState('')
  const [elementKey, setElementKey] = useState('')
  const optionsQuery = useQuery({
    queryKey: ['blueprint-promotion-options', projectId, measurementType],
    queryFn: () =>
      fetchBlueprintPromotionOptions(projectId, measurementType),
  })
  const options = optionsQuery.data?.options ?? []
  const registerEntry = useMemo(
    () => findRegisterEntry(elementKey),
    [elementKey],
  )

  const elementFloorsQuery = useQuery({
    queryKey: ['element-floor-ids', projectId, elementKey],
    queryFn: async () => {
      const { instances } = await listInstances(projectId, { elementKey })
      return new Set(instances.map((i) => i.floorId))
    },
    enabled: !!projectId && !!elementKey,
  })

  const floorOptions = useMemo(
    () =>
      filterFloorsForElement({
        floors,
        allowedLevelTypes: registerEntry?.allowedLevelTypes,
        floorIdsWithElementInstances: elementFloorsQuery.data ?? new Set(),
      }),
    [floors, registerEntry?.allowedLevelTypes, elementFloorsQuery.data],
  )

  useEffect(() => {
    if (!options.some((option) => option.elementKey === elementKey)) {
      setElementKey(options[0]?.elementKey ?? '')
    }
  }, [elementKey, options])

  useEffect(() => {
    if (floorOptions.length === 0) {
      setFloorId('')
      return
    }
    if (!floorOptions.some((f) => f.floorId === floorId)) {
      setFloorId(floorOptions[0].floorId)
    }
  }, [floorOptions, floorId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md border border-steel-border bg-panel p-4 shadow-lg">
        <h2 className="font-display text-lg font-semibold text-ink">
          Promote measurement
        </h2>
        <p className="mt-1 text-xs text-steel">
          {sourceLabel}: {value} {unit}
        </p>

        <label className="mt-4 block text-xs text-steel">
          Element
          <select
            className="mt-1 w-full border border-steel-border bg-bg px-2 py-1.5 text-sm text-ink"
            value={elementKey}
            disabled={busy || options.length === 0}
            onChange={(event) => setElementKey(event.target.value)}
          >
            {options.map((option) => (
              <option key={option.elementKey} value={option.elementKey}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-xs text-steel">
          Floor
          {floorOptions.length === 0 ? (
            <p className="mt-1 text-amber-200/90">
              {emptyCompatibleFloorsMessage({
                elementLabel:
                  options.find((o) => o.elementKey === elementKey)?.label ||
                  elementKey ||
                  'this element',
                allowedLevelTypes: registerEntry?.allowedLevelTypes,
              })}
            </p>
          ) : (
            <select
              className="mt-1 w-full border border-steel-border bg-bg px-2 py-1.5 text-sm text-ink font-mono"
              value={floorId}
              disabled={busy}
              onChange={(event) => setFloorId(event.target.value)}
            >
              {floorOptions.map((floor) => (
                <option key={floor.id} value={floor.floorId}>
                  {floor.exception ? '⚠ ' : ''}
                  {floor.label} ({floor.floorId})
                  {floor.exception ? ' — flagged' : ''}
                </option>
              ))}
            </select>
          )}
        </label>

        {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="border border-steel-border px-3 py-1.5 text-xs text-steel"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="border border-signal bg-signal/20 px-3 py-1.5 text-xs text-ink disabled:opacity-40"
            disabled={busy || !floorId || !elementKey || options.length === 0}
            onClick={() => {
              const target = floorOptions.find((f) => f.floorId === floorId)
              if (target && !target.compatible) {
                const label =
                  options.find((o) => o.elementKey === elementKey)?.label ||
                  elementKey
                if (
                  !confirm(
                    `This floor doesn't typically support ${label} — continue anyway?`,
                  )
                ) {
                  return
                }
              }
              onConfirm({ floorId, elementKey })
            }}
          >
            {busy ? 'Promoting…' : 'Promote'}
          </button>
        </div>
      </div>
    </div>
  )
}
