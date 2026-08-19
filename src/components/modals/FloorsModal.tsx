import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFloor, deleteFloor } from '../../api/projectsApi'
import { useAutosave } from '../../autosave/AutosaveContext'
import type { Floor } from '../../types/api'
import { PrimaryButton } from '../ui'
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
  const [draft, setDraft] = useState({ floorId: '', label: '', elevation: 0, height: 3 })
  const [duplicateSource, setDuplicateSource] = useState<string | null>(null)

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['project', projectId] })

  const add = useMutation({
    mutationFn: () => runImmediate(() => createFloor(projectId, draft)),
    onSuccess: () => {
      setDraft({ floorId: '', label: '', elevation: 0, height: 3 })
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
          Changes autosave. Deleting a floor removes all element instances on that floor.
        </p>
        <div className="overflow-x-auto border border-steel-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-steel text-xs border-b border-steel-border">
                <th className="p-2">ID</th>
                <th className="p-2">Label</th>
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
              onChange={(e) => setDraft((d) => ({ ...d, height: Number(e.target.value) }))}
            />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <PrimaryButton
            disabled={!draft.floorId.trim() || !draft.label.trim() || add.isPending}
            onClick={() => add.mutate()}
            className="!text-sm !py-1.5 !px-4"
          >
            Add floor
          </PrimaryButton>
        </div>
      </Modal>

      {/* Sibling (not nested) so the dialog is not clipped by Floors overflow. */}
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

  useEffect(() => {
    setLabel(floor.label)
    setElevation(floor.elevation)
    setHeight(floor.height)
  }, [floor])

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
      <td className="p-2 w-24">
        <input
          type="number"
          step={0.1}
          className={inputClass}
          value={elevation}
          onChange={(e) => {
            const v = Number(e.target.value)
            setElevation(v)
            onPatch({ elevation: v })
          }}
        />
      </td>
      <td className="p-2 w-24">
        <input
          type="number"
          step={0.1}
          className={inputClass}
          value={height}
          onChange={(e) => {
            const v = Number(e.target.value)
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
