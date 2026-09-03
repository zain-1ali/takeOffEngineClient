import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFloor, deleteFloor } from '../../api/projectsApi'
import { useAutosave } from '../../autosave/AutosaveContext'
import {
  CLIENT_FLOOR_NAMING,
  FLOOR_LEVEL_TYPES,
  inferFloorLevelTypes,
  suggestedSortOrderForFloorId,
  type FloorLevelType,
} from '../../lib/levelCompatibility'
import type { Floor } from '../../types/api'
import { NumericInput, PrimaryButton } from '../ui'
import { DuplicateFloorModal } from './DuplicateFloorModal'
import { Field, Modal, inputClass } from './Modal'

export function FloorsModal({
  open,
  onClose,
  projectId,
  floors,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  floors: Floor[]
}) {
  const qc = useQueryClient()
  const { schedule, runImmediate, flush } = useAutosave()
  const [draft, setDraft] = useState({
    floorId: '',
    label: '',
    elevation: 0,
    height: 3,
    levelTypes: ['Above-Grade'] as FloorLevelType[],
  })
  const [duplicateSource, setDuplicateSource] = useState<string | null>(null)

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['project', projectId] })

  const add = useMutation({
    mutationFn: () => {
      const levelTypes =
        draft.levelTypes.length > 0
          ? draft.levelTypes
          : inferFloorLevelTypes(draft.floorId, draft.label)
      const sortOrder = suggestedSortOrderForFloorId(draft.floorId)
      return runImmediate(() =>
        createFloor(projectId, {
          floorId: draft.floorId,
          label: draft.label,
          elevation: draft.elevation,
          height: draft.height,
          levelTypes,
          ...(sortOrder != null ? { sortOrder } : {}),
        }),
      )
    },
    onSuccess: () => {
      setDraft({
        floorId: '',
        label: '',
        elevation: 0,
        height: 3,
        levelTypes: ['Above-Grade'],
      })
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => runImmediate(() => deleteFloor(projectId, id)),
    onSuccess: invalidate,
  })

  function patchFloor(id: string, body: Partial<Floor>) {
    schedule({ kind: 'floor', projectId, floorDocId: id, patch: body })
  }

  function toggleDraftType(t: FloorLevelType) {
    setDraft((d) => {
      const has = d.levelTypes.includes(t)
      const next = has
        ? d.levelTypes.filter((x) => x !== t)
        : [...d.levelTypes, t]
      return { ...d, levelTypes: next.length ? next : d.levelTypes }
    })
  }

  return (
    <>
      <Modal
        open={open}
        title="Floors"
        onClose={() => {
          void flush().finally(onClose)
        }}
        wide
        closeOnEscape={!duplicateSource}
      >
        <p className="text-xs text-steel mb-3">
          Changes autosave. A floor can have multiple level types (e.g. Foundation +
          Below-Grade). IDs follow the client naming sheet when possible (RF, 00–06,
          FND, and abbreviations like GF, L01, TOF). Deleting a floor removes all
          element instances on that floor.
        </p>
        <div className="overflow-x-auto border border-steel-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-steel text-xs border-b border-steel-border">
                <th className="p-2">ID</th>
                <th className="p-2">Label</th>
                <th className="p-2">Level types</th>
                <th className="p-2">Elev.</th>
                <th className="p-2">Height</th>
                <th className="p-2 w-40" />
              </tr>
            </thead>
            <tbody>
              {floors.map((f) => (
                <FloorRow
                  key={f.id}
                  floor={f}
                  onPatch={(body) => patchFloor(f.id, body)}
                  onDuplicate={() => setDuplicateSource(f.floorId)}
                  onDelete={() => {
                    if (confirm(`Delete floor ${f.floorId}? Instances on it will be removed.`)) {
                      remove.mutate(f.id)
                    }
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
          <Field label="New ID">
            <input
              className={inputClass}
              value={draft.floorId}
              onChange={(e) => {
                const floorId = e.target.value
                const known = CLIENT_FLOOR_NAMING.find(
                  (row) =>
                    row.sortPrefix === floorId.trim().toUpperCase() ||
                    row.abbreviations.some(
                      (a) => a === floorId.trim().toUpperCase(),
                    ),
                )
                setDraft((d) => ({
                  ...d,
                  floorId,
                  label: known ? known.levelName : d.label,
                  levelTypes: inferFloorLevelTypes(
                    floorId,
                    known ? known.levelName : d.label,
                  ),
                }))
              }}
            />
          </Field>
          <Field label="Label">
            <input
              className={inputClass}
              value={draft.label}
              onChange={(e) => {
                const label = e.target.value
                setDraft((d) => ({
                  ...d,
                  label,
                  levelTypes: inferFloorLevelTypes(d.floorId, label),
                }))
              }}
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
              onChange={(n) => setDraft((d) => ({ ...d, height: n ?? 0 }))}
            />
          </Field>
        </div>
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-wide text-steel mb-1">
            Level types (at least one)
          </div>
          <div className="flex flex-wrap gap-3">
            {FLOOR_LEVEL_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-xs text-ink">
                <input
                  type="checkbox"
                  checked={draft.levelTypes.includes(t)}
                  onChange={() => toggleDraftType(t)}
                />
                {t}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <PrimaryButton
            disabled={
              !draft.floorId.trim() ||
              !draft.label.trim() ||
              draft.levelTypes.length < 1 ||
              add.isPending
            }
            onClick={() => add.mutate()}
            className="!text-sm !py-1.5 !px-4"
          >
            Add floor
          </PrimaryButton>
        </div>
      </Modal>

      <DuplicateFloorModal
        open={!!duplicateSource}
        onClose={() => setDuplicateSource(null)}
        projectId={projectId}
        floors={floors}
        sourceFloorId={duplicateSource || undefined}
        title="Duplicate floor"
      />
    </>
  )
}

function FloorRow({
  floor,
  onPatch,
  onDuplicate,
  onDelete,
}: {
  floor: Floor
  onPatch: (body: Partial<Floor>) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [label, setLabel] = useState(floor.label)
  const [elevation, setElevation] = useState(floor.elevation)
  const [height, setHeight] = useState(floor.height)
  const [levelTypes, setLevelTypes] = useState<FloorLevelType[]>(
    () => floor.levelTypes ?? inferFloorLevelTypes(floor.floorId, floor.label),
  )

  useEffect(() => {
    setLabel(floor.label)
    setElevation(floor.elevation)
    setHeight(floor.height)
    setLevelTypes(
      floor.levelTypes?.length
        ? floor.levelTypes
        : inferFloorLevelTypes(floor.floorId, floor.label),
    )
  }, [floor])

  function toggleType(t: FloorLevelType) {
    setLevelTypes((prev) => {
      const has = prev.includes(t)
      const next = has ? prev.filter((x) => x !== t) : [...prev, t]
      if (next.length < 1) return prev
      onPatch({ levelTypes: next })
      return next
    })
  }

  return (
    <tr className="border-b border-steel-border">
      <td className="p-2 font-mono text-xs">{floor.floorId}</td>
      <td className="p-2">
        <input
          className={inputClass}
          value={label}
          onChange={(e) => {
            setLabel(e.target.value)
            onPatch({ label: e.target.value })
          }}
        />
      </td>
      <td className="p-2 min-w-[11rem]">
        <div className="flex flex-col gap-0.5">
          {FLOOR_LEVEL_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-1 text-[11px] text-ink">
              <input
                type="checkbox"
                checked={levelTypes.includes(t)}
                onChange={() => toggleType(t)}
              />
              {t}
            </label>
          ))}
        </div>
      </td>
      <td className="p-2 w-24">
        <NumericInput
          className={inputClass}
          value={elevation}
          emptyValue={0}
          showError={false}
          onChange={(n) => {
            const v = n ?? 0
            setElevation(v)
            onPatch({ elevation: v })
          }}
        />
      </td>
      <td className="p-2 w-24">
        <NumericInput
          className={inputClass}
          value={height}
          emptyValue={0}
          showError={false}
          onChange={(n) => {
            const v = n ?? 0
            setHeight(v)
            onPatch({ height: v })
          }}
        />
      </td>
      <td className="p-2 whitespace-nowrap">
        <button
          type="button"
          className="text-xs text-signal-text mr-2"
          onClick={onDuplicate}
        >
          Duplicate
        </button>
        <button type="button" className="text-xs text-danger" onClick={onDelete}>
          Delete
        </button>
      </td>
    </tr>
  )
}
