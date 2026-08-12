import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  calculate,
  createInstance,
  deleteInstance,
  listInstances,
} from '../../api/projectsApi'
import { useAutosave } from '../../autosave/AutosaveContext'
import {
  allGeoCols,
  buildDefaultInstancePayload,
  type FieldDef,
} from '../../constants/elementSchemas'
import { ELEMENT_ENGINES } from '../../elementEngines'
import {
  convertQuantity,
  displayLengthLabel,
  displayOutputLabel,
  isMetricLengthLabel,
  lengthFromDisplay,
  lengthToDisplay,
  parseUnitSystem,
  type UnitSystem,
} from '../../lib/units'
import type { Instance, Project } from '../../types/api'
import {
  GridPlacementModal,
  type PointPlacementResult,
  type SpanPlacementResult,
} from '../modals/GridPlacementModal'
import { DataTable, GhostButton, PrimaryButton } from '../ui'
import { IfcImportPanel } from './IfcImportPanel'

const POINT_PLACEMENT_KEYS = new Set(['PAD_FOOTING', 'RAFT', 'COLUMNS'])
const SPAN_PLACEMENT_KEYS = new Set(['WALLS', 'BEAMS'])

function formatQty(v: unknown, dec: number): string {
  if (v == null || typeof v !== 'number' || Number.isNaN(v)) return '—'
  return v.toFixed(dec)
}

const fieldCls =
  'w-full min-w-[4.5rem] border border-steel-border bg-panel px-1.5 py-1 text-xs font-mono text-ink outline-none'

function ScheduleInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDef
  value: string | number
  onChange: (v: string | number) => void
  disabled?: boolean
}) {
  const cls = fieldCls
  if (field.type === 'select' && field.options) {
    return (
      <select
        className={cls}
        value={String(value)}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value
          const num = Number(raw)
          onChange(Number.isNaN(num) ? raw : num)
        }}
      >
        {field.options.map((o) => (
          <option key={String(o)} value={String(o)}>
            {o}
          </option>
        ))}
      </select>
    )
  }

  if (field.type === 'text') {
    return (
      <input
        className={cls}
        value={String(value ?? '')}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  return (
    <input
      type="number"
      className={cls}
      value={value === '' || value == null ? '' : Number(value)}
      min={field.min}
      max={field.max}
      step={field.step ?? (field.dec === 0 ? 1 : 0.05)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
    />
  )
}

export function ScheduleTab({
  project,
  floorId,
  elementKey,
}: {
  project: Project
  floorId: string
  elementKey: string
}) {
  const schema = ELEMENT_ENGINES[elementKey]
  const qc = useQueryClient()
  const projectId = project.id
  const { schedule, runImmediate } = useAutosave()
  const [placement, setPlacement] = useState<{
    mode: 'point' | 'span'
    shape: string
  } | null>(null)

  const instancesQuery = useQuery({
    queryKey: ['instances', projectId, floorId, elementKey],
    queryFn: () => listInstances(projectId, { floorId, elementKey }),
    enabled: !!schema,
  })

  const calcQuery = useQuery({
    queryKey: ['calculate', projectId, floorId, elementKey],
    queryFn: () => calculate(projectId, elementKey, floorId),
    enabled: !!schema && (instancesQuery.data?.instances.length ?? 0) >= 0,
  })

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['instances', projectId, floorId, elementKey] })
    void qc.invalidateQueries({ queryKey: ['calculate', projectId, floorId, elementKey] })
    void qc.invalidateQueries({ queryKey: ['instance-counts', projectId, floorId] })
    void qc.invalidateQueries({ queryKey: ['reports', projectId] })
  }, [qc, projectId, floorId, elementKey])

  const addMut = useMutation({
    mutationFn: (args: {
      shape: string
      geometryPatch?: Record<string, unknown>
    }) => {
      const seed = (instancesQuery.data?.instances.length ?? 0) + 1
      const body = buildDefaultInstancePayload(
        elementKey,
        args.shape,
        seed,
        project.materials.defaultConcreteGrade,
        floorId,
      )
      const geometry = {
        ...(body.geometry as Record<string, unknown>),
        ...(args.geometryPatch || {}),
      }
      return runImmediate(() =>
        createInstance(projectId, { ...body, geometry, floorId }),
      )
    },
    onSuccess: invalidate,
  })

  const delMut = useMutation({
    mutationFn: (id: string) => runImmediate(() => deleteInstance(projectId, id)),
    onSuccess: invalidate,
  })

  const schedulePatch = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      schedule({ kind: 'instance', projectId, instanceId: id, patch })
    },
    [schedule, projectId],
  )

  const instances = instancesQuery.data?.instances ?? []
  const resultsById = useMemo(() => {
    const m = new Map<string, Record<string, unknown>>()
    calcQuery.data?.results.forEach((r) => m.set(r.instanceId, r.result))
    return m
  }, [calcQuery.data])

  const totals = useMemo(() => {
    if (!schema) return {}
    const acc: Record<string, number> = {}
    schema.outputCols.forEach((col) => {
      acc[col.key] = 0
    })
    resultsById.forEach((result) => {
      schema.outputCols.forEach((col) => {
        const v = result[col.resultKey]
        if (typeof v === 'number') acc[col.key] += v
      })
    })
    return acc
  }, [schema, resultsById])

  const geoCols = schema ? allGeoCols(schema) : []
  const unitSystem = parseUnitSystem(project.units)

  if (!schema) {
    return (
      <div className="p-8 text-sm text-steel">
        This element is not implemented yet.
      </div>
    )
  }

  const labelColSpan =
    3 +
    (schema.hasGrade ? 1 : 0) +
    (schema.specList ? 1 : 0) +
    (schema.locationOptions ? 1 : 0) +
    geoCols.length +
    schema.rebarFields.length

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-6 py-5 flex-shrink-0 gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">
            {schema.label}
          </h1>
          <p className="text-[12.5px] text-steel mt-1">
            Schedule — floor <span className="font-mono text-ink">{floorId}</span>
            <span className="font-mono text-steel/70 ml-2">{elementKey}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {schema.addButtons.map((btn) =>
            btn.primary ? (
              <PrimaryButton
                key={btn.shape}
                disabled={addMut.isPending}
                onClick={() => addMut.mutate({ shape: btn.shape })}
                className="!text-xs !py-2"
              >
                {btn.label}
              </PrimaryButton>
            ) : (
              <GhostButton
                key={btn.shape}
                disabled={addMut.isPending}
                onClick={() => addMut.mutate({ shape: btn.shape })}
                className="!text-xs !py-2"
              >
                {btn.label}
              </GhostButton>
            ),
          )}
          {elementKey === 'WALLS' && (
            <IfcImportPanel
              projectId={projectId}
              floorId={floorId}
              onCommitted={invalidate}
            />
          )}
          {POINT_PLACEMENT_KEYS.has(elementKey) && (
            <GhostButton
              disabled={addMut.isPending}
              className="!text-xs !py-2"
              onClick={() =>
                setPlacement({
                  mode: 'point',
                  shape: schema.addButtons[0]?.shape || Object.keys(schema.shapes)[0],
                })
              }
            >
              Place at grid…
            </GhostButton>
          )}
          {SPAN_PLACEMENT_KEYS.has(elementKey) && (
            <GhostButton
              disabled={addMut.isPending}
              className="!text-xs !py-2"
              onClick={() =>
                setPlacement({
                  mode: 'span',
                  shape: schema.addButtons[0]?.shape || Object.keys(schema.shapes)[0],
                })
              }
            >
              Length from grid…
            </GhostButton>
          )}
        </div>
      </div>

      <GridPlacementModal
        open={!!placement}
        project={project}
        mode={placement?.mode || 'point'}
        title={
          placement?.mode === 'span'
            ? 'Auto-length between grid points'
            : 'Place at grid intersection'
        }
        onClose={() => setPlacement(null)}
        onConfirm={(result) => {
          if (!placement) return
          const geometryPatch =
            result.mode === 'point'
              ? pointGeometryPatch(result)
              : spanGeometryPatch(elementKey, result)
          addMut.mutate({ shape: placement.shape, geometryPatch })
          setPlacement(null)
        }}
      />

      <div className="flex-1 overflow-auto px-6 pb-8">
        {instancesQuery.isLoading && (
          <p className="text-sm text-steel p-4">Loading instances…</p>
        )}
        {!instancesQuery.isLoading && instances.length === 0 && (
          <div className="text-sm text-steel p-8 text-center border border-dashed border-steel-border">
            No instances on this floor. Use the buttons above to add one.
          </div>
        )}
        {instances.length > 0 && (
          <div className="panel-card !p-0 overflow-hidden">
            <DataTable compact>
              <DataTable.Header>
                <DataTable.Row>
                  <DataTable.HeaderCell>Mark</DataTable.HeaderCell>
                  <DataTable.HeaderCell>No.</DataTable.HeaderCell>
                  <DataTable.HeaderCell>Shape</DataTable.HeaderCell>
                  {schema.hasGrade && <DataTable.HeaderCell>Grade</DataTable.HeaderCell>}
                  {schema.specList && <DataTable.HeaderCell>Spec</DataTable.HeaderCell>}
                  {schema.locationOptions && (
                    <DataTable.HeaderCell>Location</DataTable.HeaderCell>
                  )}
                  {geoCols.map((c) => (
                    <DataTable.HeaderCell key={c.key}>
                      {displayLengthLabel(c.label, unitSystem)}
                    </DataTable.HeaderCell>
                  ))}
                  {schema.rebarFields.map((f) => (
                    <DataTable.HeaderCell key={f.key}>{f.label}</DataTable.HeaderCell>
                  ))}
                  {schema.outputCols.map((c) => (
                    <DataTable.HeaderCell
                      key={c.key}
                      align="right"
                      className={c.rebar ? 'text-chalk' : undefined}
                    >
                      {displayOutputLabel(c.label, c.unit, unitSystem)}
                    </DataTable.HeaderCell>
                  ))}
                  <DataTable.HeaderCell className="w-10" />
                </DataTable.Row>
              </DataTable.Header>
              <DataTable.Body>
                {instances.map((inst) => (
                  <InstanceRow
                    key={inst.id}
                    inst={inst}
                    schema={schema}
                    geoCols={geoCols}
                    grades={project.materials.concreteClasses}
                    result={resultsById.get(inst.id)}
                    unitSystem={unitSystem}
                    onPatch={(patch) => schedulePatch(inst.id, patch)}
                    onDelete={() => {
                      if (confirm(`Delete ${inst.mark}?`)) delMut.mutate(inst.id)
                    }}
                  />
                ))}
              </DataTable.Body>
              <DataTable.Footer>
                <DataTable.Row totals>
                  <DataTable.Cell colSpan={labelColSpan}>
                    Totals ({instances.reduce((s, i) => s + (i.count || 1), 0)} units)
                  </DataTable.Cell>
                  {schema.outputCols.map((c) => {
                    const raw = totals[c.key]
                    const shown =
                      typeof raw === 'number'
                        ? convertQuantity(raw, c.unit, unitSystem).value
                        : raw
                    return (
                      <DataTable.Cell
                        key={c.key}
                        numeric
                        className={c.rebar ? 'text-chalk' : 'text-ink font-semibold'}
                      >
                        {formatQty(shown, c.dec)}
                      </DataTable.Cell>
                    )
                  })}
                  <DataTable.Cell />
                </DataTable.Row>
              </DataTable.Footer>
            </DataTable>
          </div>
        )}
      </div>
    </div>
  )
}

function InstanceRow({
  inst,
  schema,
  geoCols,
  grades,
  result,
  unitSystem,
  onPatch,
  onDelete,
}: {
  inst: Instance
  schema: (typeof ELEMENT_ENGINES)[string]
  geoCols: { key: string; label: string }[]
  grades: string[]
  result?: Record<string, unknown>
  unitSystem: UnitSystem
  onPatch: (patch: Record<string, unknown>) => void
  onDelete: () => void
}) {
  const [local, setLocal] = useState(inst)
  useEffect(() => setLocal(inst), [inst])

  const shapeFields = schema.geometryByShape[local.shape] || []
  const shapeKeys = new Set(shapeFields.map((f) => f.key))

  function setGeo(key: string, value: unknown) {
    const geometry = { ...(local.geometry || {}), [key]: value }
    setLocal((l) => ({ ...l, geometry }))
    onPatch({ geometry })
  }

  function setRebar(key: string, value: unknown) {
    const reinforcement = { ...(local.reinforcement || {}), [key]: value }
    // Keep dist in sync when main changes (pad/strip/wall)
    if (key === 'bottomMainDia') reinforcement.bottomDistDia = value
    if (key === 'bottomMainSpacing') reinforcement.bottomDistSpacing = value
    if (key === 'mainDia') reinforcement.distDia = value
    if (key === 'vertDia') reinforcement.horizDia = value
    setLocal((l) => ({ ...l, reinforcement }))
    onPatch({ reinforcement })
  }

  function changeShape(shape: string) {
    const payload = buildDefaultInstancePayload(
      local.elementKey,
      shape,
      local.mark.replace(/^\D+/, '') || '1',
      local.concreteGrade || 'C25/30',
      local.floorId,
    )
    const geometry = payload.geometry as Record<string, unknown>
    const reinforcement = payload.reinforcement as Record<string, unknown> | null
    setLocal((l) => ({ ...l, shape, geometry, reinforcement }))
    onPatch({ shape, geometry, reinforcement })
  }

  return (
    <DataTable.Row>
      <DataTable.Cell className="sticky left-0 bg-bg">
        <input
          className={`${fieldCls} w-16`}
          value={local.mark}
          onChange={(e) => {
            setLocal((l) => ({ ...l, mark: e.target.value }))
            onPatch({ mark: e.target.value })
          }}
        />
        {gridLabel(local.geometry) && (
          <div className="mt-0.5 text-[10px] font-mono text-steel">
            {gridLabel(local.geometry)}
          </div>
        )}
      </DataTable.Cell>
      <DataTable.Cell className="w-14">
        <input
          type="number"
          min={1}
          className={fieldCls}
          value={local.count}
          onChange={(e) => {
            const count = Math.max(1, Number(e.target.value) || 1)
            setLocal((l) => ({ ...l, count }))
            onPatch({ count })
          }}
        />
      </DataTable.Cell>
      <DataTable.Cell>
        <select
          className={fieldCls}
          value={local.shape}
          onChange={(e) => changeShape(e.target.value)}
        >
          {Object.entries(schema.shapes).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </DataTable.Cell>
      {schema.hasGrade && (
        <DataTable.Cell>
          <select
            className={fieldCls}
            value={local.concreteGrade || ''}
            onChange={(e) => {
              setLocal((l) => ({ ...l, concreteGrade: e.target.value }))
              onPatch({ concreteGrade: e.target.value })
            }}
          >
            {grades.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </DataTable.Cell>
      )}
      {schema.specList && (
        <DataTable.Cell className="min-w-[10rem]">
          <select
            className={`w-full ${fieldCls}`}
            value={local.spec || ''}
            onChange={(e) => {
              setLocal((l) => ({ ...l, spec: e.target.value }))
              onPatch({ spec: e.target.value })
            }}
          >
            {schema.specList.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </DataTable.Cell>
      )}
      {schema.locationOptions && (
        <DataTable.Cell className="min-w-[8rem]">
          <select
            className={`w-full ${fieldCls}`}
            value={
              local.location ||
              schema.defaultLocation ||
              schema.locationOptions[0]
            }
            onChange={(e) => {
              const location = e.target.value
              setLocal((l) => ({ ...l, location }))
              onPatch({ location })
            }}
          >
            {schema.locationOptions.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </DataTable.Cell>
      )}
      {geoCols.map((col) => {
        const active = shapeKeys.has(col.key)
        const field = shapeFields.find((f) => f.key === col.key)
        const raw = local.geometry?.[col.key]
        if (col.key === 'hasBlinding') {
          return (
            <DataTable.Cell key={col.key}>
              {active ? (
                <input
                  type="checkbox"
                  checked={!!raw}
                  onChange={(e) => setGeo(col.key, e.target.checked)}
                  className="accent-signal"
                />
              ) : (
                <span className="text-steel/50">—</span>
              )}
            </DataTable.Cell>
          )
        }
        const lengthField = field && isMetricLengthLabel(field.label)
        const stored =
          typeof raw === 'number' ? raw : Number(field?.def ?? 0)
        const displayVal = lengthField
          ? lengthToDisplay(stored, unitSystem)
          : ((raw as number) ?? field?.def)
        return (
          <DataTable.Cell key={col.key}>
            {active && field ? (
              <ScheduleInput
                field={field}
                value={displayVal as number}
                onChange={(v) => {
                  const num = typeof v === 'number' ? v : Number(v)
                  setGeo(
                    col.key,
                    lengthField
                      ? Number(lengthFromDisplay(num || 0, unitSystem).toFixed(field.dec ?? 2))
                      : v,
                  )
                }}
              />
            ) : (
              <span className="text-steel/50">—</span>
            )}
          </DataTable.Cell>
        )
      })}
      {schema.rebarFields.map((field) => (
        <DataTable.Cell key={field.key}>
          <ScheduleInput
            field={field}
            value={(local.reinforcement?.[field.key] as number) ?? field.def}
            onChange={(v) => setRebar(field.key, v)}
          />
        </DataTable.Cell>
      ))}
      {schema.outputCols.map((c) => {
        const raw = result?.[c.resultKey]
        const shown =
          typeof raw === 'number'
            ? convertQuantity(raw, c.unit, unitSystem).value
            : raw
        return (
          <DataTable.Cell
            key={c.key}
            numeric
            className={c.rebar ? 'text-chalk' : undefined}
          >
            {formatQty(shown, c.dec)}
          </DataTable.Cell>
        )
      })}
      <DataTable.Cell>
        <button type="button" className="text-danger text-xs" onClick={onDelete}>
          ×
        </button>
      </DataTable.Cell>
    </DataTable.Row>
  )
}

function pointGeometryPatch(result: PointPlacementResult): Record<string, unknown> {
  return {
    gridX: result.gridX,
    gridY: result.gridY,
    gridRef: result.gridRef,
  }
}

function spanGeometryPatch(
  elementKey: string,
  result: SpanPlacementResult,
): Record<string, unknown> {
  const lengthKey = elementKey === 'BEAMS' ? 'spanLength' : 'length'
  return {
    [lengthKey]: Number(result.lengthM.toFixed(2)),
    gridStart: result.gridStart,
    gridEnd: result.gridEnd,
  }
}

function gridLabel(geometry?: Record<string, unknown> | null): string | null {
  if (!geometry) return null
  if (typeof geometry.gridRef === 'string' && geometry.gridRef) {
    return geometry.gridRef
  }
  if (
    typeof geometry.gridStart === 'string' &&
    typeof geometry.gridEnd === 'string' &&
    geometry.gridStart &&
    geometry.gridEnd
  ) {
    return `${geometry.gridStart}→${geometry.gridEnd}`
  }
  return null
}
