import { api, ApiError, getAccessToken } from '../lib/api'
import type {
  CalcResultRow,
  DashboardPayload,
  Floor,
  Instance,
  Project,
  ProjectSummary,
} from '../types/api'
import type { ManualBoqInput, ManualBoqItem } from '../types/manualBoq'
import type { CostPlanPayload } from '../types/costPlan'
import type { IfcImportJob, IfcWallSuggestion } from '../types/ifcImport'
import type { RatePdfImportJob, RatePdfSuggestion } from '../types/ratePdfImport'
import type { ProjectReports } from '../types/reports'
import type { RateLib } from '../types/rateLib'
import type {
  BoqCatalogueListItem,
  SelectedBoqItem,
} from '../types/selectedBoq'

export function listProjects() {
  return api<{ projects: ProjectSummary[] }>('/api/projects')
}

export function getDashboard() {
  return api<DashboardPayload>('/api/projects/dashboard')
}

export type CreateProjectInput = {
  name: string
  client?: string
  contractor?: string
  consultant?: string
}

export function createProject(input: CreateProjectInput | string) {
  const body =
    typeof input === 'string'
      ? { name: input }
      : {
          name: input.name,
          client: input.client ?? '',
          contractor: input.contractor ?? '',
          consultant: input.consultant ?? '',
        }
  return api<{ project: Project; floors: Floor[] }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(body),
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
  body: {
    floorId: string
    label: string
    elevation?: number
    height?: number
    levelTypes?: string[]
    sortOrder?: number
  },
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

export type DuplicateFloorBody = {
  sourceFloorId?: string
  instanceIds?: string[]
  targetFloorId?: string
  newFloor?: {
    floorId: string
    label: string
    elevation?: number
    height?: number
    levelTypes?: string[]
  }
}

export type DuplicateFloorResult = {
  floor: Floor
  targetFloorId: string
  copiedCount: number
  sourceCount: number
  instances: Instance[]
  calculated: { elementKey: string; results: CalcResultRow[] }[]
}

/** Full-floor or selected-instance copy. Target quantities recalculated server-side. */
export function duplicateFloor(projectId: string, body: DuplicateFloorBody) {
  return api<DuplicateFloorResult>(`/api/projects/${projectId}/floors/duplicate`, {
    method: 'POST',
    body: JSON.stringify(body),
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

export function getCostPlan(
  projectId: string,
  params?: { scope?: 'floor' | 'project'; floorId?: string },
) {
  const q = new URLSearchParams()
  q.set('scope', params?.scope || 'project')
  if (params?.floorId) q.set('floorId', params.floorId)
  return api<CostPlanPayload>(
    `/api/projects/${projectId}/cost-plan?${q.toString()}`,
  )
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''

export async function startRatePdfImport(projectId: string, file: File) {
  const body = new FormData()
  body.append('file', file)
  const headers = new Headers()
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(
    `${API_BASE_URL}/api/projects/${projectId}/rate-lib/import-pdf`,
    { method: 'POST', body, credentials: 'include', headers },
  )
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `Upload failed (${res.status})`)
  }
  return data as { jobId: string; job: RatePdfImportJob }
}

export function getRatePdfImportJob(projectId: string, jobId: string) {
  return api<{ job: RatePdfImportJob }>(
    `/api/projects/${projectId}/rate-lib/import-pdf/${jobId}`,
  )
}

export function patchRatePdfSuggestions(
  projectId: string,
  jobId: string,
  suggestions: Array<Partial<RatePdfSuggestion> & { id: string }>,
) {
  return api<{ job: RatePdfImportJob }>(
    `/api/projects/${projectId}/rate-lib/import-pdf/${jobId}/suggestions`,
    {
      method: 'PATCH',
      body: JSON.stringify({ suggestions }),
    },
  )
}

export function commitRatePdfImport(
  projectId: string,
  jobId: string,
  suggestions: Array<Partial<RatePdfSuggestion> & { id: string }>,
) {
  return api<{
    added: number
    job: RatePdfImportJob
    project: { id: string; rateLib: RateLib }
  }>(`/api/projects/${projectId}/rate-lib/import-pdf/${jobId}/commit`, {
    method: 'POST',
    body: JSON.stringify({ suggestions }),
  })
}

export type CurrencyQuote = {
  quoteId: string
  fromCurrency: string
  toCurrency: string
  rate: number
  rateDate: string
  fetchedAt: string
}

export function quoteCurrencyConversion(projectId: string, toCurrency: string) {
  return api<{ quote: CurrencyQuote; message: string }>(
    `/api/projects/${projectId}/convert-currency/quote`,
    {
      method: 'POST',
      body: JSON.stringify({ toCurrency }),
    },
  )
}

export function confirmCurrencyConversion(projectId: string, quoteId: string) {
  return api<{
    project: Project
    conversion: {
      id: string
      fromCurrency: string
      toCurrency: string
      rateUsed: number
      rateDate: string
      timestamp: string
      triggeredBy: string
    }
  }>(`/api/projects/${projectId}/convert-currency`, {
    method: 'POST',
    body: JSON.stringify({ quoteId }),
  })
}

export function listManualBoqItems(projectId: string, floorId?: string) {
  const q = floorId ? `?floorId=${encodeURIComponent(floorId)}` : ''
  return api<{ items: ManualBoqItem[] }>(
    `/api/projects/${projectId}/manual-boq${q}`,
  )
}

export function createManualBoqItem(projectId: string, body: ManualBoqInput) {
  return api<{ item: ManualBoqItem }>(`/api/projects/${projectId}/manual-boq`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function deleteManualBoqItem(projectId: string, itemId: string) {
  return api<{ ok: boolean }>(
    `/api/projects/${projectId}/manual-boq/${itemId}`,
    { method: 'DELETE' },
  )
}

export function listBoqCatalogue(
  projectId: string,
  params: { elementKey: string; floorId?: string },
) {
  const q = new URLSearchParams()
  q.set('elementKey', params.elementKey)
  if (params.floorId) q.set('floorId', params.floorId)
  return api<{ elementKey: string; items: BoqCatalogueListItem[] }>(
    `/api/projects/${projectId}/selected-boq/catalogue?${q.toString()}`,
  )
}

export function listSelectedBoqItems(
  projectId: string,
  params: { floorId: string; elementKey?: string },
) {
  const q = new URLSearchParams()
  q.set('floorId', params.floorId)
  if (params.elementKey) q.set('elementKey', params.elementKey)
  return api<{ items: SelectedBoqItem[] }>(
    `/api/projects/${projectId}/selected-boq?${q.toString()}`,
  )
}

export function addSelectedBoqItems(
  projectId: string,
  body: { floorId: string; elementKey: string; catalogueRefs: string[] },
) {
  return api<{ items: SelectedBoqItem[]; skipped: string[] }>(
    `/api/projects/${projectId}/selected-boq`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
}

export function deleteSelectedBoqItem(projectId: string, itemId: string) {
  return api<{ ok: boolean }>(
    `/api/projects/${projectId}/selected-boq/${itemId}`,
    { method: 'DELETE' },
  )
}

export type UploadProgress = {
  loaded: number
  total: number
  /** 0–100 integer */
  percent: number
}

export async function startIfcImport(
  projectId: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void,
) {
  const body = new FormData()
  body.append('file', file)

  return new Promise<{ jobId: string; job: IfcImportJob }>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(
      'POST',
      `${API_BASE_URL}/api/projects/${projectId}/ifc-import`,
    )
    xhr.withCredentials = true

    const token = getAccessToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (event) => {
      if (!onProgress) return
      const total = event.lengthComputable && event.total > 0 ? event.total : file.size
      const loaded = event.loaded
      const percent =
        total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
      onProgress({ loaded, total, percent })
    }

    xhr.upload.onload = () => {
      onProgress?.({ loaded: file.size, total: file.size, percent: 100 })
    }

    xhr.onerror = () => {
      reject(new ApiError(0, 'Network error while uploading IFC file'))
    }

    xhr.onload = () => {
      let data: { error?: string; jobId?: string; job?: IfcImportJob } | null =
        null
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null
      } catch {
        data = null
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new ApiError(
            xhr.status,
            data?.error || `Upload failed (${xhr.status})`,
          ),
        )
        return
      }
      if (!data?.job) {
        reject(new ApiError(xhr.status, 'Upload succeeded but job was missing'))
        return
      }
      resolve(data as { jobId: string; job: IfcImportJob })
    }

    xhr.send(body)
  })
}

export function getIfcImportJob(projectId: string, jobId: string) {
  return api<{ job: IfcImportJob }>(
    `/api/projects/${projectId}/ifc-import/${jobId}`,
  )
}

export function listIfcSuggestions(projectId: string, jobId: string) {
  return api<{ suggestions: import('../types/ifcImport').IfcSuggestion[] }>(
    `/api/projects/${projectId}/ifc-import/${jobId}/suggestions`,
  )
}

export function patchIfcSuggestion(
  projectId: string,
  jobId: string,
  suggestionId: string,
  patch: {
    floorId?: string
    mappedInstanceData?: import('../types/ifcImport').IfcMappedInstanceData
  },
) {
  return api<{ suggestion: import('../types/ifcImport').IfcSuggestion }>(
    `/api/projects/${projectId}/ifc-import/${jobId}/suggestions/${suggestionId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  )
}

export function acceptIfcSuggestion(
  projectId: string,
  jobId: string,
  suggestionId: string,
  mappedInstanceData?: import('../types/ifcImport').IfcMappedInstanceData | null,
) {
  return api<{
    suggestion: import('../types/ifcImport').IfcSuggestion
    skippedDuplicate: boolean
    instance: {
      id: string
      mark: string
      shape: string
      floorId: string
      elementKey: string
      source: string | null
      sourceGlobalId: string | null
    } | null
  }>(
    `/api/projects/${projectId}/ifc-import/${jobId}/suggestions/${suggestionId}/accept`,
    {
      method: 'POST',
      body: JSON.stringify({ mappedInstanceData }),
    },
  )
}

export function rejectIfcSuggestion(
  projectId: string,
  jobId: string,
  suggestionId: string,
) {
  return api<{ suggestion: import('../types/ifcImport').IfcSuggestion }>(
    `/api/projects/${projectId}/ifc-import/${jobId}/suggestions/${suggestionId}/reject`,
    { method: 'POST', body: JSON.stringify({}) },
  )
}

export function commitIfcImport(
  projectId: string,
  jobId: string,
  suggestions: Array<Partial<IfcWallSuggestion> & { id: string }>,
) {
  return api<{
    added: number
    skipped: string[]
    instances: Array<{
      id: string
      mark: string
      shape: string
      floorId: string
      elementKey: string
    }>
    job: IfcImportJob
  }>(`/api/projects/${projectId}/ifc-import/${jobId}/commit`, {
    method: 'POST',
    body: JSON.stringify({ suggestions }),
  })
}
