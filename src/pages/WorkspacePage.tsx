import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getProject, listInstances } from '../api/projectsApi'
import { useAuth } from '../auth/AuthContext'
import { ElementTree } from '../components/layout/ElementTree'
import { TopBar } from '../components/layout/TopBar'
import { FloorsModal } from '../components/modals/FloorsModal'
import { GridModal } from '../components/modals/GridModal'
import { ProjectModal } from '../components/modals/ProjectModal'
import { FloorDrawingBar } from '../components/FloorDrawingBar'
import { ScheduleTab } from '../components/schedule/ScheduleTab'
import { ModelTab } from '../components/model/ModelTab'
import { ElementReportsTab } from '../components/reports/ElementReportsTab'
import { ProjectReportsView } from '../components/reports/ProjectReportsView'
import { ElementRegisterView } from '../components/register/ElementRegisterView'
import { DrawingsRegisterView } from '../components/drawings/DrawingsRegisterView'
import { ELEMENT_ENGINES } from '../elementEngines'
import { findElement, type FlowStepId } from '../constants/elementTree'
import type { ElementDef } from '../constants/elementTree'
import { findRegisterEntry } from '../constants/elementRegister'
import {
  emptyCompatibleFloorsMessage,
  filterFloorsForElement,
} from '../lib/levelCompatibility'

type WorkspaceTab = 'schedule' | 'model' | 'boq' | 'bom' | 'labour'

export default function WorkspacePage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [activeStep, setActiveStep] = useState<FlowStepId>('model')
  const [modal, setModal] = useState<'project' | 'floors' | 'grid' | null>(null)
  const [elementKey, setElementKey] = useState('PAD_FOOTING')
  const [floorId, setFloorId] = useState<string | null>(null)
  const [tab, setTab] = useState<WorkspaceTab>('schedule')

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
  })

  const project = projectQuery.data?.project
  const floors = projectQuery.data?.floors ?? []

  const showProjectReports = activeStep === 'reports'
  const showElementRegister = activeStep === 'register'
  const showDrawingsRegister = activeStep === 'drawings'
  const hideElementWorkspace =
    showProjectReports || showElementRegister || showDrawingsRegister

  const registerEntry = useMemo(
    () => findRegisterEntry(elementKey),
    [elementKey],
  )
  const element = useMemo(() => findElement(elementKey), [elementKey])

  /** Floors that already host this element (for dropdown exception rule). */
  const elementFloorsQuery = useQuery({
    queryKey: ['element-floor-ids', projectId, elementKey],
    queryFn: async () => {
      const { instances } = await listInstances(projectId, { elementKey })
      return new Set(instances.map((i) => i.floorId))
    },
    enabled: !!projectId && !!elementKey && !hideElementWorkspace,
  })

  const floorIdsWithElement = elementFloorsQuery.data ?? new Set<string>()

  const floorOptions = useMemo(
    () =>
      filterFloorsForElement({
        floors,
        allowedLevelTypes: registerEntry?.allowedLevelTypes,
        floorIdsWithElementInstances: floorIdsWithElement,
      }),
    [floors, registerEntry?.allowedLevelTypes, floorIdsWithElement],
  )

  const currentFloorId =
    floorId && floorOptions.some((f) => f.floorId === floorId)
      ? floorId
      : floorOptions[0]?.floorId ?? floors[0]?.floorId ?? 'FND'

  const currentFloorOption = floorOptions.find(
    (f) => f.floorId === currentFloorId,
  )
  const floorIsExceptionOnly = Boolean(
    currentFloorOption && !currentFloorOption.compatible,
  )

  useEffect(() => {
    if (hideElementWorkspace) return
    if (floorOptions.length === 0) return
    if (!floorOptions.some((f) => f.floorId === currentFloorId)) {
      setFloorId(floorOptions[0].floorId)
    }
  }, [hideElementWorkspace, floorOptions, currentFloorId])

  const countsQuery = useQuery({
    queryKey: ['instance-counts', projectId, currentFloorId],
    queryFn: async () => {
      const { instances } = await listInstances(projectId, {
        floorId: currentFloorId,
      })
      const counts: Record<string, number> = {}
      instances.forEach((i) => {
        counts[i.elementKey] = (counts[i.elementKey] || 0) + 1
      })
      return counts
    },
    enabled: !!projectId && !!currentFloorId && floorOptions.length > 0,
  })

  function onStep(id: FlowStepId) {
    if (id === 'project') setModal('project')
    else if (id === 'floors') setModal('floors')
    else if (id === 'grid') setModal('grid')
    else if (id === 'model') {
      setActiveStep('model')
      setTab('schedule')
    } else if (id === 'drawings') {
      setActiveStep('drawings')
    } else if (id === 'register') {
      setActiveStep('register')
    } else if (id === 'reports') {
      setActiveStep('reports')
    }
  }

  function onSelectElement(el: ElementDef) {
    if (!el.implemented) return
    setElementKey(el.key)
    setActiveStep('model')
    setTab('schedule')
  }

  if (projectQuery.isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-steel">
        Loading project…
      </div>
    )
  }

  if (!project) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-sm">
        <p className="text-danger">Project not found</p>
        <button type="button" className="text-chalk hover:underline" onClick={() => navigate('/')}>
          Back to dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <TopBar
        project={project}
        activeStep={activeStep}
        onStep={onStep}
        onDashboard={() => navigate('/')}
        onLogout={() => void logout()}
        userName={user?.name || ''}
        floorId={currentFloorId}
      />

      <div className="flex-1 flex min-h-0 border-t border-steel-border">
        <ElementTree
          selectedKey={hideElementWorkspace ? '' : elementKey}
          counts={countsQuery.data || {}}
          onSelect={onSelectElement}
          projectId={projectId}
          floorId={currentFloorId}
          onBoqItemsAdded={(key) => {
            setElementKey(key)
            setActiveStep('model')
            setTab('boq')
          }}
          registerActive={showElementRegister}
          onOpenRegister={() => setActiveStep('register')}
          drawingsActive={showDrawingsRegister}
          onOpenDrawings={() => setActiveStep('drawings')}
        />

        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-bg/20">
          <div className="flex items-center gap-3 px-6 pt-4 flex-shrink-0">
            <label className="text-xs text-steel flex items-center gap-2 min-w-0">
              Floor
              {!hideElementWorkspace && floorOptions.length === 0 ? (
                <span className="text-amber-200/90 max-w-md leading-snug">
                  {emptyCompatibleFloorsMessage({
                    elementLabel: element?.label || elementKey,
                    allowedLevelTypes: registerEntry?.allowedLevelTypes,
                  })}
                </span>
              ) : (
                <select
                  className="border border-steel-border bg-panel px-2 py-1 text-xs text-ink font-mono outline-none max-w-xs"
                  value={currentFloorId}
                  onChange={(e) => setFloorId(e.target.value)}
                  disabled={
                    !hideElementWorkspace && floorOptions.length === 0
                  }
                >
                  {(hideElementWorkspace ? floors : floorOptions).map((f) => {
                    const exception =
                      'exception' in f ? Boolean(f.exception) : false
                    return (
                      <option key={f.id} value={f.floorId}>
                        {exception ? '⚠ ' : ''}
                        {f.floorId} — {f.label}
                        {exception ? ' (flagged items)' : ''}
                      </option>
                    )
                  })}
                </select>
              )}
            </label>
            {!showDrawingsRegister && floorOptions.length > 0 ? (
              <FloorDrawingBar projectId={projectId} floorId={currentFloorId} />
            ) : null}
            {showProjectReports && (
              <span className="text-xs text-steel/70">Used when scope is “This floor”</span>
            )}
            {showElementRegister && (
              <span className="text-xs text-steel/70">
                Master takeoff mapping — units, rules, materials, NRM2, overlap
              </span>
            )}
            {showDrawingsRegister && (
              <span className="text-xs text-steel/70">
                Project drawings — one PDF per floor
              </span>
            )}
            <Link
              to={`/projects/${projectId}/quantity-takeoff`}
              className="ml-auto font-display text-xs font-bold tracking-wide text-chalk uppercase hover:text-ink"
            >
              QTO table
            </Link>
          </div>

          {!hideElementWorkspace && (
            <div className="flex gap-0.5 px-6 mt-3 border-b border-steel-border flex-shrink-0">
              {(
                [
                  ['schedule', 'Schedule'],
                  ['model', '3D Model'],
                  ['boq', 'BOQ'],
                  ['bom', 'BOM'],
                  ['labour', 'Labour'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setActiveStep('model')
                    setTab(id)
                  }}
                  className={`text-[13px] font-medium px-4 py-2.5 ${
                    tab === id
                      ? 'text-ink border-b-2 border-signal -mb-px'
                      : 'text-steel hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-hidden">
            {showDrawingsRegister ? (
              <DrawingsRegisterView
                projectId={projectId}
                floors={floors}
                onOpenFloor={(fid) => {
                  setFloorId(fid)
                  setActiveStep('model')
                  setTab('schedule')
                }}
              />
            ) : showElementRegister ? (
              <ElementRegisterView
                onOpenElement={(key) => {
                  setElementKey(key)
                  setActiveStep('model')
                  setTab('schedule')
                }}
              />
            ) : showProjectReports ? (
              <ProjectReportsView
                project={project}
                floorId={currentFloorId}
                onDone={() => {
                  setActiveStep('model')
                  setTab('schedule')
                }}
              />
            ) : (
              <>
                {tab === 'schedule' && ELEMENT_ENGINES[elementKey] && floorOptions.length > 0 && (
                  <ScheduleTab
                    project={project}
                    floors={floors}
                    floorId={currentFloorId}
                    elementKey={elementKey}
                    floorLevelException={floorIsExceptionOnly}
                  />
                )}
                {tab === 'schedule' && ELEMENT_ENGINES[elementKey] && floorOptions.length === 0 && (
                  <div className="p-8 text-sm text-amber-200/90 max-w-lg">
                    {emptyCompatibleFloorsMessage({
                      elementLabel: element?.label || elementKey,
                      allowedLevelTypes: registerEntry?.allowedLevelTypes,
                    })}
                  </div>
                )}
                {tab === 'schedule' && !ELEMENT_ENGINES[elementKey] && (
                  <div className="p-8 text-sm text-steel">
                    {element?.label || elementKey} is planned but not implemented yet.
                  </div>
                )}
                {tab === 'model' && ELEMENT_ENGINES[elementKey] && floorOptions.length > 0 && (
                  <ModelTab
                    project={project}
                    floorId={currentFloorId}
                    elementKey={elementKey}
                  />
                )}
                {tab === 'model' && ELEMENT_ENGINES[elementKey] && floorOptions.length === 0 && (
                  <div className="p-8 text-sm text-amber-200/90 max-w-lg">
                    {emptyCompatibleFloorsMessage({
                      elementLabel: element?.label || elementKey,
                      allowedLevelTypes: registerEntry?.allowedLevelTypes,
                    })}
                  </div>
                )}
                {tab === 'model' && !ELEMENT_ENGINES[elementKey] && (
                  <div className="p-8 text-sm text-steel">
                    3D is not available for {element?.label || elementKey} yet.
                  </div>
                )}
                {(tab === 'boq' || tab === 'bom' || tab === 'labour') && (
                  <ElementReportsTab
                    project={project}
                    floorId={currentFloorId}
                    elementKey={elementKey}
                    sub={tab}
                    onOpenSchedule={() => setTab('schedule')}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>

      <ProjectModal
        open={modal === 'project'}
        onClose={() => setModal(null)}
        project={project}
      />
      <FloorsModal
        open={modal === 'floors'}
        onClose={() => setModal(null)}
        projectId={project.id}
        floors={floors}
      />
      <GridModal
        open={modal === 'grid'}
        onClose={() => setModal(null)}
        project={project}
      />
    </div>
  )
}
