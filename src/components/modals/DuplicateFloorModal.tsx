import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  duplicateFloor,
  listInstances,
  type DuplicateFloorResult,
} from '../../api/projectsApi'
import { useAutosave } from '../../autosave/AutosaveContext'
import { findRegisterEntry } from '../../constants/elementRegister'
import {
  emptyCompatibleFloorsMessage,
  filterFloorsForElement,
  inferFloorLevelTypes,
} from '../../lib/levelCompatibility'
import type { Floor } from '../../types/api'
import { GhostButton, NumericInput, PrimaryButton } from '../ui'
import { Field, Modal, inputClass } from './Modal'

type TargetMode = 'new' | 'existing' | 'same'

export function DuplicateFloorModal({
  open,
  onClose,
  projectId,
  floors,
  /** Full-floor mode when set. */
  sourceFloorId,
  /** Selected-instance mode when set (non-empty). */
  instanceIds,
  /** When set (schedule selected mode), filter targets by element compatibility. */
  elementKey,
  title,
  onCopied,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  floors: Floor[]
  sourceFloorId?: string
  instanceIds?: string[]
  elementKey?: string
  title?: string
  onCopied?: (result: DuplicateFloorResult) => void
}) {
  const qc = useQueryClient()
  const { runImmediate } = useAutosave()
  const selectedMode = Boolean(instanceIds?.length)
  const [targetMode, setTargetMode] = useState<TargetMode>('new')
  const [existingFloorId, setExistingFloorId] = useState('')
  const [draft, setDraft] = useState({
    floorId: '',
    label: '',
    elevation: 0,
    height: 3,
  })
  const [error, setError] = useState<string | null>(null)
  const [emptyFloorIds, setEmptyFloorIds] = useState<string[]>([])

  const registerEntry = useMemo(
    () => (elementKey ? findRegisterEntry(elementKey) : undefined),
    [elementKey],
  )

  const elementFloorsQuery = useQuery({
    queryKey: ['element-floor-ids', projectId, elementKey],
    queryFn: async () => {
      const { instances } = await listInstances(projectId, { elementKey })
      return new Set(instances.map((i) => i.floorId))
    },
    enabled: open && selectedMode && !!projectId && !!elementKey,
  })

  const filteredForElement = useMemo(() => {
    if (!selectedMode || !elementKey) return null
    return filterFloorsForElement({
      floors,
      allowedLevelTypes: registerEntry?.allowedLevelTypes,
      floorIdsWithElementInstances: elementFloorsQuery.data ?? new Set(),
    })
  }, [
    selectedMode,
    elementKey,
    floors,
    registerEntry?.allowedLevelTypes,
    elementFloorsQuery.data,
  ])

  const candidateFloors = useMemo(() => {
    if (selectedMode) {
      const base = floors.filter((f) => f.floorId !== sourceFloorId)
      if (!filteredForElement) return base
      const allowed = new Set(filteredForElement.map((f) => f.floorId))
      return base.filter((f) => allowed.has(f.floorId))
    }
    return floors.filter(
      (f) => f.floorId !== sourceFloorId && emptyFloorIds.includes(f.floorId),
    )
  }, [floors, sourceFloorId, selectedMode, emptyFloorIds, filteredForElement])

  const candidateMeta = useMemo(() => {
    const map = new Map<string, { exception: boolean }>()
    if (filteredForElement) {
      for (const f of filteredForElement) {
        map.set(f.floorId, { exception: f.exception })
      }
    }
    return map
  }, [filteredForElement])

  useEffect(() => {
    if (!open) return
    setError(null)
    setTargetMode(selectedMode ? 'same' : 'new')
    setExistingFloorId('')
    const taken = new Set(floors.map((f) => f.floorId))
    const base =
      sourceFloorId && !selectedMode
        ? `${sourceFloorId}-COPY`
        : `L${String(floors.length + 1).padStart(2, '0')}`
    let seed = base
    let n = 2
    while (taken.has(seed)) {
      seed = `${base}-${n}`
      n += 1
    }
    setDraft({
      floorId: seed,
      label: sourceFloorId && !selectedMode ? `${sourceFloorId} copy` : 'New Level',
      elevation: 0,
      height: 3,
    })
  }, [open, sourceFloorId, selectedMode, floors])

  useEffect(() => {
    if (!open || selectedMode) return
    let cancelled = false
    ;(async () => {
      const empty: string[] = []
      for (const f of floors) {
        if (f.floorId === sourceFloorId) continue
        try {
          const res = await listInstances(projectId, { floorId: f.floorId })
          if (res.instances.length === 0) empty.push(f.floorId)
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setEmptyFloorIds(empty)
    })()
    return () => {
      cancelled = true
    }
  }, [open, selectedMode, floors, projectId, sourceFloorId])

  const mut = useMutation({
    mutationFn: () =>
      runImmediate(() =>
        duplicateFloor(projectId, {
          ...(selectedMode
            ? { instanceIds }
            : { sourceFloorId: sourceFloorId! }),
          ...(targetMode === 'new'
            ? {
                newFloor: {
                  ...draft,
                  levelTypes: inferFloorLevelTypes(draft.floorId, draft.label),
                },
              }
            : {
                targetFloorId:
                  targetMode === 'same' ? sourceFloorId : existingFloorId,
              }),
        }),
      ),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['project', projectId] })
      await qc.invalidateQueries({ queryKey: ['instances', projectId] })
      await qc.invalidateQueries({ queryKey: ['calculate', projectId] })
      await qc.invalidateQueries({ queryKey: ['element-floor-ids', projectId] })
      onCopied?.(res)
      onClose()
    },
    onError: (err: Error) => setError(err.message || 'Duplicate failed'),
  })

  const canSubmit =
    (selectedMode ? (instanceIds?.length ?? 0) > 0 : Boolean(sourceFloorId)) &&
    (targetMode === 'new'
      ? Boolean(draft.floorId.trim() && draft.label.trim())
      : targetMode === 'same'
        ? Boolean(sourceFloorId)
        : Boolean(existingFloorId))

  return (
    <Modal
      open={open}
      title={title || (selectedMode ? 'Duplicate selected to floor' : 'Duplicate floor')}
      onClose={onClose}
    >
      <p className="text-xs text-steel mb-3">
        {selectedMode
          ? ` ${instanceIds!.length} selected instance${instanceIds!.length === 1 ? '' : 's'}. Same-floor copies get a new mark (C1→C2) and a cleared grid ref.`
          : ' Copies all instances on the source floor onto a new or empty floor.'}
      </p>

      <div className="flex flex-wrap gap-3 text-xs mb-3">
        {selectedMode ? (
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={targetMode === 'same'}
              onChange={() => setTargetMode('same')}
            />
            This floor
          </label>
        ) : null}
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={targetMode === 'new'}
            onChange={() => setTargetMode('new')}
          />
          New floor
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={targetMode === 'existing'}
            onChange={() => setTargetMode('existing')}
          />
          Existing {selectedMode ? 'floor' : 'empty floor'}
        </label>
      </div>

      {targetMode === 'new' ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="New ID">
            <input
              className={inputClass}
              value={draft.floorId}
              onChange={(e) =>
                setDraft((d) => ({ ...d, floorId: e.target.value }))
              }
            />
          </Field>
          <Field label="Label">
            <input
              className={inputClass}
              value={draft.label}
              onChange={(e) =>
                setDraft((d) => ({ ...d, label: e.target.value }))
              }
            />
          </Field>
          <Field label="Elevation">
            <NumericInput
              className={inputClass}
              value={draft.elevation}
              emptyValue={0}
              onChange={(n) =>
                setDraft((d) => ({ ...d, elevation: n ?? 0 }))
              }
            />
          </Field>
          <Field label="Height">
            <NumericInput
              className={inputClass}
              value={draft.height}
              emptyValue={0}
              onChange={(n) =>
                setDraft((d) => ({ ...d, height: n ?? 0 }))
              }
            />
          </Field>
        </div>
      ) : targetMode === 'existing' ? (
        <Field label={selectedMode ? 'Target floor' : 'Empty target floor'}>
          {selectedMode && candidateFloors.length === 0 ? (
            <p className="text-[11px] text-amber-200/90 mt-1">
              {emptyCompatibleFloorsMessage({
                elementLabel:
                  registerEntry?.label || elementKey || 'this element',
                allowedLevelTypes: registerEntry?.allowedLevelTypes,
              })}
            </p>
          ) : (
            <select
              className={inputClass}
              value={existingFloorId}
              onChange={(e) => setExistingFloorId(e.target.value)}
            >
              <option value="">Select…</option>
              {candidateFloors.map((f) => {
                const meta = candidateMeta.get(f.floorId)
                return (
                  <option key={f.id} value={f.floorId}>
                    {meta?.exception ? '⚠ ' : ''}
                    {f.floorId} — {f.label}
                    {meta?.exception ? ' (flagged)' : ''}
                  </option>
                )
              })}
            </select>
          )}
          {!selectedMode && candidateFloors.length === 0 && (
            <p className="text-[11px] text-steel mt-1">
              No empty floors available — create a new floor instead.
            </p>
          )}
        </Field>
      ) : null}

      {error && <p className="text-xs text-danger mt-3">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <GhostButton type="button" className="!text-xs" onClick={onClose}>
          Cancel
        </GhostButton>
        <PrimaryButton
          type="button"
          className="!text-sm !py-1.5 !px-4"
          disabled={!canSubmit || mut.isPending}
          onClick={() => {
            setError(null)
            if (selectedMode && targetMode === 'existing' && existingFloorId) {
              const meta = candidateMeta.get(existingFloorId)
              if (meta?.exception) {
                const label =
                  registerEntry?.label || elementKey || 'this element'
                if (
                  !confirm(
                    `This floor doesn't typically support ${label} — continue anyway?`,
                  )
                ) {
                  return
                }
              }
            }
            mut.mutate()
          }}
        >
          {mut.isPending
            ? 'Copying…'
            : targetMode === 'same'
              ? 'Duplicate on this floor'
              : 'Duplicate'}
        </PrimaryButton>
      </div>
    </Modal>
  )
}
