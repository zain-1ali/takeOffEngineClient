import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { duplicateFloor, listInstances } from '../../api/projectsApi'
import { useAutosave } from '../../autosave/AutosaveContext'
import type { Floor } from '../../types/api'
import { GhostButton, PrimaryButton } from '../ui'
import { Field, Modal, inputClass } from './Modal'

type TargetMode = 'new' | 'existing'

export function DuplicateFloorModal({
  open,
  onClose,
  projectId,
  floors,
  /** Full-floor mode when set. */
  sourceFloorId,
  /** Selected-instance mode when set (non-empty). */
  instanceIds,
  title,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  floors: Floor[]
  sourceFloorId?: string
  instanceIds?: string[]
  title?: string
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

  const candidateFloors = useMemo(() => {
    if (selectedMode) {
      return floors.filter((f) => f.floorId !== sourceFloorId)
    }
    return floors.filter(
      (f) => f.floorId !== sourceFloorId && emptyFloorIds.includes(f.floorId),
    )
  }, [floors, sourceFloorId, selectedMode, emptyFloorIds])

  useEffect(() => {
    if (!open) return
    setError(null)
    setTargetMode('new')
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
            ? { newFloor: draft }
            : { targetFloorId: existingFloorId }),
        }),
      ),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['project', projectId] })
      await qc.invalidateQueries({ queryKey: ['instances', projectId] })
      await qc.invalidateQueries({ queryKey: ['calculate', projectId] })
      await qc.invalidateQueries({ queryKey: ['instance-counts', projectId] })
      await qc.invalidateQueries({ queryKey: ['reports', projectId] })
      onClose()
      alert(
        `Copied ${res.copiedCount} instance${res.copiedCount === 1 ? '' : 's'} to ${res.targetFloorId}. Quantities recalculated on the target floor.`,
      )
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : 'Duplication failed')
    },
  })

  const canSubmit =
    (selectedMode ? (instanceIds?.length ?? 0) > 0 : Boolean(sourceFloorId)) &&
    (targetMode === 'new'
      ? Boolean(draft.floorId.trim() && draft.label.trim())
      : Boolean(existingFloorId))

  return (
    <Modal
      open={open}
      title={title || (selectedMode ? 'Duplicate selected to floor' : 'Duplicate floor')}
      onClose={onClose}
      layer={1}
    >
      <p className="text-xs text-steel mb-3">
        Copies shape, geometry, grade/spec, reinforcement, and grid placement refs.
        Quantities are recalculated on the target (not copied).
        {selectedMode
          ? ` ${instanceIds!.length} selected instance${instanceIds!.length === 1 ? '' : 's'}.`
          : ` Source: ${sourceFloorId}. Target must be new or empty.`}
      </p>

      <div className="flex gap-2 mb-3">
        <GhostButton
          type="button"
          className={`!text-xs !py-1.5 ${targetMode === 'new' ? '!border-signal' : ''}`}
          onClick={() => setTargetMode('new')}
        >
          New floor
        </GhostButton>
        <GhostButton
          type="button"
          className={`!text-xs !py-1.5 ${targetMode === 'existing' ? '!border-signal' : ''}`}
          onClick={() => setTargetMode('existing')}
        >
          Existing {selectedMode ? 'floor' : 'empty floor'}
        </GhostButton>
      </div>

      {targetMode === 'new' ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="New ID">
            <input
              className={inputClass}
              value={draft.floorId}
              onChange={(e) => setDraft((d) => ({ ...d, floorId: e.target.value }))}
            />
          </Field>
          <Field label="Label">
            <input
              className={inputClass}
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            />
          </Field>
          <Field label="Elevation">
            <input
              type="number"
              step={0.1}
              className={inputClass}
              value={draft.elevation}
              onChange={(e) =>
                setDraft((d) => ({ ...d, elevation: Number(e.target.value) }))
              }
            />
          </Field>
          <Field label="Height">
            <input
              type="number"
              step={0.1}
              className={inputClass}
              value={draft.height}
              onChange={(e) =>
                setDraft((d) => ({ ...d, height: Number(e.target.value) }))
              }
            />
          </Field>
        </div>
      ) : (
        <Field label={selectedMode ? 'Target floor' : 'Empty target floor'}>
          <select
            className={inputClass}
            value={existingFloorId}
            onChange={(e) => setExistingFloorId(e.target.value)}
          >
            <option value="">Select…</option>
            {candidateFloors.map((f) => (
              <option key={f.id} value={f.floorId}>
                {f.floorId} — {f.label}
              </option>
            ))}
          </select>
          {!selectedMode && candidateFloors.length === 0 && (
            <p className="text-[11px] text-steel mt-1">
              No empty floors available — create a new floor instead.
            </p>
          )}
        </Field>
      )}

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
            mut.mutate()
          }}
        >
          {mut.isPending ? 'Copying…' : 'Duplicate'}
        </PrimaryButton>
      </div>
    </Modal>
  )
}
