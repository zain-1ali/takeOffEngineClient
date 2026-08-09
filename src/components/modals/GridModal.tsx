import { useEffect, useState } from 'react'
import { useAutosave } from '../../autosave/AutosaveContext'
import { GridPreview } from '../../grid/GridPreview'
import type { AxisLine, Project } from '../../types/api'
import { GhostButton, PrimaryButton } from '../ui'
import { Modal, inputClass } from './Modal'

function AxisEditor({
  title,
  axes,
  onChange,
}: {
  title: string
  axes: AxisLine[]
  onChange: (axes: AxisLine[]) => void
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-steel mb-2">{title}</p>
      <div className="space-y-2">
        {axes.map((a, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={`${inputClass} w-20`}
              value={a.label}
              onChange={(e) => {
                const next = axes.map((x, j) => (j === i ? { ...x, label: e.target.value } : x))
                onChange(next)
              }}
            />
            <input
              type="number"
              step={0.1}
              className={`${inputClass} flex-1`}
              value={a.spacing}
              onChange={(e) => {
                const next = axes.map((x, j) =>
                  j === i ? { ...x, spacing: Number(e.target.value) } : x,
                )
                onChange(next)
              }}
              title="Centre-to-centre spacing (m)"
            />
            <button
              type="button"
              className="text-xs text-danger px-1"
              onClick={() => onChange(axes.filter((_, j) => j !== i))}
              disabled={axes.length <= 1}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <GhostButton
        className="!text-xs !py-1.5 !px-3 mt-2"
        onClick={() => {
          const last = axes[axes.length - 1]
          const nextLabel = title.startsWith('X')
            ? String.fromCharCode((last?.label.charCodeAt(0) || 64) + 1)
            : String(Number(last?.label || 0) + 1)
          onChange([...axes, { label: nextLabel, spacing: last?.spacing || 6 }])
        }}
      >
        + Add axis
      </GhostButton>
    </div>
  )
}

export function GridModal({
  open,
  onClose,
  project,
}: {
  open: boolean
  onClose: () => void
  project: Project
}) {
  const { schedule, flush } = useAutosave()
  const [xAxes, setXAxes] = useState(project.grid.xAxes.map((a) => ({ ...a })))
  const [yAxes, setYAxes] = useState(project.grid.yAxes.map((a) => ({ ...a })))

  useEffect(() => {
    if (!open) return
    setXAxes(project.grid.xAxes.map((a) => ({ ...a })))
    setYAxes(project.grid.yAxes.map((a) => ({ ...a })))
  }, [open, project.id])

  function updateGrid(nextX: AxisLine[], nextY: AxisLine[]) {
    setXAxes(nextX)
    setYAxes(nextY)
    schedule({
      kind: 'project',
      projectId: project.id,
      patch: { grid: { xAxes: nextX, yAxes: nextY } },
    })
  }

  return (
    <Modal
      open={open}
      title="Axis grid"
      onClose={() => {
        void flush().finally(onClose)
      }}
      wide
    >
      <p className="text-xs text-steel mb-4">
        Spacings are centre-to-centre distances (m). Changes autosave.
      </p>
      <div className="grid sm:grid-cols-2 gap-6">
        <AxisEditor
          title="X axes (letters)"
          axes={xAxes}
          onChange={(axes) => updateGrid(axes, yAxes)}
        />
        <AxisEditor
          title="Y axes (numbers)"
          axes={yAxes}
          onChange={(axes) => updateGrid(xAxes, axes)}
        />
      </div>
      <div className="mt-5">
        <p className="text-xs uppercase tracking-wider text-steel mb-2">
          Plan preview
        </p>
        <GridPreview grid={{ xAxes, yAxes }} mode="preview" />
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
