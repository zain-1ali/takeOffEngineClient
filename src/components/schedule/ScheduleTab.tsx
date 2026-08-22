import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
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
import { analyseRate } from '../../lib/analyseRate'
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
import type { Floor, Instance, Project } from '../../types/api'
import { DuplicateFloorModal } from '../modals/DuplicateFloorModal'
import { OpeningsTableModal } from '../modals/OpeningsTableModal'
import { StairSegmentsModal } from '../modals/StairSegmentsModal'
import {
  BAR_GROUP_LEGACY,
  BarGroupsScheduleCell,
  syncLegacyBarGroups,
  type BarGroup,
} from './LongBarsScheduleCell'
import {
  MESH_GROUP_LEGACY,
  MeshBarsScheduleCell,
  syncLegacyMeshGroups,
  type MeshBarGroup,
} from './MeshBarsScheduleCell'
import { RebarInactiveCell } from './RebarGroupsEditorShell'
import { rebarFieldInactiveReason } from './rebarFieldVisibility'
import {
  GridPlacementModal,
  type PointPlacementResult,
  type SpanPlacementResult,
} from '../modals/GridPlacementModal'
import { DataTable, GhostButton, PrimaryButton } from '../ui'
import { IfcImportPanel } from './IfcImportPanel'
import { parseOpenings } from '../../lib/openings'

const POINT_PLACEMENT_KEYS = new Set(['PAD_FOOTING', 'RAFT', 'COLUMNS'])
const SPAN_PLACEMENT_KEYS = new Set(['WALLS', 'BEAMS'])

function formatQty(v: unknown, dec: number): string {
  if (v == null || typeof v !== 'number' || Number.isNaN(v)) return '—'
  return v.toFixed(dec)
}

function formatMoney(v: number | null | undefined, currency: string): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return `${currency || 'USD'} ${v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function roomLabelOf(inst: Instance): string {
  const raw = inst.geometry?.roomLabel
  return typeof raw === 'string' ? raw.trim() : ''
}

type RoomGroup = { key: string; label: string; instances: Instance[] }

function groupFinishInstances(instances: Instance[]): RoomGroup[] {
  const byKey = new Map<string, RoomGroup>()
  const unlabeled: Instance[] = []
  for (const inst of instances) {
    const label = roomLabelOf(inst)
    if (!label) {
      unlabeled.push(inst)
      continue
    }
    const key = label.toLowerCase()
    const existing = byKey.get(key)
    if (existing) existing.instances.push(inst)
    else byKey.set(key, { key, label, instances: [inst] })
  }
  const labeled = [...byKey.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
  )
  if (unlabeled.length) {
    labeled.push({ key: '', label: '', instances: unlabeled })
  }
  return labeled
}

function finishBoqRateCode(elementKey: string): string | null {
  if (elementKey === 'FLOOR_FINISH') return 'floorFinish'
  if (elementKey === 'WALL_FINISH') return 'wallFinish'
  if (elementKey === 'CEILING_FINISH') return 'ceilingFinish'
  if (elementKey === 'SKIRTING') return 'skirting'
  if (elementKey === 'DOORS_WINDOWS') return 'doorsWindows'
  if (elementKey === 'DUCTS') return 'ducts'
  if (elementKey === 'DUCT_FITTINGS') return 'ductFittings'
  if (elementKey === 'PIPES') return 'pipes'
  if (elementKey === 'ELECTRICAL') return 'electrical'
  return null
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
  value: string | number | boolean
  onChange: (v: string | number | boolean) => void
  disabled?: boolean
}) {
  const cls =
    field.type === 'text' ? `${fieldCls} min-w-[8rem] font-sans` : fieldCls
  if (field.type === 'bool') {
    return (
      <select
        className={cls}
        value={value === true || value === 'true' ? 'true' : 'false'}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === 'true')}
      >
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    )
  }
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
  floors,
  floorId,
  elementKey,
}: {
  project: Project
  floors: Floor[]
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [dupOpen, setDupOpen] = useState(false)

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
  useEffect(() => {
    setSelectedIds(new Set())
  }, [floorId, elementKey])
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
  const isFinish = schema?.reportKind === 'finish'
  const roomGroups = useMemo(
    () => (isFinish ? groupFinishInstances(instances) : null),
    [isFinish, instances],
  )
  const finishUnitRate = useMemo(() => {
    const code = finishBoqRateCode(elementKey)
    if (!code) return null
    const analysed = analyseRate(code, project.rateLib)
    return analysed && analysed.rate > 0 ? analysed.rate : null
  }, [elementKey, project.rateLib])

  if (!schema) {
    return (
      <div className="p-8 text-sm text-steel">
        This element is not implemented yet.
      </div>
    )
  }

  const labelColSpan =
    4 +
    (schema.hasGrade ? 1 : 0) +
    (schema.specList ? 1 : 0) +
    (schema.locationOptions ? 1 : 0) +
    geoCols.length +
    schema.rebarFields.length

  const allSelected =
    instances.length > 0 && instances.every((i) => selectedIds.has(i.id))

  function toggleSelect(id: string, on: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleSelectAll(on: boolean) {
    setSelectedIds(on ? new Set(instances.map((i) => i.id)) : new Set())
  }

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
          <GhostButton
            disabled={selectedIds.size === 0}
            className="!text-xs !py-2"
            onClick={() => setDupOpen(true)}
          >
            Duplicate selected…
            {selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </GhostButton>
          {elementKey === 'WALLS' && (
            <IfcImportPanel
              projectId={projectId}
              floors={floors}
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

      <DuplicateFloorModal
        open={dupOpen}
        onClose={() => {
          setDupOpen(false)
          setSelectedIds(new Set())
        }}
        projectId={projectId}
        floors={floors}
        sourceFloorId={floorId}
        instanceIds={[...selectedIds]}
        title="Duplicate selected to floor"
      />

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
                  <DataTable.HeaderCell className="w-8">
                    <input
                      type="checkbox"
                      className="accent-signal"
                      checked={allSelected}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      title="Select all"
                    />
                  </DataTable.HeaderCell>
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
                {(roomGroups ?? [{ key: '', label: '', instances }]).map((group) => {
                  const areaCol = schema.outputCols.find((c) => c.key === 'area')
                  let groupArea = 0
                  if (areaCol) {
                    for (const inst of group.instances) {
                      const v = resultsById.get(inst.id)?.[areaCol.resultKey]
                      if (typeof v === 'number') groupArea += v
                    }
                  }
                  const groupCost =
                    finishUnitRate != null ? groupArea * finishUnitRate : null
                  const showRoomChrome = Boolean(group.label)
                  const areaShown =
                    areaCol && typeof groupArea === 'number'
                      ? convertQuantity(groupArea, areaCol.unit, unitSystem).value
                      : null
                  return (
                    <Fragment key={group.key || '__ungrouped'}>
                      {showRoomChrome && (
                        <DataTable.Row className="bg-panel/80">
                          <DataTable.Cell
                            colSpan={labelColSpan}
                            className="!py-2 border-l-[3px] border-l-signal"
                          >
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink">
                              Room · {group.label}
                            </span>
                            <span className="ml-2 text-[11px] text-steel">
                              {group.instances.length} finish
                              {group.instances.length === 1 ? '' : 'es'}
                            </span>
                            <span className="ml-3 text-[11px] tabular-nums text-steel">
                              {formatMoney(groupCost, project.currency)}
                            </span>
                          </DataTable.Cell>
                          {schema.outputCols.map((c) => (
                            <DataTable.Cell key={c.key} numeric className="!py-2">
                              {c.key === 'area' && areaCol
                                ? formatQty(areaShown, areaCol.dec)
                                : ''}
                            </DataTable.Cell>
                          ))}
                          <DataTable.Cell className="!py-2" />
                        </DataTable.Row>
                      )}
                      {group.instances.map((inst) => (
                        <InstanceRow
                          key={inst.id}
                          inst={inst}
                          schema={schema}
                          geoCols={geoCols}
                          grades={project.materials.concreteClasses}
                          defaultTileWastage={project.materials.tileWastage}
                          result={resultsById.get(inst.id)}
                          unitSystem={unitSystem}
                          roomGrouped={showRoomChrome}
                          selected={selectedIds.has(inst.id)}
                          onSelectedChange={(on) => toggleSelect(inst.id, on)}
                          onPatch={(patch) => schedulePatch(inst.id, patch)}
                          onDelete={() => {
                            if (confirm(`Delete ${inst.mark}?`)) delMut.mutate(inst.id)
                          }}
                        />
                      ))}
                      {showRoomChrome && (
                        <DataTable.Row className="bg-panel/50">
                          <DataTable.Cell
                            colSpan={labelColSpan}
                            className="!py-1.5 border-l-[3px] border-l-signal text-[11px] text-steel"
                          >
                            {group.label} · room total
                            <span className="ml-3 font-semibold tabular-nums text-ink">
                              {formatMoney(groupCost, project.currency)}
                            </span>
                          </DataTable.Cell>
                          {schema.outputCols.map((c) => (
                            <DataTable.Cell
                              key={c.key}
                              numeric
                              className="!py-1.5 font-semibold tabular-nums"
                            >
                              {c.key === 'area' && areaCol
                                ? formatQty(areaShown, areaCol.dec)
                                : ''}
                            </DataTable.Cell>
                          ))}
                          <DataTable.Cell className="!py-1.5" />
                        </DataTable.Row>
                      )}
                    </Fragment>
                  )
                })}
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
  defaultTileWastage,
  result,
  unitSystem,
  roomGrouped = false,
  selected = false,
  onSelectedChange,
  onPatch,
  onDelete,
}: {
  inst: Instance
  schema: (typeof ELEMENT_ENGINES)[string]
  geoCols: { key: string; label: string }[]
  grades: string[]
  defaultTileWastage: number
  result?: Record<string, unknown>
  unitSystem: UnitSystem
  roomGrouped?: boolean
  selected?: boolean
  onSelectedChange?: (on: boolean) => void
  onPatch: (patch: Record<string, unknown>) => void
  onDelete: () => void
}) {
  const [local, setLocal] = useState(inst)
  const [openingsOpen, setOpeningsOpen] = useState(false)
  const [stairSegmentsOpen, setStairSegmentsOpen] = useState(false)
  useEffect(() => setLocal(inst), [inst])
  const isStairs = local.elementKey === 'STAIRS'
  const segmentCount = Array.isArray(local.geometry?.segments)
    ? local.geometry.segments.length
    : 0

  const shapeFields = schema.geometryByShape[local.shape] || []
  const shapeKeys = new Set(shapeFields.map((f) => f.key))
  const usingAreaOverride = (() => {
    const v = local.geometry?.areaOverride
    return v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0
  })()

  function setGeo(key: string, value: unknown) {
    const geometry = { ...(local.geometry || {}) }
    if (value === '' || value == null) {
      delete geometry[key]
    } else {
      geometry[key] = value
    }
    // Keep multi-segment model in sync when editing flat flight columns.
    if (
      isStairs &&
      Array.isArray(geometry.segments) &&
      geometry.segments.length > 0
    ) {
      const flightKeys = new Set([
        'run',
        'rise',
        'width',
        'stepCount',
        'waistThickness',
        'exposedSides',
        'flight1Run',
        'flight2Run',
        'innerRadius',
        'turnAngleDeg',
      ])
      if (flightKeys.has(key)) {
        const segs = geometry.segments.map((s: unknown) =>
          s && typeof s === 'object' ? { ...(s as object) } : s,
        ) as Record<string, unknown>[]
        const fi = segs.findIndex((s) => s?.kind === 'flight')
        if (fi >= 0) {
          if (value === '' || value == null) delete segs[fi][key]
          else segs[fi][key] = value
          geometry.segments = segs
        }
      }
    }
    setLocal((l) => ({ ...l, geometry }))
    onPatch({ geometry })
  }

  /** Patch several geometry keys in one autosave write. */
  function setGeoMany(patch: Record<string, unknown>) {
    const geometry = { ...(local.geometry || {}) }
    for (const [key, value] of Object.entries(patch)) {
      if (value === '' || value == null) delete geometry[key]
      else geometry[key] = value
    }
    setLocal((l) => ({ ...l, geometry }))
    onPatch({ geometry })
  }

  function setRebar(key: string, value: unknown) {
    const reinforcement = { ...(local.reinforcement || {}), [key]: value }
    setLocal((l) => ({ ...l, reinforcement }))
    onPatch({ reinforcement })
  }

  function setBarGroups(arrayKey: string, groups: BarGroup[]) {
    const meta = BAR_GROUP_LEGACY[arrayKey]
    if (!meta) return
    const synced = syncLegacyBarGroups(groups, {
      arrayKey: meta.arrayKey,
      countKey: meta.countKey,
      diaKey: meta.diaKey,
      fallbackDia: meta.fallbackDia,
    })
    const reinforcement = { ...(local.reinforcement || {}), ...synced }
    setLocal((l) => ({ ...l, reinforcement }))
    onPatch({ reinforcement })
  }

  function resolveBarGroupsValue(arrayKey: string): BarGroup[] {
    const meta = BAR_GROUP_LEGACY[arrayKey]
    const raw = local.reinforcement?.[arrayKey]
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((g: { diameterMm?: number; barCount?: number }) => ({
        diameterMm: Number(g.diameterMm) || 0,
        barCount: Number(g.barCount) || 0,
      }))
    }
    if (!meta) return []
    const dia =
      Number(local.reinforcement?.[meta.diaKey]) || meta.fallbackDia
    const count = Number(local.reinforcement?.[meta.countKey]) || 0
    if (count > 0) return [{ diameterMm: dia, barCount: count }]
    return [{ diameterMm: meta.fallbackDia, barCount: arrayKey === 'longBars' ? 8 : 2 }]
  }

  function setMeshGroups(arrayKey: string, groups: MeshBarGroup[]) {
    const meta = MESH_GROUP_LEGACY[arrayKey]
    if (!meta) return
    const synced = syncLegacyMeshGroups(groups, {
      arrayKey: meta.arrayKey,
      diaKey: meta.diaKey,
      spcKey: meta.spcKey,
      fallbackDia: meta.fallbackDia,
      fallbackSpc: meta.fallbackSpc,
    })
    const reinforcement = { ...(local.reinforcement || {}), ...synced }
    setLocal((l) => ({ ...l, reinforcement }))
    onPatch({ reinforcement })
  }

  function resolveMeshGroupsValue(arrayKey: string): MeshBarGroup[] {
    const meta = MESH_GROUP_LEGACY[arrayKey]
    const raw = local.reinforcement?.[arrayKey]
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((g: { diameterMm?: number; spacingMm?: number }) => ({
        diameterMm: Number(g.diameterMm) || 0,
        spacingMm: Number(g.spacingMm) || 0,
      }))
    }
    if (!meta) return []
    const dia = Number(local.reinforcement?.[meta.diaKey]) || meta.fallbackDia
    const spc = Number(local.reinforcement?.[meta.spcKey]) || meta.fallbackSpc
    return [{ diameterMm: dia, spacingMm: spc }]
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
    <DataTable.Row className={roomGrouped ? 'border-l-[3px] border-l-signal/40' : undefined}>
      <DataTable.Cell className="w-8">
        <input
          type="checkbox"
          className="accent-signal"
          checked={selected}
          onChange={(e) => onSelectedChange?.(e.target.checked)}
        />
      </DataTable.Cell>
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
        {isStairs && (
          <div className="mt-1 flex flex-col items-start gap-0.5">
            <button
              type="button"
              title="Edit flight / landing segments"
              className="border border-steel-border px-1.5 py-0.5 text-[10px] text-steel hover:text-ink hover:border-steel"
              onClick={() => setStairSegmentsOpen(true)}
            >
              Segments
            </button>
            {segmentCount > 0 && (
              <span className="text-[9px] font-sans text-steel">
                {segmentCount} segment{segmentCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
        )}
        {isStairs && (
          <StairSegmentsModal
            open={stairSegmentsOpen}
            onClose={() => setStairSegmentsOpen(false)}
            segments={local.geometry?.segments}
            legacy={{
              run: Number(local.geometry?.run) || undefined,
              rise: Number(local.geometry?.rise) || undefined,
              width: Number(local.geometry?.width) || undefined,
              stepCount: Number(local.geometry?.stepCount) || undefined,
              waistThickness:
                Number(local.geometry?.waistThickness) || undefined,
              exposedSides:
                local.geometry?.exposedSides != null
                  ? Number(local.geometry.exposedSides)
                  : undefined,
            }}
            onConfirm={(segments) => {
              const firstFlight = segments.find(
                (s) => s.kind === 'flight',
              ) as
                | {
                    kind: 'flight'
                    run?: number
                    rise?: number
                    width?: number
                    stepCount?: number
                    waistThickness?: number
                    exposedSides?: number
                  }
                | undefined
              const patch: Record<string, unknown> = { segments }
              // Keep flat schedule columns in sync with the first flight.
              if (firstFlight) {
                if (firstFlight.run != null) patch.run = firstFlight.run
                if (firstFlight.rise != null) patch.rise = firstFlight.rise
                if (firstFlight.width != null) patch.width = firstFlight.width
                if (firstFlight.stepCount != null)
                  patch.stepCount = firstFlight.stepCount
                if (firstFlight.waistThickness != null)
                  patch.waistThickness = firstFlight.waistThickness
                if (firstFlight.exposedSides != null)
                  patch.exposedSides = firstFlight.exposedSides
              }
              setGeoMany(patch)
            }}
          />
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
        const isOverrideField = col.key === 'areaOverride'
        const isWasteField = Boolean(field?.uiPercent)
        const isOpeningsField = col.key === 'openingArea'
        const hasStored =
          raw != null && raw !== '' && !(typeof raw === 'number' && Number.isNaN(raw))

        let displayVal: string | number = ''
        if (active && field) {
          if (field.type === 'text' || field.type === 'select') {
            displayVal = hasStored ? String(raw) : String(field.def ?? '')
          } else if (isWasteField) {
            const frac = hasStored ? Number(raw) : defaultTileWastage
            displayVal = Math.round(frac * 100)
          } else if (field.optional && !hasStored) {
            displayVal = ''
          } else if (lengthField) {
            const stored =
              typeof raw === 'number' ? raw : Number(field.def ?? 0)
            displayVal = lengthToDisplay(stored, unitSystem)
          } else {
            displayVal = (hasStored ? (raw as number) : field.def) as number
          }
        }

        const openingsCount = isOpeningsField
          ? parseOpenings(local.geometry?.openings).length
          : 0

        return (
          <DataTable.Cell
            key={col.key}
            className={col.key === 'roomLabel' ? 'min-w-[8rem]' : undefined}
          >
            {active && field ? (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <ScheduleInput
                      field={field}
                      value={displayVal}
                      onChange={(v) => {
                        if (field.type === 'text' || field.type === 'select') {
                          const s = String(v ?? '').trim()
                          setGeo(col.key, s ? s : '')
                          return
                        }
                        if (v === '' || v == null) {
                          if (isOpeningsField) {
                            setGeoMany({ openingArea: '', openings: [] })
                          } else {
                            setGeo(col.key, '')
                          }
                          return
                        }
                        const num = typeof v === 'number' ? v : Number(v)
                        if (Number.isNaN(num)) {
                          setGeo(col.key, '')
                          return
                        }
                        if (isWasteField) {
                          setGeo(col.key, Math.max(0, num) / 100)
                          return
                        }
                        if (isOpeningsField) {
                          // Manual total clears saved breakdown (stale rows would lie).
                          setGeoMany({
                            openingArea: num,
                            openings: [],
                          })
                          return
                        }
                        setGeo(
                          col.key,
                          lengthField
                            ? Number(
                                lengthFromDisplay(num || 0, unitSystem).toFixed(
                                  field.dec ?? 2,
                                ),
                              )
                            : num,
                        )
                      }}
                    />
                  </div>
                  {isOpeningsField && (
                    <button
                      type="button"
                      title="Edit openings breakdown"
                      className="shrink-0 border border-steel-border px-1.5 py-1 text-[10px] text-steel hover:text-ink hover:border-steel"
                      onClick={() => setOpeningsOpen(true)}
                    >
                      ▦
                    </button>
                  )}
                </div>
                {isOpeningsField && openingsCount > 0 && (
                  <span className="text-[9px] font-sans text-steel">
                    {openingsCount} opening{openingsCount === 1 ? '' : 's'}
                  </span>
                )}
                {isOverrideField && usingAreaOverride && (
                  <span className="text-[9px] font-sans uppercase tracking-wide text-signal">
                    Using override
                  </span>
                )}
                {isWasteField && !hasStored && (
                  <span className="text-[9px] font-sans text-steel">
                    Project default
                  </span>
                )}
                {isWasteField && hasStored && (
                  <span className="text-[9px] font-sans uppercase tracking-wide text-signal">
                    Instance
                  </span>
                )}
              </div>
            ) : (
              <span className="text-steel/50">—</span>
            )}
            {isOpeningsField && (
              <OpeningsTableModal
                open={openingsOpen}
                onClose={() => setOpeningsOpen(false)}
                title="Openings"
                unitSystem={unitSystem}
                openings={local.geometry?.openings}
                openingArea={
                  typeof local.geometry?.openingArea === 'number'
                    ? local.geometry.openingArea
                    : Number(local.geometry?.openingArea) || 0
                }
                onConfirm={({ openings, openingArea }) => {
                  setGeoMany({ openings, openingArea })
                }}
              />
            )}
          </DataTable.Cell>
        )
      })}
      {schema.rebarFields.map((field) => {
        const inactiveReason = rebarFieldInactiveReason(
          local.elementKey,
          field.key,
          local.shape,
          local.reinforcement as Record<string, unknown> | null | undefined,
        )
        return (
          <DataTable.Cell key={field.key}>
            {inactiveReason ? (
              <RebarInactiveCell reason={inactiveReason} />
            ) : field.type === 'barGroups' ? (
              <BarGroupsScheduleCell
                title={BAR_GROUP_LEGACY[field.key]?.title || field.label}
                value={resolveBarGroupsValue(field.key)}
                onChange={(groups) => setBarGroups(field.key, groups)}
                defaultDia={BAR_GROUP_LEGACY[field.key]?.fallbackDia ?? 16}
                defaultCount={field.key === 'longBars' ? 8 : 2}
              />
            ) : field.type === 'meshGroups' ? (
              <MeshBarsScheduleCell
                title={MESH_GROUP_LEGACY[field.key]?.title || field.label}
                value={resolveMeshGroupsValue(field.key)}
                onChange={(groups) => setMeshGroups(field.key, groups)}
                defaultDia={MESH_GROUP_LEGACY[field.key]?.fallbackDia ?? 16}
                defaultSpc={MESH_GROUP_LEGACY[field.key]?.fallbackSpc ?? 150}
              />
            ) : (
              <ScheduleInput
                field={field}
                value={
                  (local.reinforcement?.[field.key] as string | number | boolean) ??
                  field.def
                }
                onChange={(v) => setRebar(field.key, v)}
              />
            )}
          </DataTable.Cell>
        )
      })}
      {schema.outputCols.map((c) => {
        const raw = result?.[c.resultKey]
        const shown =
          typeof raw === 'number'
            ? convertQuantity(raw, c.unit, unitSystem).value
            : raw
        const showOverrideBadge =
          c.key === 'area' &&
          (usingAreaOverride || result?.areaFromOverride === true)
        return (
          <DataTable.Cell
            key={c.key}
            numeric
            className={c.rebar ? 'text-chalk' : undefined}
          >
            <div className="flex flex-col items-end gap-0.5">
              <span>{formatQty(shown, c.dec)}</span>
              {(c.key === 'riserLm' || c.key === 'sideLm') && (
                <span
                  className="text-[9px] font-sans uppercase tracking-wide text-signal"
                  title="Assumption 2 — indicative; verify before procurement"
                >
                  Indicative
                </span>
              )}
              {showOverrideBadge && (
                <span
                  className="text-[9px] font-sans uppercase tracking-wide text-signal"
                  title="Net area from Override (m²), not L×W − openings"
                >
                  Override
                </span>
              )}
              {!showOverrideBadge && c.key === 'area' && schema.reportKind === 'finish' && (
                <span
                  className="text-[9px] font-sans text-steel"
                  title="Net area from dimensions minus openings"
                >
                  Calculated
                </span>
              )}
            </div>
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
