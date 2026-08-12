import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCostPlan } from '../../api/projectsApi'
import { useAutosave } from '../../autosave/AutosaveContext'
import { exportCostPlanExcel } from '../../lib/exportCostPlanExcel'
import { exportCostPlanPDF } from '../../lib/exportBills'
import {
  type ReportThemeId,
  resolveReportTheme,
} from '../../lib/reportThemes'
import { formatMoney } from '../../lib/units'
import type { Project } from '../../types/api'
import { GhostButton, PrimaryButton } from '../ui'
import { CostPlanThemedPreview } from './CostPlanThemedPreview'
import { ReportThemePicker } from './ReportThemePicker'

type Scope = 'floor' | 'project'

export function CostPlanExportScreen({
  project,
  floorId,
  onDone,
}: {
  project: Project
  floorId: string
  onDone: () => void
}) {
  const { schedule } = useAutosave()
  const previewRef = useRef<HTMLDivElement>(null)
  const [scope, setScope] = useState<Scope>('project')
  const [themeId, setThemeId] = useState<ReportThemeId>(() =>
    resolveReportTheme(project.reportTheme).id,
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [shareMsg, setShareMsg] = useState<string | null>(null)

  useEffect(() => {
    setThemeId(resolveReportTheme(project.reportTheme).id)
  }, [project.id, project.reportTheme])

  const costPlanQuery = useQuery({
    queryKey: [
      'cost-plan',
      project.id,
      scope,
      scope === 'floor' ? floorId : 'all',
      project.gfaM2,
      project.designAllowancePercent,
      project.overheadPercent,
      project.profitPercent,
      project.inflationPercent,
      project.useRateAnalysis,
      project.currency,
      project.updatedAt,
    ],
    queryFn: () =>
      getCostPlan(project.id, {
        scope,
        floorId: scope === 'floor' ? floorId : undefined,
      }),
  })

  function selectTheme(id: ReportThemeId) {
    setThemeId(id)
    schedule({
      kind: 'project',
      projectId: project.id,
      patch: { reportTheme: id },
    })
  }

  async function rebuild() {
    setBusy('rebuild')
    setShareMsg(null)
    try {
      await costPlanQuery.refetch()
    } finally {
      setBusy(null)
    }
  }

  async function doExcel() {
    if (!costPlanQuery.data) return
    setBusy('excel')
    try {
      await exportCostPlanExcel(project, costPlanQuery.data, themeId)
    } catch {
      alert('Excel export failed.')
    } finally {
      setBusy(null)
    }
  }

  function doPdf() {
    if (!costPlanQuery.data) return
    setBusy('pdf')
    try {
      exportCostPlanPDF(project, costPlanQuery.data, themeId)
    } finally {
      setBusy(null)
    }
  }

  function doPrint() {
    const el = previewRef.current
    if (!el) return
    const theme = resolveReportTheme(themeId)
    const win = window.open('', '_blank')
    if (!win) {
      alert('Please allow pop-ups to print.')
      return
    }
    win.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8">` +
        `<title>${project.name} — Cost Plan</title>` +
        `<style>` +
        `body{margin:0;font-family:Arial,Helvetica,sans-serif;background:${theme.colors.paper};}` +
        `@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}` +
        `</style></head><body>${el.innerHTML}</body></html>`,
    )
    win.document.close()
    setTimeout(() => {
      win.focus()
      win.print()
    }, 300)
  }

  async function doShare() {
    const url = `${window.location.origin}/projects/${project.id}`
    const theme = resolveReportTheme(themeId)
    const text = [
      `${project.name} — Cost Plan`,
      `Theme: ${theme.name}`,
      costPlanQuery.data
        ? `SCC: ${formatMoney(costPlanQuery.data.cascade.constructionCostSCC, costPlanQuery.data.currency)}`
        : null,
      url,
    ]
      .filter(Boolean)
      .join('\n')

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${project.name} — Cost Plan`,
          text,
          url,
        })
        setShareMsg('Shared')
      } else {
        await navigator.clipboard.writeText(text)
        setShareMsg('Link copied to clipboard')
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url)
        setShareMsg('Project link copied')
      } catch {
        setShareMsg('Could not share — copy this URL: ' + url)
      }
    }
    setTimeout(() => setShareMsg(null), 3500)
  }

  const disabled = !!busy || costPlanQuery.isFetching

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Unified action bar */}
      <div className="flex-shrink-0 border-b border-steel-border bg-panel px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-2 min-w-0">
            <h2 className="font-display text-lg font-semibold text-ink truncate">
              Export Cost Plan
            </h2>
            <p className="text-[12px] text-steel">
              Theme, preview, and export in one place
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 ml-auto">
            <GhostButton
              className="!text-xs !py-1.5 !px-3"
              disabled={disabled}
              onClick={() => void rebuild()}
            >
              {busy === 'rebuild' || costPlanQuery.isFetching ? 'Rebuilding…' : 'Rebuild'}
            </GhostButton>
            <GhostButton
              className="!text-xs !py-1.5 !px-3"
              disabled={disabled || !costPlanQuery.data}
              onClick={() => void doExcel()}
            >
              {busy === 'excel' ? 'Excel…' : 'Excel'}
            </GhostButton>
            <GhostButton
              className="!text-xs !py-1.5 !px-3"
              disabled={disabled || !costPlanQuery.data}
              onClick={doPdf}
            >
              PDF
            </GhostButton>
            <GhostButton
              className="!text-xs !py-1.5 !px-3"
              disabled={!costPlanQuery.data}
              onClick={doPrint}
            >
              Print
            </GhostButton>
            <GhostButton
              className="!text-xs !py-1.5 !px-3"
              disabled={!costPlanQuery.data}
              onClick={() => void doShare()}
            >
              Share
            </GhostButton>
            <PrimaryButton className="!text-xs !py-1.5 !px-3" onClick={onDone}>
              Done
            </PrimaryButton>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3">
          <span className="text-xs text-steel">Scope</span>
          {(
            [
              ['project', 'Whole project'],
              ['floor', 'This floor'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setScope(id)}
              className={`text-xs px-3 py-1.5 border ${
                scope === id
                  ? 'border-ink text-ink bg-panel-hover'
                  : 'border-steel-border text-steel hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
          {shareMsg && (
            <span className="text-xs text-signal ml-2">{shareMsg}</span>
          )}
          {costPlanQuery.data && (
            <span className="text-[12px] text-steel ml-auto">
              Elemental{' '}
              <span className="text-ink font-medium">
                {formatMoney(
                  costPlanQuery.data.cascade.elementalCost,
                  costPlanQuery.data.currency,
                )}
              </span>
              {' · '}
              SCC{' '}
              <span className="text-ink font-medium">
                {formatMoney(
                  costPlanQuery.data.cascade.constructionCostSCC,
                  costPlanQuery.data.currency,
                )}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        <ReportThemePicker value={themeId} onChange={selectTheme} />

        {costPlanQuery.isLoading && (
          <p className="text-sm text-steel">Building Cost Plan…</p>
        )}
        {costPlanQuery.isError && (
          <p className="text-sm text-danger">
            Failed to load Cost Plan.{' '}
            <button type="button" className="underline" onClick={() => void rebuild()}>
              Retry
            </button>
          </p>
        )}

        {costPlanQuery.data && (
          <div ref={previewRef}>
            <CostPlanThemedPreview
              data={costPlanQuery.data}
              themeId={themeId}
              projectName={project.name}
            />
          </div>
        )}
      </div>
    </div>
  )
}
