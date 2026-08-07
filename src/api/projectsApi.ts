import { api } from '../lib/api'
import type {
  CalcResultRow,
  DashboardPayload,
  Floor,
  Instance,
  Project,
  ProjectSummary,
} from '../types/api'
import type { ProjectReports } from '../types/reports'

export function listProjects() {
  return api<{ projects: ProjectSummary[] }>('/api/projects')
}

export function getDashboard() {
  return api<DashboardPayload>('/api/projects/dashboard')
}

export function createProject(name: string) {
  return api<{ project: Project; floors: Floor[] }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function getProject(projectId: string) {
  return api<{ project: Project; floors: Floor[] }>(`/api/projects/${projectId}`)
}

export function updateProject(projectId: string, patch: Partial<Project>) {
  return api<{ project: Project }>(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export function deleteProject(projectId: string) {
  return api<{ ok: boolean }>(`/api/projects/${projectId}`, { method: 'DELETE' })
}

export function listFloors(projectId: string) {
  return api<{ floors: Floor[] }>(`/api/projects/${projectId}/floors`)
}

export function createFloor(
  projectId: string,
  body: { floorId: string; label: string; elevation?: number; height?: number },
) {
  return api<{ floor: Floor }>(`/api/projects/${projectId}/floors`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateFloor(projectId: string, floorDocId: string, patch: Partial<Floor>) {
  return api<{ floor: Floor }>(`/api/projects/${projectId}/floors/${floorDocId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export function deleteFloor(projectId: string, floorDocId: string) {
  return api<{ ok: boolean }>(`/api/projects/${projectId}/floors/${floorDocId}`, {
    method: 'DELETE',
  })
}

export function listInstances(
  projectId: string,
  params?: { floorId?: string; elementKey?: string },
) {
  const q = new URLSearchParams()
  if (params?.floorId) q.set('floorId', params.floorId)
  if (params?.elementKey) q.set('elementKey', params.elementKey)
  const qs = q.toString()
  return api<{ instances: Instance[] }>(
    `/api/projects/${projectId}/instances${qs ? `?${qs}` : ''}`,
  )
}

export function createInstance(projectId: string, body: Record<string, unknown>) {
  return api<{ instance: Instance }>(`/api/projects/${projectId}/instances`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateInstance(
  projectId: string,
  instanceId: string,
  patch: Record<string, unknown>,
) {
  return api<{ instance: Instance }>(
    `/api/projects/${projectId}/instances/${instanceId}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  )
}

export function deleteInstance(projectId: string, instanceId: string) {
  return api<{ ok: boolean }>(
    `/api/projects/${projectId}/instances/${instanceId}`,
    { method: 'DELETE' },
  )
}

export function calculate(projectId: string, elementKey: string, floorId: string) {
  return api<{
    projectId: string
    floorId: string
    elementKey: string
    count: number
    results: CalcResultRow[]
  }>(`/api/projects/${projectId}/calculate`, {
    method: 'POST',
    body: JSON.stringify({ elementKey, floorId }),
  })
}

export function getReports(
  projectId: string,
  params: { scope: 'floor' | 'project'; floorId?: string; elementKey?: string },
) {
  const q = new URLSearchParams()
  q.set('scope', params.scope)
  if (params.floorId) q.set('floorId', params.floorId)
  if (params.elementKey) q.set('elementKey', params.elementKey)
  return api<ProjectReports>(`/api/projects/${projectId}/reports?${q.toString()}`)
}
