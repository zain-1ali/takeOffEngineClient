import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchSheets, updateSheet, uploadFloorPdf } from '../../api/sheets'
import {
  drawingDisplayName,
  sheetIsCalibrated,
} from '../../lib/sheetCalibration'
import type { Floor } from '../../types/api'
import type { Sheet } from '../../types/models'
import { GhostButton, PrimaryButton } from '../ui'
import {
  DrawingViewerModal,
  type DrawingViewerIntent,
} from './DrawingViewerModal'

type FloorGroup = {
  floorId: string
  floorLabel: string
  sortOrder: number
  pages: Sheet[]
  title: string
  pageCount: number
  calibrated: boolean
  hasDrawing: boolean
  primarySheet: Sheet | null
}

/**
 * Project-wide drawings index — collapsible floors, View / QTO / Replace.
 * One PDF per floor (replace overwrites pages and clears calibration).
 */
export function DrawingsRegisterView({
  projectId,
  floors,
}: {
  projectId: string
  floors: Floor[]
  /** @deprecated Kept for WorkspacePage callers; unused. */
  onOpenFloor?: (floorId: string) => void
}) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [replaceFloorId, setReplaceFloorId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [awaitingFloorId, setAwaitingFloorId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [viewer, setViewer] = useState<{
    floorId: string
    intent: DrawingViewerIntent
  } | null>(null)
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const sheetsQuery = useQuery({
    queryKey: ['projects', projectId, 'sheets'],
    queryFn: () => fetchSheets(projectId),
    enabled: Boolean(projectId),
    refetchInterval: awaitingFloorId ? 2500 : false,
  })

  const sheets = sheetsQuery.data ?? []

  const groups = useMemo(() => {
    const byFloor = new Map<string, Sheet[]>()
    for (const s of sheets) {
      const fid = s.floorId || ''
      if (!fid) continue
      const list = byFloor.get(fid) ?? []
      list.push(s)
      byFloor.set(fid, list)
    }
    for (const list of byFloor.values()) {
      list.sort(
        (a, b) =>
          (a.pageNumber || 0) - (b.pageNumber || 0) ||
          (a.sortOrder || 0) - (b.sortOrder || 0),
      )
    }

    const floorGroups: FloorGroup[] = floors.map((f) => {
      const pages = byFloor.get(f.floorId) ?? []
      const first = pages[0] ?? null
      return {
        floorId: f.floorId,
        floorLabel: f.label,
        sortOrder: f.sortOrder ?? 0,
        pages,
        title: drawingDisplayName(first ?? undefined),
        pageCount: pages.length,
        calibrated: pages.some(sheetIsCalibrated),
        hasDrawing: pages.length > 0,
        primarySheet: first,
      }
    })

    for (const [fid, pages] of byFloor) {
      if (floors.some((f) => f.floorId === fid)) continue
      const first = pages[0] ?? null
      floorGroups.push({
        floorId: fid,
        floorLabel: '(removed floor)',
        sortOrder: 9999,
        pages,
        title: drawingDisplayName(first ?? undefined),
        pageCount: pages.length,
        calibrated: pages.some(sheetIsCalibrated),
        hasDrawing: true,
        primarySheet: first,
      })
    }

    floorGroups.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.floorId.localeCompare(b.floorId),
    )

    const q = query.trim().toLowerCase()
    if (!q) return floorGroups
    return floorGroups.filter(
      (g) =>
        g.floorId.toLowerCase().includes(q) ||
        g.floorLabel.toLowerCase().includes(q) ||
        g.title.toLowerCase().includes(q),
    )
  }, [floors, sheets, query])

  useEffect(() => {
    if (!awaitingFloorId) return
    const ready = sheets.some((s) => s.floorId === awaitingFloorId)
    if (!ready) return
    setAwaitingFloorId(null)
  }, [awaitingFloorId, sheets])

  const uploadMut = useMutation({
    mutationFn: ({ floorId, file }: { floorId: string; file: File }) =>
      uploadFloorPdf(projectId, floorId, file),
    onSuccess: async (_data, vars) => {
      setUploadError(null)
      setAwaitingFloorId(vars.floorId)
      await qc.invalidateQueries({ queryKey: ['projects', projectId, 'sheets'] })
      await qc.invalidateQueries({
        queryKey: ['projects', projectId, 'sheets', vars.floorId],
      })
    },
    onError: (err: Error) => {
      setUploadError(err.message)
      setAwaitingFloorId(null)
    },
  })

  const titleMut = useMutation({
    mutationFn: ({ sheetId, title }: { sheetId: string; title: string }) =>
      updateSheet(sheetId, { title }),
    onSuccess: async () => {
      setEditingFloorId(null)
      await qc.invalidateQueries({ queryKey: ['projects', projectId, 'sheets'] })
    },
  })

  function pickReplace(floorId: string) {
    setReplaceFloorId(floorId)
    setUploadError(null)
    requestAnimationFrame(() => fileRef.current?.click())
  }

  function beginEditTitle(g: FloorGroup) {
    if (!g.primarySheet) return
    setEditingFloorId(g.floorId)
    setEditTitle(g.title === '—' ? '' : g.title)
  }

  function commitEditTitle(g: FloorGroup) {
    const next = editTitle.trim()
    if (!g.primarySheet || !next) {
      setEditingFloorId(null)
      return
    }
    if (next === g.title) {
      setEditingFloorId(null)
      return
    }
    titleMut.mutate({ sheetId: g.primarySheet.id, title: next })
  }

  function toggleFloor(floorId: string) {
    setCollapsed((c) => ({ ...c, [floorId]: !c[floorId] }))
  }

  const withDrawing = groups.filter((g) => g.hasDrawing).length
  const calibratedCount = groups.filter((g) => g.calibrated).length
  const viewerGroup = viewer
    ? groups.find((g) => g.floorId === viewer.floorId)
    : null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-shrink-0 space-y-3 px-6 pb-4 pt-2">
        <div>
          <h2 className="font-display text-lg text-ink">Drawings Register</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-steel">
            All floor drawings for this project, grouped by floor. Replace
            overwrites that floor’s PDF and clears calibration — no version
            history.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Search floor or title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-[14rem] border border-steel-border bg-panel px-2.5 py-1.5 text-xs text-ink outline-none"
          />
          <span className="text-[11px] text-steel">
            {withDrawing} drawing{withDrawing === 1 ? '' : 's'}
            {floors.length > 0
              ? ` · ${calibratedCount} calibrated · ${floors.length} floor${floors.length === 1 ? '' : 's'}`
              : null}
          </span>
          {awaitingFloorId ? (
            <span className="text-[11px] text-signal">
              Converting PDF for {awaitingFloorId}…
            </span>
          ) : null}
          {uploadError ? (
            <span className="text-[11px] text-danger">{uploadError}</span>
          ) : null}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          const floorId = replaceFloorId
          setReplaceFloorId(null)
          if (file && floorId) {
            uploadMut.mutate({ floorId, file })
          }
        }}
      />

      <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
        {floors.length === 0 ? (
          <div className="border border-dashed border-steel-border bg-panel px-6 py-10 text-sm text-steel">
            Add floors first (Floors step), then upload a PDF per floor.
          </div>
        ) : groups.length === 0 ? (
          <div className="border border-dashed border-steel-border bg-panel px-6 py-10 text-sm text-steel">
            No floors match “{query}”.
          </div>
        ) : (
          <div className="border border-steel-border bg-panel">
            <div className="grid grid-cols-[minmax(7rem,0.9fr)_minmax(10rem,1.6fr)_4.5rem_8.5rem_minmax(12rem,1.2fr)] gap-2 border-b border-steel-border bg-bg/60 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-steel">
              <div>Floor</div>
              <div>Drawing Title</div>
              <div>Pages</div>
              <div>Status</div>
              <div>Actions</div>
            </div>

            {groups.map((g) => {
              const isCollapsed = !!collapsed[g.floorId]
              return (
                <section key={g.floorId} className="border-b border-steel-border last:border-b-0">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 bg-bg/40 px-3 py-2 text-left hover:bg-bg/70"
                    onClick={() => toggleFloor(g.floorId)}
                    aria-expanded={!isCollapsed}
                  >
                    <span
                      className="w-3 text-[10px] text-steel"
                      aria-hidden
                    >
                      {isCollapsed ? '▸' : '▾'}
                    </span>
                    <span className="font-mono text-xs font-semibold text-ink">
                      {g.floorId}
                    </span>
                    <span className="text-[11px] text-steel">{g.floorLabel}</span>
                    <span className="ml-auto text-[10px] text-steel">
                      {g.hasDrawing
                        ? `${g.pageCount} page${g.pageCount === 1 ? '' : 's'}`
                        : 'No drawing'}
                    </span>
                  </button>

                  {!isCollapsed ? (
                    <div className="grid grid-cols-[minmax(7rem,0.9fr)_minmax(10rem,1.6fr)_4.5rem_8.5rem_minmax(12rem,1.2fr)] gap-2 border-t border-steel-border/70 px-3 py-2.5 items-center">
                      <div>
                        <div className="font-mono text-xs text-ink">
                          {g.floorId}
                        </div>
                        <div className="text-[11px] text-steel">
                          {g.floorLabel}
                        </div>
                      </div>
                      <div>
                        {g.hasDrawing ? (
                          editingFloorId === g.floorId ? (
                            <input
                              autoFocus
                              className="w-full border border-signal bg-bg px-1.5 py-1 text-xs text-ink outline-none"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onBlur={() => commitEditTitle(g)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  commitEditTitle(g)
                                }
                                if (e.key === 'Escape') {
                                  setEditingFloorId(null)
                                }
                              }}
                              aria-label="Drawing title"
                            />
                          ) : (
                            <button
                              type="button"
                              className="w-full truncate text-left text-xs text-ink hover:underline"
                              title="Click to rename"
                              onClick={() => beginEditTitle(g)}
                            >
                              {g.title}
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-steel">No drawing</span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-ink">
                        {g.hasDrawing ? g.pageCount : '—'}
                      </div>
                      <div>
                        <StatusPill
                          hasDrawing={g.hasDrawing}
                          calibrated={g.calibrated}
                          converting={awaitingFloorId === g.floorId}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {g.hasDrawing ? (
                          <>
                            <GhostButton
                              type="button"
                              className="!px-2 !py-1 text-[11px]"
                              onClick={() =>
                                setViewer({
                                  floorId: g.floorId,
                                  intent: 'view',
                                })
                              }
                            >
                              View
                            </GhostButton>
                            <GhostButton
                              type="button"
                              className="!px-2 !py-1 text-[11px]"
                              onClick={() =>
                                setViewer({
                                  floorId: g.floorId,
                                  intent: 'qto',
                                })
                              }
                            >
                              QTO
                            </GhostButton>
                          </>
                        ) : null}
                        <PrimaryButton
                          type="button"
                          className="!px-2 !py-1 text-[11px]"
                          disabled={uploadMut.isPending}
                          onClick={() => pickReplace(g.floorId)}
                        >
                          {g.hasDrawing ? 'Replace' : 'Upload'}
                        </PrimaryButton>
                      </div>
                    </div>
                  ) : null}
                </section>
              )
            })}
          </div>
        )}
      </div>

      {viewer && viewerGroup?.primarySheet ? (
        <DrawingViewerModal
          intent={viewer.intent}
          sheet={viewerGroup.primarySheet}
          pages={viewerGroup.pages}
          projectId={projectId}
          floorId={viewer.floorId}
          title={viewerGroup.title}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </div>
  )
}

function StatusPill({
  hasDrawing,
  calibrated,
  converting,
}: {
  hasDrawing: boolean
  calibrated: boolean
  converting: boolean
}) {
  if (converting) {
    return (
      <span className="text-[11px] font-medium text-signal">Converting…</span>
    )
  }
  if (!hasDrawing) {
    return <span className="text-[11px] text-steel">No drawing</span>
  }
  if (calibrated) {
    return (
      <span className="text-[11px] font-medium text-emerald-700">
        Calibrated
      </span>
    )
  }
  return (
    <span className="text-[11px] font-medium text-orange-600">
      Not Calibrated
    </span>
  )
}
