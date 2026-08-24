import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchLayers } from '../api/layers'
import { fetchSheets } from '../api/sheets'
import { fetchTakeoffItems } from '../api/takeoffItems'
import { getProject } from '../api/projectsApi'
import {
  downloadProjectTakeoffCsv,
  downloadSheetTakeoffCsv,
} from '../api/exportPdf'
import { DataTable, GhostButton } from '../components/ui'
import { getColorForItem } from '../lib/itemLayerColor'
import type { TakeoffItem, TakeoffType } from '../types/models'

function formatValue(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return value.toPrecision(6).replace(/\.?0+$/, '')
}

function typeLabel(type: TakeoffType): string {
  switch (type) {
    case 'AREA':
      return 'Area'
    case 'LINEAR':
      return 'Linear'
    case 'COUNT':
      return 'Count'
    default:
      return type
  }
}

function itemLabel(item: TakeoffItem): string {
  return item.label?.trim() || typeLabel(item.type)
}

type TableRow = TakeoffItem & { sheetName: string }

export default function QuantityTakeoffTablePage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const sheetFilter = searchParams.get('sheetId') ?? ''
  const [typeFilter, setTypeFilter] = useState<'ALL' | TakeoffType>('ALL')
  const [csvBusy, setCsvBusy] = useState(false)
  const [csvError, setCsvError] = useState<string | null>(null)

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  })

  const sheetsQuery = useQuery({
    queryKey: ['projects', projectId, 'sheets'],
    queryFn: () => fetchSheets(projectId),
    enabled: Boolean(projectId),
  })

  const layersQuery = useQuery({
    queryKey: ['projects', projectId, 'layers'],
    queryFn: () => fetchLayers(projectId),
    enabled: Boolean(projectId),
  })

  const sheets = sheetsQuery.data ?? []
  const layers = layersQuery.data ?? []
  const sheetIdsKey = sheets.map((sheet) => sheet.id).join(',')

  const itemsQuery = useQuery({
    queryKey: ['projects', projectId, 'quantity-takeoff', sheetIdsKey],
    queryFn: async (): Promise<TableRow[]> => {
      const lists = await Promise.all(
        sheets.map(async (sheet) => {
          const items = await fetchTakeoffItems(sheet.id)
          return items.map((item) => ({ ...item, sheetName: sheet.name }))
        }),
      )
      return lists.flat()
    },
    enabled: sheets.length > 0,
  })

  const rows = useMemo(() => {
    return (itemsQuery.data ?? []).filter((row) => {
      if (sheetFilter && row.sheetId !== sheetFilter) return false
      if (typeFilter !== 'ALL' && row.type !== typeFilter) return false
      return true
    })
  }, [itemsQuery.data, sheetFilter, typeFilter])

  const csvItemCount = useMemo(() => {
    return (itemsQuery.data ?? []).filter((row) => {
      if (sheetFilter && row.sheetId !== sheetFilter) return false
      return true
    }).length
  }, [itemsQuery.data, sheetFilter])

  const totalsByUnit = useMemo(() => {
    const map = new Map<string, { type: TakeoffType; unit: string; value: number; count: number }>()
    for (const row of rows) {
      const key = `${row.type}::${row.unit}`
      const prev = map.get(key)
      if (prev) {
        prev.value += row.calculatedValue
        prev.count += 1
      } else {
        map.set(key, {
          type: row.type,
          unit: row.unit,
          value: row.calculatedValue,
          count: 1,
        })
      }
    }
    return [...map.values()]
  }, [rows])

  const selectedSheet = sheets.find((sheet) => sheet.id === sheetFilter) ?? null
  const projectName = projectQuery.data?.project.name ?? 'Project'

  async function exportCsv(): Promise<void> {
    setCsvError(null)
    setCsvBusy(true)
    try {
      if (sheetFilter) {
        await downloadSheetTakeoffCsv(sheetFilter)
      } else {
        await downloadProjectTakeoffCsv(projectId)
      }
    } catch (error: unknown) {
      setCsvError(error instanceof Error ? error.message : 'CSV export failed')
    } finally {
      setCsvBusy(false)
    }
  }

  if (projectQuery.isLoading || sheetsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <p className="font-display text-sm tracking-wide text-steel uppercase">
          Loading quantity takeoff…
        </p>
      </div>
    )
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <p className="text-sm text-danger">
          {projectQuery.error?.message ?? 'Project not found'}
        </p>
        <Link
          to="/"
          className="mt-6 inline-block font-display text-sm font-bold text-chalk underline underline-offset-4"
        >
          Back to projects
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pt-10">
      <nav className="mb-8 flex flex-wrap items-center gap-3 text-sm">
        <Link
          to={`/projects/${projectId}`}
          className="text-steel transition hover:text-ink"
        >
          Workspace
        </Link>
        <span className="text-steel/40">/</span>
        <Link
          to={`/projects/${projectId}/sheets`}
          className="text-steel transition hover:text-ink"
        >
          Drawings
        </Link>
        {selectedSheet ? (
          <>
            <span className="text-steel/40">/</span>
            <Link
              to={`/projects/${projectId}/sheets/${selectedSheet.id}`}
              className="text-steel transition hover:text-ink"
            >
              {selectedSheet.name}
            </Link>
          </>
        ) : null}
      </nav>

      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-[0.7rem] font-bold tracking-[0.28em] text-chalk uppercase">
            Blueprint record
          </p>
          <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Quantity Takeoff Table
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-steel">
            Flat list of every measurement on{' '}
            {selectedSheet ? 'this sheet' : 'this project'} — including items
            never promoted to a costed element. Separate from BOQ / BOM / Cost
            Plan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GhostButton
            className="!text-xs"
            disabled={csvBusy || csvItemCount === 0}
            onClick={() => void exportCsv()}
          >
            {csvBusy ? 'Exporting…' : 'Export CSV'}
          </GhostButton>
          {selectedSheet ? (
            <Link
              to={`/projects/${projectId}/sheets/${selectedSheet.id}`}
              className="inline-flex items-center justify-center border border-signal bg-signal px-4 py-2 text-[13px] font-medium text-bg hover:brightness-110"
            >
              Open sheet
            </Link>
          ) : null}
        </div>
      </header>

      {csvError ? (
        <p className="mb-4 text-sm text-danger">{csvError}</p>
      ) : null}

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-xs text-steel">
          Sheet
          <select
            value={sheetFilter}
            onChange={(event) => {
              const value = event.target.value
              const next = new URLSearchParams(searchParams)
              if (value) next.set('sheetId', value)
              else next.delete('sheetId')
              setSearchParams(next, { replace: true })
            }}
            className="mt-1 block min-w-[12rem] border border-steel-border bg-bg px-2 py-1.5 text-sm text-ink outline-none"
          >
            <option value="">All sheets</option>
            {sheets.map((sheet) => (
              <option key={sheet.id} value={sheet.id}>
                {sheet.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-steel">
          Type
          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as 'ALL' | TakeoffType)
            }
            className="mt-1 block min-w-[8rem] border border-steel-border bg-bg px-2 py-1.5 text-sm text-ink outline-none"
          >
            <option value="ALL">All types</option>
            <option value="AREA">Area</option>
            <option value="LINEAR">Linear</option>
            <option value="COUNT">Count</option>
          </select>
        </label>
        <p className="text-xs text-steel">
          {rows.length} measurement{rows.length === 1 ? '' : 's'}
          {sheetFilter ? '' : ` · ${projectName}`}
        </p>
      </div>

      {itemsQuery.isLoading ? (
        <p className="text-sm text-steel">Loading measurements…</p>
      ) : null}

      {itemsQuery.isError ? (
        <p className="text-sm text-danger">
          {itemsQuery.error instanceof Error
            ? itemsQuery.error.message
            : 'Failed to load measurements'}
        </p>
      ) : null}

      {!itemsQuery.isLoading && !itemsQuery.isError && rows.length === 0 ? (
        <p className="border border-steel-border bg-panel px-4 py-8 text-sm text-steel">
          No measurements yet. Trace Area, Linear, or Count on a sheet — they
          appear here even if they are never promoted.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="border border-steel-border bg-panel">
          <DataTable>
            <DataTable.Header>
              <DataTable.Row>
                <DataTable.HeaderCell>Sheet Name</DataTable.HeaderCell>
                <DataTable.HeaderCell>Type</DataTable.HeaderCell>
                <DataTable.HeaderCell>Label</DataTable.HeaderCell>
                <DataTable.HeaderCell align="right">Value</DataTable.HeaderCell>
                <DataTable.HeaderCell>Unit</DataTable.HeaderCell>
                <DataTable.HeaderCell>Layer</DataTable.HeaderCell>
                <DataTable.HeaderCell>Source</DataTable.HeaderCell>
                <DataTable.HeaderCell>Promoted</DataTable.HeaderCell>
              </DataTable.Row>
            </DataTable.Header>
            <DataTable.Body>
              {rows.map((row) => {
                const layerColor = getColorForItem(row, layers)
                const layerName =
                  layers.find((layer) => layer.id === row.layerId)?.name ??
                  'Uncategorized'
                return (
                  <DataTable.Row key={row.id}>
                    <DataTable.Cell>
                      <Link
                        to={`/projects/${projectId}/sheets/${row.sheetId}`}
                        className="text-chalk hover:underline"
                      >
                        {row.sheetName}
                      </Link>
                    </DataTable.Cell>
                    <DataTable.Cell>{typeLabel(row.type)}</DataTable.Cell>
                    <DataTable.Cell>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 border border-steel-border"
                          style={{ backgroundColor: layerColor.color }}
                          aria-hidden
                        />
                        {itemLabel(row)}
                      </span>
                    </DataTable.Cell>
                    <DataTable.Cell numeric>
                      {formatValue(row.calculatedValue)}
                    </DataTable.Cell>
                    <DataTable.Cell>{row.unit}</DataTable.Cell>
                    <DataTable.Cell className="text-steel">{layerName}</DataTable.Cell>
                    <DataTable.Cell>
                      {row.source === 'AI_SUGGESTED' ? 'AI Est.' : 'Manual'}
                    </DataTable.Cell>
                    <DataTable.Cell>
                      {row.promotedInstanceId ? (
                        <span className="text-[0.65rem] uppercase tracking-wide text-verified">
                          Yes
                        </span>
                      ) : (
                        <span className="text-steel">—</span>
                      )}
                    </DataTable.Cell>
                  </DataTable.Row>
                )
              })}
            </DataTable.Body>
            {totalsByUnit.length > 0 ? (
              <DataTable.Footer>
                {totalsByUnit.map((total) => (
                  <DataTable.Row
                    key={`${total.type}-${total.unit}`}
                    totals={totalsByUnit.length === 1}
                  >
                    <DataTable.Cell className="text-steel" />
                    <DataTable.Cell>{typeLabel(total.type)}</DataTable.Cell>
                    <DataTable.Cell className="text-steel">
                      {total.count} item{total.count === 1 ? '' : 's'}
                    </DataTable.Cell>
                    <DataTable.Cell numeric>
                      {formatValue(total.value)}
                    </DataTable.Cell>
                    <DataTable.Cell>{total.unit}</DataTable.Cell>
                    <DataTable.Cell />
                    <DataTable.Cell />
                    <DataTable.Cell />
                  </DataTable.Row>
                ))}
              </DataTable.Footer>
            ) : null}
          </DataTable>
        </div>
      ) : null}
    </div>
  )
}
