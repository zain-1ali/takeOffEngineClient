import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listInstances } from '../../api/projectsApi'
import { ELEMENT_ENGINES } from '../../elementEngines'
import { modelViewOptions } from '../../three/viewOptions'
import type { Project } from '../../types/api'
import { ModelViewport } from './ModelViewport'

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center justify-between gap-3 py-1.5 text-xs text-steel cursor-pointer hover:text-ink"
    >
      <span>{label}</span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-signal"
      />
    </label>
  )
}

export function ModelTab({
  project,
  floorId,
  elementKey,
}: {
  project: Project
  floorId: string
  elementKey: string
}) {
  const schema = ELEMENT_ENGINES[elementKey]
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showRebar, setShowRebar] = useState(modelViewOptions.showRebar)
  const [showDims, setShowDims] = useState(modelViewOptions.showDims)
  const [autoRotate, setAutoRotate] = useState(true)

  const instancesQuery = useQuery({
    queryKey: ['instances', project.id, floorId, elementKey],
    queryFn: () => listInstances(project.id, { floorId, elementKey }),
    enabled: !!schema,
  })

  const instances = instancesQuery.data?.instances ?? []
  const safeIndex =
    instances.length === 0 ? 0 : Math.min(selectedIndex, instances.length - 1)
  const selected = instances[safeIndex] || null

  const rebuildKey = useMemo(
    () => `${showRebar}-${showDims}-${selected?.id ?? 'none'}-${selected?.updatedAt ?? ''}`,
    [showRebar, showDims, selected],
  )

  function applyRebar(v: boolean) {
    modelViewOptions.showRebar = v
    setShowRebar(v)
  }
  function applyDims(v: boolean) {
    modelViewOptions.showDims = v
    setShowDims(v)
  }

  if (!schema) {
    return <div className="p-8 text-sm text-steel">3D is not available for this element yet.</div>
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-[220px] flex-shrink-0 border-r border-steel-border overflow-y-auto">
        <div className="panel-card !border-0 !rounded-none h-full">
          <h2 className="panel-card-title !text-[11px] !uppercase !tracking-[0.1em] !text-steel !font-medium !mb-3">
            {schema.label} instances
          </h2>
          {instancesQuery.isLoading && <p className="text-xs text-steel">Loading…</p>}
          {!instancesQuery.isLoading && instances.length === 0 && (
            <p className="text-xs text-steel/70">
              No instances on this floor. Add some in the Schedule tab.
            </p>
          )}
          <div className="space-y-0.5">
            {instances.map((inst, idx) => {
              const active = idx === safeIndex
              return (
                <button
                  key={inst.id}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-xs text-left border-l-2 ${
                    active
                      ? 'bg-panel-hover border-signal text-ink font-medium'
                      : 'border-transparent text-steel hover:bg-panel-hover/50 hover:text-ink'
                  }`}
                >
                  <span className="font-mono">
                    {inst.mark} ×{inst.count || 1}
                  </span>
                  <span className="text-[10px] opacity-70 truncate">
                    {schema.shapes[inst.shape]?.label || inst.shape}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-steel-border space-y-0.5">
            <p className="text-[10px] uppercase tracking-[0.1em] text-steel mb-1">View</p>
            <Toggle id="tgRebar" label="Reinforcement" checked={showRebar} onChange={applyRebar} />
            <Toggle id="tgDims" label="Dimensions" checked={showDims} onChange={applyDims} />
            <Toggle id="tgRotate" label="Auto-rotate" checked={autoRotate} onChange={setAutoRotate} />
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 min-h-0 p-5 flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="font-display text-xl font-semibold text-ink">
            3D Model
            {selected && (
              <span className="font-mono text-[11px] text-steel ml-2 font-normal">
                {selected.mark}
              </span>
            )}
          </h1>
          <p className="text-[11px] text-steel">Drag to orbit · scroll to zoom</p>
        </div>
        <div className="flex-1 min-h-0 border border-steel-border bg-panel overflow-hidden">
          <ModelViewport
            instance={instances[safeIndex] || null}
            elementKey={elementKey}
            blindingThickness={project.materials.blindingThickness ?? 0.05}
            rebuildKey={rebuildKey}
            autoRotate={autoRotate}
            onAutoRotateOff={() => setAutoRotate(false)}
          />
        </div>
      </div>
    </div>
  )
}
