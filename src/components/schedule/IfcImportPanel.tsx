import { useEffect, useMemo, useRef, useState } from 'react'
import {
  acceptIfcSuggestion,
  getIfcImportJob,
  listIfcSuggestions,
  patchIfcSuggestion,
  rejectIfcSuggestion,
  startIfcImport,
} from '../../api/projectsApi'
import { ApiError } from '../../lib/api'
import type { Floor } from '../../types/api'
import type {
  IfcImportJob,
  IfcMappedInstanceData,
  IfcSuggestion,
} from '../../types/ifcImport'
import { Modal } from '../modals/Modal'
import { DataTable, GhostButton, PrimaryButton } from '../ui'
import {
  applySuggestionGeoPatch,
  defaultMappedElementKey,
  geoInputDisabled,
  geoUiKey,
  isBeamRow,
  isColumnRow,
  missingFields,
  canPreviewIfcSuggestion,
  previewDimCaption,
} from './ifcReviewEdit'
import {
  emptyScopeCopy,
  filterSuggestionsForScope,
  otherTypesHint,
  scopeGroupTitle,
  scopeIntro,
} from './ifcImportScope'
import { IfcSuggestionPreviewViewport } from './IfcWallPreviewViewport'

const IFC_MAX_UPLOAD_BYTES = 200 * 1024 * 1024

const inputCls =
  'border border-steel-border bg-bg px-1.5 py-1 text-xs text-ink outline-none'

const actionBtn =
  'inline-flex items-center justify-center rounded-sm border px-2 py-1 text-[11px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40'

const COLUMN_SHAPES = [
  'RECTANGULAR',
  'CIRCULAR',
  'L_SHAPED',
  'T_SHAPED',
  'CRUCIFORM',
] as const

const BEAM_SHAPES = [
  'RECTANGULAR',
  'T_SECTION',
  'L_SECTION',
  'CANTILEVER_TAPERED',
  'GROUND_TIE',
] as const

const CONF_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const

function geoVal(
  data: IfcMappedInstanceData | null | undefined,
  key: string,
): string {
  const v = data?.geometry?.[key]
  return v == null ? '' : String(v)
}

/** Default LINEAR + seed thickness from name like "Wall 50 cm" when mapper left gaps. */
function normalizeSuggestionRow(s: IfcSuggestion): IfcSuggestion {
  if (s.entityType !== 'IfcWall' || s.status !== 'PENDING') return s
  const prev = s.mappedInstanceData || {
    elementKey: 'WALLS' as const,
    shape: null,
    mark: null,
    geometry: null,
  }
  const geometry: Record<string, number> = { ...(prev.geometry || {}) }
  if (!(Number(geometry.height) > 0) && geometry.height != null) {
    /* keep */
  }
  if (!(Number(geometry.thickness) > 0)) {
    const m = /(\d+(?:\.\d+)?)\s*cm/i.exec(s.name || '')
    if (m) geometry.thickness = Number(m[1]) / 100
  }
  const shape = prev.shape === 'LINEAR' || prev.shape === 'CURVED' ? prev.shape : 'LINEAR'
  return {
    ...s,
    mappedInstanceData: {
      elementKey: prev.elementKey || 'WALLS',
      shape,
      mark: prev.mark,
      geometry: Object.keys(geometry).length ? geometry : prev.geometry,
    },
  }
}

function sortSuggestions(rows: IfcSuggestion[]): IfcSuggestion[] {
  return [...rows].sort((a, b) => {
    if (a.entityType !== b.entityType) {
      return a.entityType.localeCompare(b.entityType)
    }
    const rd = CONF_ORDER[a.confidence] - CONF_ORDER[b.confidence]
    if (rd !== 0) return rd
    if (a.needsManualModeling !== b.needsManualModeling) {
      return a.needsManualModeling ? 1 : -1
    }
    return a.expressId - b.expressId
  })
}

function groupByFloor(rows: IfcSuggestion[], floors: Floor[]) {
  const ordered = [...floors].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
  )
  const knownIds = new Set(ordered.map((floor) => floor.floorId))
  const groups = ordered
    .map((floor) => ({
      key: floor.floorId,
      title: `${floor.label} (${floor.floorId})`,
      rows: rows.filter((row) => row.floorId === floor.floorId),
    }))
    .filter((group) => group.rows.length > 0)
  const unassigned = rows.filter(
    (row) => !row.floorId || !knownIds.has(row.floorId),
  )
  if (unassigned.length) {
    groups.push({
      key: '__unassigned__',
      title: 'Unassigned / ambiguous',
      rows: unassigned,
    })
  }
  return groups
}

export function IfcImportPanel({
  projectId,
  floors,
  elementKey,
  onCommitted,
}: {
  projectId: string
  floors: Floor[]
  elementKey: string
  onCommitted: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [job, setJob] = useState<IfcImportJob | null>(null)
  const [rows, setRows] = useState<IfcSuggestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [previewRow, setPreviewRow] = useState<IfcSuggestion | null>(null)
  const [assumedShapeIds, setAssumedShapeIds] = useState<Set<string>>(
    () => new Set(),
  )

  function close() {
    setOpen(false)
    setJob(null)
    setRows([])
    setError(null)
    setUploading(false)
    setUploadPercent(0)
    setBusyId(null)
    setPreviewRow(null)
    setAssumedShapeIds(new Set())
    if (fileRef.current) fileRef.current.value = ''
  }

  async function loadSuggestions(jobId: string) {
    const { suggestions } = await listIfcSuggestions(projectId, jobId)
    setRows(sortSuggestions(suggestions.map(normalizeSuggestionRow)))
  }

  async function onPick(file: File | undefined) {
    if (!file) return
    setOpen(true)
    setError(null)
    setJob(null)
    setRows([])

    if (file.size > IFC_MAX_UPLOAD_BYTES) {
      setError('File too large (max 200 MB)')
      return
    }

    setUploading(true)
    setUploadPercent(0)
    try {
      const { job: created } = await startIfcImport(
        projectId,
        file,
        ({ percent }) => setUploadPercent(percent),
      )
      setUploadPercent(100)
      setJob(created)
      if (created.status === 'SUCCEEDED') {
        await loadSuggestions(created.id)
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to upload IFC file',
      )
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    if (!job) return
    if (job.status !== 'QUEUED' && job.status !== 'RUNNING') return

    let cancelled = false
    const tick = async () => {
      try {
        const { job: next } = await getIfcImportJob(projectId, job.id)
        if (cancelled) return
        setJob(next)
        if (next.status === 'SUCCEEDED') {
          await loadSuggestions(next.id)
        }
        if (next.status === 'FAILED') {
          setError(next.error || 'IFC parse failed')
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Failed to poll import job',
          )
        }
      }
    }

    const id = window.setInterval(() => {
      void tick()
    }, 1500)
    void tick()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [job?.id, job?.status, projectId])

  function patchLocal(
    id: string,
    patch: Partial<IfcMappedInstanceData>,
  ) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const base = r.mappedInstanceData || {
          elementKey: defaultMappedElementKey(r),
          shape: null,
          mark: null,
          geometry: null,
        }
        return {
          ...r,
          mappedInstanceData: {
            elementKey:
              patch.elementKey !== undefined
                ? patch.elementKey
                : base.elementKey,
            shape: patch.shape !== undefined ? patch.shape : base.shape,
            mark: patch.mark !== undefined ? patch.mark : base.mark,
            geometry:
              patch.geometry !== undefined ? patch.geometry : base.geometry,
          },
        }
      }),
    )
  }

  function patchGeo(id: string, key: string, raw: string) {
    let seededShape: string | null = null
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const result = applySuggestionGeoPatch(r, key, raw)
        seededShape = result.seededShape
        return result.row
      }),
    )
    if (seededShape) {
      setAssumedShapeIds((ids) => {
        if (ids.has(id)) return ids
        const next = new Set(ids)
        next.add(id)
        return next
      })
    }
  }

  async function onAssignFloor(row: IfcSuggestion, nextFloorId: string) {
    if (!job || !nextFloorId || row.status !== 'PENDING') return
    setBusyId(row.id)
    setError(null)
    try {
      const res = await patchIfcSuggestion(projectId, job.id, row.id, {
        floorId: nextFloorId,
      })
      setRows((prev) =>
        prev.map((item) => (item.id === row.id ? res.suggestion : item)),
      )
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Floor assignment failed',
      )
    } finally {
      setBusyId(null)
    }
  }

  async function onAccept(row: IfcSuggestion) {
    if (!job) return
    if (!row.floorId) {
      setError(
        `Assign “${row.name || row.sourceGlobalId}” to a project floor before accepting it.`,
      )
      return
    }
    const missing = missingFields(row)
    if (missing.length) {
      setError(
        `Fill ${missing.join(', ')} before accepting “${row.name || row.sourceGlobalId}”.`,
      )
      return
    }
    setBusyId(row.id)
    setError(null)
    try {
      const res = await acceptIfcSuggestion(
        projectId,
        job.id,
        row.id,
        row.mappedInstanceData,
      )
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? res.suggestion : r)),
      )
      onCommitted()
      if (res.skippedDuplicate) {
        setError(
          `Already imported (GlobalId ${row.sourceGlobalId}) — linked existing instance ${res.instance?.mark || ''}`,
        )
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Accept failed')
    } finally {
      setBusyId(null)
    }
  }

  async function onReject(row: IfcSuggestion) {
    if (!job) return
    setBusyId(row.id)
    setError(null)
    try {
      const res = await rejectIfcSuggestion(projectId, job.id, row.id)
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? res.suggestion : r)),
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reject failed')
    } finally {
      setBusyId(null)
    }
  }

  const parsing = job?.status === 'QUEUED' || job?.status === 'RUNNING'
  const ready = job?.status === 'SUCCEEDED' && !uploading
  const scopedRows = useMemo(
    () => filterSuggestionsForScope(rows, elementKey),
    [rows, elementKey],
  )
  const floorGroups = useMemo(
    () => groupByFloor(scopedRows, floors),
    [scopedRows, floors],
  )
  const livePreview = useMemo(() => {
    if (!previewRow) return null
    return rows.find((row) => row.id === previewRow.id) || previewRow
  }, [previewRow, rows])
  const pendingCount = scopedRows.filter((r) => r.status === 'PENDING').length
  const acceptedCount = scopedRows.filter((r) => r.status === 'ACCEPTED').length
  const manualCount = scopedRows.filter((r) => r.needsManualModeling).length
  const emptyCopy = job
    ? emptyScopeCopy(elementKey, rows, job.summary)
    : { title: '', body: '' }
  const alsoParsed = otherTypesHint(elementKey, rows)
  const columnScope = elementKey === 'COLUMNS'
  const beamScope = elementKey === 'BEAMS'

  function geoInput(
    row: IfcSuggestion,
    missing: string[],
    uiKey: string,
    opts: { step?: string; min?: string } = {},
  ) {
    const key = geoUiKey(row, uiKey)
    const canEdit = row.status === 'PENDING'
    return (
      <input
        type="number"
        step={opts.step || '0.01'}
        min={opts.min}
        data-geo-key={key}
        className={`${inputCls} w-14 text-right font-mono`}
        value={geoVal(row.mappedInstanceData, key)}
        disabled={!canEdit || geoInputDisabled(row, key, missing)}
        onChange={(e) => patchGeo(row.id, key, e.target.value)}
      />
    )
  }

  function renderGroup(title: string, list: IfcSuggestion[]) {
    if (!list.length) return null
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink">
          {title}{' '}
          <span className="text-steel font-normal normal-case">
            ({list.length})
          </span>
        </h3>
        <div className="border border-steel-border max-h-[min(28rem,50vh)] overflow-x-auto overflow-y-auto">
          <DataTable compact className="w-full min-w-[980px]">
            <DataTable.Header>
              <DataTable.Row>
                <DataTable.HeaderCell className="w-16">Conf.</DataTable.HeaderCell>
                <DataTable.HeaderCell className="min-w-[9rem]">
                  Name / GlobalId
                </DataTable.HeaderCell>
                <DataTable.HeaderCell className="min-w-[11rem]">
                  Floor
                </DataTable.HeaderCell>
                <DataTable.HeaderCell className="w-20">Mark</DataTable.HeaderCell>
                <DataTable.HeaderCell className="w-24">Shape</DataTable.HeaderCell>
                {columnScope ? (
                  <>
                    <DataTable.HeaderCell align="right" className="w-16">
                      W
                    </DataTable.HeaderCell>
                    <DataTable.HeaderCell align="right" className="w-16">
                      D
                    </DataTable.HeaderCell>
                    <DataTable.HeaderCell align="right" className="w-16">
                      Dia
                    </DataTable.HeaderCell>
                    <DataTable.HeaderCell align="right" className="w-16">
                      T
                    </DataTable.HeaderCell>
                    <DataTable.HeaderCell align="right" className="w-16">
                      Web
                    </DataTable.HeaderCell>
                    <DataTable.HeaderCell align="right" className="w-16">
                      H
                    </DataTable.HeaderCell>
                  </>
                ) : beamScope ? (
                  <>
                    <DataTable.HeaderCell align="right" className="w-16">
                      Span
                    </DataTable.HeaderCell>
                    <DataTable.HeaderCell align="right" className="w-16">
                      W
                    </DataTable.HeaderCell>
                    <DataTable.HeaderCell align="right" className="w-16">
                      D
                    </DataTable.HeaderCell>
                    <DataTable.HeaderCell align="right" className="w-16">
                      Tip D
                    </DataTable.HeaderCell>
                    <DataTable.HeaderCell align="right" className="w-16">
                      Flange T
                    </DataTable.HeaderCell>
                    <DataTable.HeaderCell align="right" className="w-16">
                      Web
                    </DataTable.HeaderCell>
                  </>
                ) : (
                  <>
                    <DataTable.HeaderCell align="right" className="w-16">
                      L
                    </DataTable.HeaderCell>
                    <DataTable.HeaderCell align="right" className="w-16">
                      W
                    </DataTable.HeaderCell>
                    <DataTable.HeaderCell align="right" className="w-16">
                      T
                    </DataTable.HeaderCell>
                    <DataTable.HeaderCell align="right" className="w-16">
                      H
                    </DataTable.HeaderCell>
                    <DataTable.HeaderCell align="right" className="w-14">
                      Piles
                    </DataTable.HeaderCell>
                  </>
                )}
                <DataTable.HeaderCell className="w-20">Status</DataTable.HeaderCell>
                <DataTable.HeaderCell className="w-52">Actions</DataTable.HeaderCell>
              </DataTable.Row>
            </DataTable.Header>
            <DataTable.Body>
              {list.map((row) => {
                const missing = missingFields(row)
                const incomplete = missing.length > 0
                const low = row.confidence === 'LOW'
                const manual = row.needsManualModeling
                const pending = row.status === 'PENDING'
                const canEdit = pending
                const canPreview = canPreviewIfcSuggestion(row)
                return (
                  <DataTable.Row
                    key={row.id}
                    data-suggestion-name={row.name || ''}
                    className={
                      row.status === 'REJECTED'
                        ? 'opacity-50'
                        : row.status === 'ACCEPTED'
                          ? 'bg-signal/5'
                          : low || manual
                            ? 'bg-amber-500/10'
                            : undefined
                    }
                    title={
                      [
                        ...(row.confidenceNotes || []),
                        row.floorMatchNote || '',
                        row.skipReason || '',
                        incomplete && pending
                          ? `Need: ${missing.join(', ')}`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    }
                  >
                    <DataTable.Cell
                      className={`text-[11px] font-mono ${
                        low ? 'text-amber-700 font-semibold' : 'text-steel'
                      }`}
                    >
                      {row.confidence}
                      {manual ? (
                        <span className="block text-amber-700">manual</span>
                      ) : null}
                    </DataTable.Cell>
                    <DataTable.Cell className="text-[11px]">
                      <div className="text-ink truncate max-w-[11rem]">
                        {row.name || '—'}
                      </div>
                      <div className="font-mono text-steel truncate max-w-[11rem]">
                        {row.sourceGlobalId}
                      </div>
                      {row.skipReason ? (
                        <div className="text-[10px] text-amber-700 mt-0.5 line-clamp-2">
                          {row.skipReason}
                        </div>
                      ) : null}
                    </DataTable.Cell>
                    <DataTable.Cell className="text-[11px]">
                      <div className="mb-1 truncate text-steel" title={row.floorMatchNote}>
                        <span className="text-ink">
                          {row.sourceStorey?.name || 'No IFC storey'}
                        </span>
                        {row.sourceStorey?.elevationM != null
                          ? ` · ${row.sourceStorey.elevationM}m`
                          : ''}
                      </div>
                      <select
                        className={`${inputCls} w-full max-w-[12rem]`}
                        value={row.floorId || ''}
                        disabled={!pending || busyId === row.id}
                        title={row.floorMatchNote}
                        onChange={(e) =>
                          void onAssignFloor(row, e.target.value)
                        }
                      >
                        <option value="">Assign floor…</option>
                        {[...floors]
                          .sort((a, b) => a.sortOrder - b.sortOrder)
                          .map((floor) => (
                            <option key={floor.id} value={floor.floorId}>
                              {floor.label} ({floor.floorId})
                            </option>
                          ))}
                      </select>
                      <div
                        className={`mt-1 text-[10px] capitalize ${
                          row.floorId ? 'text-steel' : 'text-amber-700'
                        }`}
                      >
                        {row.floorMatchStatus.replaceAll('_', ' ').toLowerCase()}
                      </div>
                    </DataTable.Cell>
                    <DataTable.Cell>
                      <input
                        className={`${inputCls} w-14 font-mono`}
                        placeholder="auto"
                        value={row.mappedInstanceData?.mark || ''}
                        disabled={!canEdit}
                        onChange={(e) =>
                          patchLocal(row.id, {
                            mark: e.target.value || null,
                          })
                        }
                      />
                    </DataTable.Cell>
                    <DataTable.Cell>
                      {canEdit && row.entityType === 'IfcWall' ? (
                        <select
                          className={`${inputCls} w-[5.5rem] font-mono`}
                          value={row.mappedInstanceData?.shape || ''}
                          onChange={(e) =>
                            patchLocal(row.id, {
                              shape: e.target.value || null,
                            })
                          }
                        >
                          <option value="">—</option>
                          <option value="LINEAR">LINEAR</option>
                          <option value="CURVED">CURVED</option>
                        </select>
                      ) : canEdit && isColumnRow(row) ? (
                        <select
                          className={`${inputCls} w-[7.5rem] font-mono`}
                          data-testid="column-shape"
                          value={row.mappedInstanceData?.shape || ''}
                          onChange={(e) =>
                            patchLocal(row.id, {
                              elementKey: 'COLUMNS',
                              shape: e.target.value || null,
                            })
                          }
                        >
                          <option value="">—</option>
                          {COLUMN_SHAPES.map((shape) => (
                            <option key={shape} value={shape}>
                              {shape}
                            </option>
                          ))}
                        </select>
                      ) : canEdit && isBeamRow(row) ? (
                        <select
                          className={`${inputCls} w-[9.5rem] font-mono`}
                          data-testid="beam-shape"
                          value={row.mappedInstanceData?.shape || ''}
                          onChange={(e) =>
                            patchLocal(row.id, {
                              elementKey: 'BEAMS',
                              shape: e.target.value || null,
                            })
                          }
                        >
                          <option value="">—</option>
                          {BEAM_SHAPES.map((shape) => (
                            <option key={shape} value={shape}>
                              {shape}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-mono text-[11px]">
                          {row.entityType === 'IfcFooting' &&
                          row.mappedInstanceData?.elementKey
                            ? `${row.mappedInstanceData.elementKey} / ${
                                row.mappedInstanceData.shape || '—'
                              }`
                            : row.mappedInstanceData?.shape || '—'}
                          {assumedShapeIds.has(row.id) &&
                          row.mappedInstanceData?.shape ? (
                            <span className="block text-[10px] text-amber-700">
                              assumed
                            </span>
                          ) : null}
                        </span>
                      )}
                    </DataTable.Cell>
                    {columnScope ? (
                      <>
                        <DataTable.Cell className="text-right">
                          {geoInput(row, missing, 'width')}
                        </DataTable.Cell>
                        <DataTable.Cell className="text-right">
                          {geoInput(row, missing, 'depth')}
                        </DataTable.Cell>
                        <DataTable.Cell className="text-right">
                          {geoInput(row, missing, 'diameter')}
                        </DataTable.Cell>
                        <DataTable.Cell className="text-right">
                          {geoInput(row, missing, 'thickness')}
                        </DataTable.Cell>
                        <DataTable.Cell className="text-right">
                          {geoInput(row, missing, 'webThickness')}
                        </DataTable.Cell>
                        <DataTable.Cell className="text-right">
                          {geoInput(row, missing, 'height')}
                        </DataTable.Cell>
                      </>
                    ) : beamScope ? (
                      <>
                        <DataTable.Cell className="text-right">
                          {geoInput(row, missing, 'spanLength')}
                        </DataTable.Cell>
                        <DataTable.Cell className="text-right">
                          {geoInput(row, missing, 'width')}
                        </DataTable.Cell>
                        <DataTable.Cell className="text-right">
                          {geoInput(row, missing, 'depth')}
                        </DataTable.Cell>
                        <DataTable.Cell className="text-right">
                          {geoInput(row, missing, 'tipDepth')}
                        </DataTable.Cell>
                        <DataTable.Cell className="text-right">
                          {geoInput(row, missing, 'flangeThickness')}
                        </DataTable.Cell>
                        <DataTable.Cell className="text-right">
                          {geoInput(row, missing, 'webWidth')}
                        </DataTable.Cell>
                      </>
                    ) : (
                      <>
                        <DataTable.Cell className="text-right">
                          {geoInput(row, missing, 'length')}
                        </DataTable.Cell>
                        <DataTable.Cell className="text-right">
                          {geoInput(row, missing, 'width')}
                        </DataTable.Cell>
                        <DataTable.Cell className="text-right">
                          {geoInput(row, missing, 'thickness', { step: '0.001' })}
                        </DataTable.Cell>
                        <DataTable.Cell className="text-right">
                          {geoInput(row, missing, 'height')}
                        </DataTable.Cell>
                        <DataTable.Cell className="text-right">
                          {geoInput(row, missing, 'pileCount', {
                            step: '1',
                            min: '1',
                          })}
                        </DataTable.Cell>
                      </>
                    )}
                    <DataTable.Cell className="text-[11px] font-mono text-steel">
                      {row.status}
                    </DataTable.Cell>
                    <DataTable.Cell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          className={`${actionBtn} border-steel-border bg-bg text-ink hover:border-chalk hover:text-chalk`}
                          disabled={!canPreview}
                          data-testid="ifc-preview"
                          title={
                            canPreview
                              ? low
                                ? '3D preview (LOW — amber outline)'
                                : '3D preview of mapped geometry'
                              : 'Need shape + dimensions to preview'
                          }
                          onClick={() => setPreviewRow(row)}
                        >
                          Preview
                        </button>
                        {pending ? (
                          <>
                            <button
                              type="button"
                              className={`${actionBtn} border-signal/40 bg-signal text-bg hover:brightness-110`}
                              disabled={
                                busyId === row.id ||
                                incomplete ||
                                !row.floorId
                              }
                              data-testid="ifc-accept"
                              title={
                                !row.floorId
                                  ? 'Assign a project floor first'
                                  : incomplete
                                    ? `Fill ${missing.join(', ')} first`
                                    : 'Create schedule instance'
                              }
                              onClick={() => void onAccept(row)}
                            >
                              {busyId === row.id ? '…' : 'Accept'}
                            </button>
                            <button
                              type="button"
                              className={`${actionBtn} border-danger/50 bg-danger-bg text-danger hover:border-danger`}
                              disabled={busyId === row.id}
                              onClick={() => void onReject(row)}
                            >
                              Reject
                            </button>
                            {incomplete ? (
                              <span className="basis-full text-[10px] text-amber-700">
                                {missing.includes('Piles')
                                  ? 'Need Piles — IFC geometry has no pile count'
                                  : `Need ${missing.join(', ')} before accepting`}
                              </span>
                            ) : !row.floorId ? (
                              <span className="basis-full text-[10px] text-amber-700">
                                Assign a project floor first
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-[11px] text-steel">—</span>
                        )}
                      </div>
                    </DataTable.Cell>
                  </DataTable.Row>
                )
              })}
            </DataTable.Body>
          </DataTable>
        </div>
      </div>
    )
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".ifc,application/x-step,application/octet-stream"
        className="hidden"
        onChange={(e) => {
          void onPick(e.target.files?.[0])
        }}
      />
      <GhostButton
        className="!text-xs !py-2"
        disabled={uploading || parsing}
        data-testid="ifc-import-button"
        onClick={() => fileRef.current?.click()}
      >
        Import from IFC
      </GhostButton>

      <Modal open={open} title="Import from IFC — review" onClose={close} size="full">
        <div className="space-y-4">
          <p className="text-xs text-steel leading-relaxed max-w-4xl">
            {scopeIntro(elementKey)}
          </p>

          {uploading && (
            <div className="space-y-2" role="status" aria-live="polite">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-ink">Uploading IFC file</p>
                <p className="font-mono text-sm tabular-nums text-signal-text">
                  {uploadPercent}%
                </p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-sm bg-steel-border/60">
                <div
                  className="ifc-upload-bar h-full rounded-sm bg-signal"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-steel">
                {uploadPercent < 100
                  ? 'Sending file to the server…'
                  : 'Upload complete — starting parse…'}
              </p>
            </div>
          )}
          {!uploading && job?.status === 'QUEUED' && (
            <p className="text-sm text-ink">Queued for parsing…</p>
          )}
          {!uploading && job?.status === 'RUNNING' && (
            <p className="text-sm text-ink">
              Parsing IFC… Large models can take several minutes.
            </p>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          {ready && job && (
            <>
              <div className="flex flex-wrap gap-3 text-xs text-steel">
                <span>
                  {job.fileName} ·{' '}
                  <span className="font-mono text-ink">
                    {scopedRows.filter((row) => row.floorId).length}/
                    {scopedRows.length}
                  </span>{' '}
                  assigned to project floors
                </span>
                <span>
                  {scopedRows.length} {scopeGroupTitle(elementKey).toLowerCase()}{' '}
                  · {pendingCount} pending · {acceptedCount} accepted ·{' '}
                  {manualCount} need manual modeling
                </span>
                <span>
                  parse: {job.summary.walls} walls / {job.summary.slabs} slabs
                  {' / '}
                  {job.summary.footings ?? 0} footings
                  {' / '}
                  {job.summary.columns ?? 0} columns
                  {' / '}
                  {job.summary.beams ?? 0} beams
                  {job.summary.skipped
                    ? ` · ${job.summary.skipped} skipped geometry`
                    : ''}
                </span>
              </div>

              {alsoParsed ? (
                <p className="text-xs text-steel">{alsoParsed}</p>
              ) : null}

              {scopedRows.length === 0 ? (
                <div
                  className="border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm space-y-1 max-w-4xl"
                  role="status"
                >
                  <p className="font-medium text-ink">{emptyCopy.title}</p>
                  <p className="text-steel leading-relaxed">{emptyCopy.body}</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {floorGroups.map((group) => (
                    <section
                      key={group.key}
                      className="space-y-3 border-t border-steel-border pt-4 first:border-t-0 first:pt-0"
                    >
                      <h2
                        className={`font-display text-sm font-semibold ${
                          group.key === '__unassigned__'
                            ? 'text-amber-700'
                            : 'text-ink'
                        }`}
                      >
                        {group.title}{' '}
                        <span className="font-mono text-xs font-normal text-steel">
                          {group.rows.length}
                        </span>
                      </h2>
                      {renderGroup(scopeGroupTitle(elementKey), group.rows)}
                    </section>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <PrimaryButton className="!text-xs !py-2" onClick={close}>
              Done
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!livePreview}
        title={
          livePreview
            ? `3D preview — ${livePreview.name || livePreview.sourceGlobalId}`
            : '3D preview'
        }
        onClose={() => setPreviewRow(null)}
        size="lg"
        layer={1}
      >
        {livePreview?.mappedInstanceData ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-steel">
              <span
                className={`font-mono ${
                  livePreview.confidence === 'LOW'
                    ? 'font-semibold text-amber-700'
                    : 'text-ink'
                }`}
              >
                {livePreview.confidence}
              </span>
              {livePreview.confidence === 'LOW' ? (
                <span className="text-amber-700">
                  Amber outline marks LOW confidence
                </span>
              ) : (
                <span>Mapped geometry · drag to orbit · scroll to zoom</span>
              )}
              <span className="font-mono text-ink">
                {previewDimCaption(livePreview.mappedInstanceData)}
              </span>
            </div>
            <IfcSuggestionPreviewViewport
              key={livePreview.id}
              mapped={livePreview.mappedInstanceData}
              confidence={livePreview.confidence}
              className="h-80 w-full"
            />
          </div>
        ) : null}
      </Modal>
    </>
  )
}
