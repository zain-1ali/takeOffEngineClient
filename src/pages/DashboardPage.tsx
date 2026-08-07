import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createProject, deleteProject, getDashboard } from '../api/projectsApi'
import { useAuth } from '../auth/AuthContext'
import { GhostButton, PrimaryButton, StatCard, VerifiedRibbon } from '../components/ui'
import { ThemeToggle } from '../theme/ThemeToggle'
import type { DashboardProjectCard } from '../types/api'

function greeting(name: string): string {
  const hour = new Date().getHours()
  const part =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const first = name.trim().split(/\s+/)[0] || 'there'
  return `${part}, ${first}`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const mins = Math.round((Date.now() - t) / 60_000)
  if (mins < 1) return 'Edited just now'
  if (mins < 60) return `Edited ${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `Edited ${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days === 1) return 'Edited yesterday'
  if (days < 14) return `Edited ${days} days ago`
  return `Edited ${new Date(iso).toLocaleDateString()}`
}

/** Split a currency total into StatCard value + unit (e.g. 18.4 + "M KES"). */
function formatStatMoney(value: number, currency: string): { value: string; unit: string } {
  if (value >= 1_000_000) {
    return { value: (value / 1_000_000).toFixed(1), unit: `M ${currency}` }
  }
  if (value >= 1_000) {
    return { value: (value / 1_000).toFixed(1), unit: `k ${currency}` }
  }
  return { value: value.toFixed(0), unit: currency }
}

function cardPrice(value: number, currency: string): string {
  if (value >= 1_000_000) return `${currency} ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${currency} ${(value / 1_000).toFixed(1)}k`
  return `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const dashQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  })

  const createMut = useMutation({
    mutationFn: (name: string) => createProject(name.trim() || 'Untitled Project'),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void qc.invalidateQueries({ queryKey: ['projects'] })
      setCreating(false)
      setNewName('')
      navigate(`/projects/${data.project.id}`)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const stats = dashQuery.data?.stats
  const projects = dashQuery.data?.projects ?? []
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return projects
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.number.toLowerCase().includes(q) ||
        p.client.toLowerCase().includes(q),
    )
  }, [projects, search])

  const showOnboardingTips = projects.length <= 1
  const isEmpty = projects.length === 0
  const displayName = user?.name || 'there'
  const pricedStat = formatStatMoney(stats?.totalPricedValue ?? 0, stats?.currency ?? 'USD')

  function startCreate() {
    setCreating(true)
    setNewName('')
  }

  function onCreate(e: FormEvent) {
    e.preventDefault()
    createMut.mutate(newName)
  }

  const summaryLine = (() => {
    const n = stats?.activeProjects ?? 0
    const pending = stats?.pendingReview ?? 0
    const proj = `${n} active project${n === 1 ? '' : 's'}`
    if (pending > 0) {
      return `${proj} · ${pending} unpriced item${pending === 1 ? '' : 's'}`
    }
    return `${proj} · all priced`
  })()

  return (
    <div className="min-h-full px-6 py-8 md:px-10 md:py-10">
      <div className="max-w-[1180px] mx-auto">
        <header className="flex items-center justify-between pb-5">
          <div className="flex items-center gap-3">
            <div className="w-[34px] h-[34px] border-2 border-ink flex items-center justify-center font-display font-semibold text-[15px] text-ink">
              5D
            </div>
            <div>
              <div className="font-display font-semibold text-[16px] text-ink leading-tight">
                AgileQS Takeoff
              </div>
              <div className="text-[11px] text-steel uppercase tracking-[1.2px] mt-px">
                Quantity surveying engine
              </div>
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2.5 text-[13px] text-steel hover:text-ink"
            >
              <span className="w-7 h-7 rounded-full bg-panel-hover border border-steel-border flex items-center justify-center font-mono text-[11px] text-ink">
                {initials(displayName)}
              </span>
              <span className="hidden sm:inline">{displayName}</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-panel border border-steel-border p-2 z-20 shadow-lg">
                <div className="px-2 py-1.5 text-[11px] text-steel font-mono truncate">
                  {user?.email}
                </div>
                <div className="px-1 py-1">
                  <ThemeToggle className="w-full justify-start" />
                </div>
                <button
                  type="button"
                  className="w-full text-left text-[13px] px-2 py-1.5 text-steel hover:text-ink"
                  onClick={() => void logout()}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </header>

        {dashQuery.isLoading && (
          <p className="text-sm text-steel py-16 text-center">Loading your projects…</p>
        )}

        {!dashQuery.isLoading && isEmpty && (
          <EmptyHome
            name={displayName}
            creating={creating}
            newName={newName}
            setNewName={setNewName}
            onStart={startCreate}
            onCancel={() => setCreating(false)}
            onSubmit={onCreate}
            pending={createMut.isPending}
          />
        )}

        {!dashQuery.isLoading && !isEmpty && (
          <>
            <div className="flex flex-wrap justify-between items-end gap-4 py-7 border-b border-steel-border mb-6">
              <div>
                <h1 className="font-display text-2xl font-semibold text-ink mb-1.5">
                  {greeting(displayName)}
                </h1>
                <p className="text-[13.5px] text-steel">{summaryLine}</p>
              </div>
              <PrimaryButton onClick={startCreate}>+ New project</PrimaryButton>
            </div>

            {creating && (
              <form
                onSubmit={onCreate}
                className="mb-6 flex flex-wrap gap-2 items-end border border-steel-border bg-panel p-4"
              >
                <label className="flex-1 min-w-[12rem] text-sm">
                  <span className="text-steel text-xs">Project name</span>
                  <input
                    autoFocus
                    className="mt-1 w-full border border-steel-border bg-bg px-3 py-2 text-sm text-ink outline-none font-sans"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Tower A — Substructure"
                  />
                </label>
                <PrimaryButton type="submit" disabled={createMut.isPending}>
                  {createMut.isPending ? 'Creating…' : 'Create'}
                </PrimaryButton>
                <GhostButton type="button" onClick={() => setCreating(false)}>
                  Cancel
                </GhostButton>
              </form>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-8">
              <StatCard label="Active projects" value={stats?.activeProjects ?? 0} />
              <StatCard label="Elements modelled" value={stats?.elementsModelled ?? 0} />
              <StatCard
                label="Hand-calc verified"
                value={stats?.handCalcVerifiedPct ?? 100}
                unit="%"
                accent="verified"
              />
              <StatCard
                label="Total priced value"
                value={pricedStat.value}
                unit={pricedStat.unit}
                accent="signal"
              />
            </div>
            {stats?.handCalcVerifiedIsPlaceholder && (
              <p className="text-[11px] text-steel -mt-6 mb-6">
                Hand-calc verified is a placeholder (100%) until verification is modelled.
              </p>
            )}

            <div className="flex flex-wrap justify-between items-center gap-3 mb-3.5">
              <h2 className="font-display text-[15px] font-semibold text-ink">Your projects</h2>
              <input
                className="text-[12.5px] text-steel border border-steel-border bg-panel px-3 py-1.5 w-[220px] font-sans outline-none focus:border-signal placeholder:text-steel"
                placeholder="Search projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-9">
              {filtered.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onOpen={() => navigate(`/projects/${p.id}`)}
                  onDelete={() => {
                    if (confirm(`Delete “${p.name}”?`)) deleteMut.mutate(p.id)
                  }}
                />
              ))}
              <button
                type="button"
                onClick={startCreate}
                className="border border-dashed border-steel-border min-h-[150px] flex flex-col items-center justify-center gap-2 text-steel hover:border-steel hover:text-ink transition-colors"
              >
                <span className="font-display text-[22px] text-signal leading-none">+</span>
                <span className="text-[13px]">Start a new takeoff</span>
              </button>
            </div>

            <div
              className={`grid gap-5 ${showOnboardingTips ? 'md:grid-cols-[1.3fr_1fr]' : 'grid-cols-1'}`}
            >
              <section className="bg-panel border border-steel-border px-5 py-[18px]">
                <h2 className="font-display text-sm font-semibold text-ink mb-3.5">
                  Recent activity
                </h2>
                {(dashQuery.data?.recentActivity?.length ?? 0) === 0 ? (
                  <p className="text-[12.5px] text-steel py-2">
                    No activity yet. Edits, rates, and exports will show up here once activity
                    logging is added.
                  </p>
                ) : (
                  dashQuery.data!.recentActivity.map((a) => (
                    <div
                      key={a.id}
                      className="flex justify-between items-center py-2.5 border-b border-gridline last:border-0 text-[12.5px]"
                    >
                      <span className="text-ink">{a.description}</span>
                      <span className="font-mono text-[11px] text-steel">
                        {relativeTime(a.createdAt).replace(/^Edited /, '')}
                      </span>
                    </div>
                  ))
                )}
              </section>

              {showOnboardingTips && (
                <section className="bg-panel border border-steel-border px-5 py-[18px]">
                  <h2 className="font-display text-sm font-semibold text-ink mb-3.5">
                    Getting started
                  </h2>
                  <Tip n="01" title="Set up project defaults">
                    Currency, concrete classes, and finishes standards.
                  </Tip>
                  <Tip n="02" title="Model your elements">
                    Enter dimensions — the engine measures automatically.
                  </Tip>
                  <Tip n="03" title="Export a priced BOQ">
                    Ready for tender the moment rates are attached.
                  </Tip>
                </section>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Tip({ n, title, children }: { n: string; title: string; children: string }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-gridline last:border-0">
      <div className="font-mono text-signal-text text-xs min-w-[18px]">{n}</div>
      <div>
        <b className="text-[12.5px] font-medium text-ink block mb-0.5">{title}</b>
        <span className="text-[11.5px] text-steel">{children}</span>
      </div>
    </div>
  )
}

function EmptyHome({
  name,
  creating,
  newName,
  setNewName,
  onStart,
  onCancel,
  onSubmit,
  pending,
}: {
  name: string
  creating: boolean
  newName: string
  setNewName: (v: string) => void
  onStart: () => void
  onCancel: () => void
  onSubmit: (e: FormEvent) => void
  pending: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center min-h-[60vh] px-4">
      <h1 className="font-display text-2xl md:text-[28px] font-semibold text-ink mb-3">
        {greeting(name)}
      </h1>
      <p className="text-[13.5px] text-steel max-w-md mb-8 leading-relaxed">
        Start your first takeoff — set project defaults, model elements, and export a priced BOQ
        when rates are ready.
      </p>
      {!creating ? (
        <PrimaryButton onClick={onStart}>+ New project</PrimaryButton>
      ) : (
        <form onSubmit={onSubmit} className="w-full max-w-md flex flex-col gap-3 text-left">
          <label className="text-sm">
            <span className="text-steel text-xs">Project name</span>
            <input
              autoFocus
              className="mt-1 w-full border border-steel-border bg-panel px-3 py-2.5 text-sm text-ink outline-none focus:border-signal"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tower A — Substructure"
            />
          </label>
          <div className="flex gap-2 justify-center">
            <PrimaryButton type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create project'}
            </PrimaryButton>
            <GhostButton type="button" onClick={onCancel}>
              Cancel
            </GhostButton>
          </div>
        </form>
      )}
      <div className="mt-14 w-full max-w-md text-left bg-panel border border-steel-border px-5 py-[18px]">
        <h2 className="font-display text-sm font-semibold text-ink mb-3.5">Getting started</h2>
        <Tip n="01" title="Set up project defaults">
          Currency, concrete classes, and finishes standards.
        </Tip>
        <Tip n="02" title="Model your elements">
          Enter dimensions — the engine measures automatically.
        </Tip>
        <Tip n="03" title="Export a priced BOQ">
          Ready for tender the moment rates are attached.
        </Tip>
      </div>
    </div>
  )
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: DashboardProjectCard
  onOpen: () => void
  onDelete: () => void
}) {
  const ribbon = project.verified
    ? 'verified'
    : project.elementCount === 0
      ? 'no takeoff'
      : `${project.unpricedCount} unpriced`

  return (
    <div className="bg-panel border border-steel-border px-5 py-[18px] relative group hover:border-steel transition-colors">
      <button type="button" className="w-full text-left" onClick={onOpen}>
        <div className="flex justify-between items-start gap-3 mb-2.5">
          <div className="min-w-0">
            <h3 className="text-[14.5px] font-semibold text-ink mb-0.5 truncate">{project.name}</h3>
            <div className="text-xs text-steel truncate">
              {project.location || project.client || project.number || '—'}
            </div>
          </div>
          <VerifiedRibbon status={ribbon} />
        </div>
        <div className="flex gap-1.5 flex-wrap my-3">
          <span className="text-[11px] font-mono text-steel border border-steel-border px-2 py-0.5 rounded-sm">
            {project.floorCount} floor{project.floorCount === 1 ? '' : 's'}
          </span>
          <span className="text-[11px] font-mono text-steel border border-steel-border px-2 py-0.5 rounded-sm">
            {project.elementCount} element{project.elementCount === 1 ? '' : 's'}
          </span>
          <span className="text-[11px] font-mono text-steel border border-steel-border px-2 py-0.5 rounded-sm">
            {project.defaultGrade}
          </span>
        </div>
        <div className="flex justify-between items-center border-t border-steel-border pt-3 text-xs text-steel">
          <span>{relativeTime(project.updatedAt)}</span>
          <span className="font-mono text-[13px] text-chalk">
            {cardPrice(project.pricedTotal, project.currency)}
          </span>
        </div>
      </button>
      <button
        type="button"
        className="absolute top-2 right-2 text-[11px] text-steel opacity-0 group-hover:opacity-100 hover:text-[var(--danger)] px-1"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        title="Delete project"
      >
        ✕
      </button>
    </div>
  )
}
