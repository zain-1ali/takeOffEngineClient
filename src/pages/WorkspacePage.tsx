import { useMemo, useState } from 'react'
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
import { ELEMENT_ENGINES } from '../elementEngines'
import { findElement, type FlowStepId } from '../constants/elementTree'
import type { ElementDef } from '../constants/elementTree'

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
  const currentFloorId = floorId || floors[0]?.floorId || 'FDN'

  const countsQuery = useQuery({
    queryKey: ['instance-counts', projectId, currentFloorId],
    queryFn: async () => {
      const { instances } = await listInstances(projectId, { floorId: currentFloorId })
      const counts: Record<string, number> = {}
      instances.forEach((i) => {
        counts[i.elementKey] = (counts[i.elementKey] || 0) + 1
      })
      return counts
    },
    enabled: !!projectId && !!currentFloorId,
  })

  const element = useMemo(() => findElement(elementKey), [elementKey])
  const showProjectReports = activeStep === 'reports'
  const showElementRegister = activeStep === 'register'

  function onStep(id: FlowStepId) {
    if (id === 'project') setModal('project')
    else if (id === 'floors') setModal('floors')
    else if (id === 'grid') setModal('grid')
    else if (id === 'model') {
      setActiveStep('model')
      setTab('schedule')
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
          selectedKey={showElementRegister ? '' : elementKey}
          counts={countsQuery.data || {}}
          onSelect={onSelectElement}
          registerActive={showElementRegister}
          onOpenRegister={() => setActiveStep('register')}
        />

        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-bg/20">
          <div className="flex items-center gap-3 px-6 pt-4 flex-shrink-0">
            <label className="text-xs text-steel flex items-center gap-2">
              Floor
              <select
                className="border border-steel-border bg-panel px-2 py-1 text-xs text-ink font-mono outline-none"
                value={currentFloorId}
                onChange={(e) => setFloorId(e.target.value)}
              >
                {floors.map((f) => (
                  <option key={f.id} value={f.floorId}>
                    {f.floorId} — {f.label}
                  </option>
                ))}
              </select>
            </label>
            <FloorDrawingBar projectId={projectId} floorId={currentFloorId} />
            {showProjectReports && (
              <span className="text-xs text-steel/70">Used when scope is “This floor”</span>
            )}
            {showElementRegister && (
              <span className="text-xs text-steel/70">
                Master takeoff mapping — units, rules, materials, NRM2, overlap
              </span>
            )}
            <Link
              to={`/projects/${projectId}/quantity-takeoff`}
              className="ml-auto font-display text-xs font-bold tracking-wide text-chalk uppercase hover:text-ink"
            >
              QTO table
            </Link>
          </div>

          {!showProjectReports && !showElementRegister && (
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
            {showElementRegister ? (
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
                {tab === 'schedule' && ELEMENT_ENGINES[elementKey] && (
                  <ScheduleTab
                    project={project}
                    floors={floors}
                    floorId={currentFloorId}
                    elementKey={elementKey}
                  />
                )}
                {tab === 'schedule' && !ELEMENT_ENGINES[elementKey] && (
                  <div className="p-8 text-sm text-steel">
                    {element?.label || elementKey} is planned but not implemented yet.
                  </div>
                )}
                {tab === 'model' && ELEMENT_ENGINES[elementKey] && (
                  <ModelTab
                    project={project}
                    floorId={currentFloorId}
                    elementKey={elementKey}
                  />
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
