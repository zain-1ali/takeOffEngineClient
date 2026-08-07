import { FLOW_STEPS, type FlowStepId } from '../../constants/elementTree'
import { AutosaveStatusLabel, useAutosave } from '../../autosave/AutosaveContext'
import { GhostButton } from '../ui'
import { ThemeToggle } from '../../theme/ThemeToggle'
import type { Project } from '../../types/api'

export function TopBar({
  project,
  activeStep,
  onStep,
  onDashboard,
  onLogout,
  userName,
  floorId,
}: {
  project: Project
  activeStep: FlowStepId
  onStep: (id: FlowStepId) => void
  onDashboard: () => void
  onLogout: () => void
  userName: string
  floorId?: string
}) {
  const { status, flush } = useAutosave()

  return (
    <header className="flex-shrink-0 border-b border-steel-border bg-bg/80 backdrop-blur-sm">
      <div className="flex items-center justify-between px-5 md:px-7 py-3.5 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-[34px] h-[34px] border-2 border-ink flex items-center justify-center font-display font-semibold text-[15px] text-ink flex-shrink-0">
            5D
          </div>
          <div className="min-w-0">
            <div className="font-display font-semibold text-[16px] text-ink leading-tight truncate">
              AgileQS Takeoff
            </div>
            <div className="text-[11px] text-steel uppercase tracking-[1.2px] mt-px">
              Quantity surveying engine
            </div>
          </div>
        </div>

        <div className="hidden md:block font-mono text-xs text-steel text-right min-w-0">
          <div className="truncate text-ink font-medium">{project.name}</div>
          <div className="truncate">
            {floorId ? (
              <>
                Floor <b className="text-ink font-medium">{floorId}</b>
                {' · '}
              </>
            ) : null}
            {project.materials.defaultConcreteGrade} default ·{' '}
            <b className="text-ink font-medium">{project.currency}</b>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <AutosaveStatusLabel status={status} />
          <GhostButton
            className="!px-2.5 !py-1.5 !text-xs"
            title="Save project"
            onClick={() => void flush()}
          >
            Save
          </GhostButton>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => {
              void flush().finally(onDashboard)
            }}
            className="text-xs text-steel hover:text-ink"
          >
            Projects
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="text-xs text-steel hover:text-ink"
            title={userName}
          >
            Log out
          </button>
        </div>
      </div>

      {/* Dimension-line step nav */}
      <nav className="px-6 md:px-10 pt-4 pb-6">
        <div className="dim-line" />
        <div className="flex justify-between relative -top-px">
          {FLOW_STEPS.map((step) => {
            const active = step.id === activeStep
            const num = String(step.num).padStart(2, '0')
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onStep(step.id)}
                className="flex flex-col items-center group bg-transparent border-0 cursor-pointer"
              >
                <span
                  className={`w-0.5 ${
                    active ? 'h-[18px] bg-signal' : 'h-3.5 bg-ink group-hover:bg-steel'
                  }`}
                />
                <span
                  className={`font-mono text-[11px] mt-2 ${
                    active ? 'text-signal font-medium' : 'text-steel group-hover:text-ink'
                  }`}
                >
                  {num}
                </span>
                <span
                  className={`text-[13px] mt-0.5 font-medium ${
                    active ? 'text-ink' : 'text-ink/80 group-hover:text-ink'
                  }`}
                >
                  {step.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </header>
  )
}
