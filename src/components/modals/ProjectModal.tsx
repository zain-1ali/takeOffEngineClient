import { useEffect, useState } from 'react'
import { useAutosave } from '../../autosave/AutosaveContext'
import type { Project } from '../../types/api'
import { PrimaryButton } from '../ui'
import { Field, Modal, inputClass } from './Modal'

export function ProjectModal({
  open,
  onClose,
  project,
}: {
  open: boolean
  onClose: () => void
  project: Project
}) {
  const { schedule, flush } = useAutosave()
  const [form, setForm] = useState({
    name: project.name,
    number: project.number,
    client: project.client,
    contractor: project.contractor,
    location: project.location,
    currency: project.currency,
    units: project.units,
    preparedBy: project.preparedBy,
    revision: project.revision,
    date: project.date,
  })
  const [earthworkBulkingPercent, setEarthworkBulkingPercent] = useState(
    (project.materials.earthworkBulkingFactor ?? 0.25) * 100,
  )

  useEffect(() => {
    if (!open) return
    setForm({
      name: project.name,
      number: project.number,
      client: project.client,
      contractor: project.contractor,
      location: project.location,
      currency: project.currency,
      units: project.units,
      preparedBy: project.preparedBy,
      revision: project.revision,
      date: project.date,
    })
    setEarthworkBulkingPercent(
      (project.materials.earthworkBulkingFactor ?? 0.25) * 100,
    )
  }, [open, project.id])

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((f) => {
      const next = { ...f, [key]: val }
      schedule({ kind: 'project', projectId: project.id, patch: { [key]: val } as Partial<Project> })
      return next
    })
  }

  function setBulkingPercent(value: number) {
    const safeValue = Math.max(0, value)
    setEarthworkBulkingPercent(safeValue)
    schedule({
      kind: 'project',
      projectId: project.id,
      patch: {
        materials: {
          ...project.materials,
          earthworkBulkingFactor: safeValue / 100,
        },
      },
    })
  }

  return (
    <Modal
      open={open}
      title="Project settings"
      onClose={() => {
        void flush().finally(onClose)
      }}
      wide
    >
      <p className="text-xs text-steel mb-3">Changes autosave to the server.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Project name">
          <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Number">
          <input className={inputClass} value={form.number} onChange={(e) => set('number', e.target.value)} />
        </Field>
        <Field label="Client">
          <input className={inputClass} value={form.client} onChange={(e) => set('client', e.target.value)} />
        </Field>
        <Field label="Contractor">
          <input
            className={inputClass}
            value={form.contractor}
            onChange={(e) => set('contractor', e.target.value)}
          />
        </Field>
        <Field label="Location">
          <input className={inputClass} value={form.location} onChange={(e) => set('location', e.target.value)} />
        </Field>
        <Field label="Currency">
          <select className={inputClass} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
            {['USD', 'EUR', 'GBP', 'RWF', 'KES', 'UGX'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Units">
          <input className={inputClass} value={form.units} onChange={(e) => set('units', e.target.value)} />
        </Field>
        <Field label="Prepared by">
          <input
            className={inputClass}
            value={form.preparedBy}
            onChange={(e) => set('preparedBy', e.target.value)}
          />
        </Field>
        <Field label="Revision">
          <input className={inputClass} value={form.revision} onChange={(e) => set('revision', e.target.value)} />
        </Field>
        <Field label="Date">
          <input type="date" className={inputClass} value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Earthworks bulking / disposal (%)">
          <input
            type="number"
            min={0}
            step={1}
            className={inputClass}
            value={earthworkBulkingPercent}
            onChange={(e) => setBulkingPercent(Number(e.target.value) || 0)}
          />
        </Field>
      </div>
      <div className="mt-5 flex justify-end">
        <PrimaryButton
          className="!text-sm !py-1.5 !px-4"
          onClick={() => {
            void flush().finally(onClose)
          }}
        >
          Done
        </PrimaryButton>
      </div>
    </Modal>
  )
}
