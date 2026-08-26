import { api, ApiError, getAccessToken } from '../lib/api'
import type { CalibrationUnitLabel, Sheet } from '../types/models'

export interface UploadSheetsResponse {
  projectId: string
  floorId?: string
  pageCount?: number
  fileCount?: number
  sheets?: Sheet[]
  status?: 'processing' | string
  message?: string
}

export interface UpdateSheetInput {
  name?: string
  discipline?: string
  sortOrder?: number
}

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''
}

async function credentialedFetch(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getAccessToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return fetch(`${apiBase()}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  })
}

export async function fetchSheets(
  projectId: string,
  floorId?: string,
): Promise<Sheet[]> {
  const q = floorId ? `?floorId=${encodeURIComponent(floorId)}` : ''
  const data = await api<{ sheets: Sheet[] }>(
    `/api/projects/${projectId}/sheets${q}`,
  )
  return data.sheets
}

/** Upload one PDF for a floor (replaces prior sheets on that floor). */
export async function uploadFloorPdf(
  projectId: string,
  floorId: string,
  file: File,
): Promise<UploadSheetsResponse> {
  const formData = new FormData()
  formData.append('files', file)
  formData.append('floorId', floorId)
  formData.append('discipline', 'Structural')

  const response = await credentialedFetch(
    `/api/projects/${projectId}/sheets/upload`,
    { method: 'POST', body: formData },
  )
  const text = await response.text()
  const data = (
    text ? JSON.parse(text) : { projectId, floorId }
  ) as UploadSheetsResponse & { error?: string }
  if (!response.ok) {
    throw new ApiError(response.status, data.error || `Request failed (${response.status})`)
  }
  return data
}

export async function updateSheet(
  sheetId: string,
  input: UpdateSheetInput,
): Promise<Sheet> {
  const data = await api<{ sheet: Sheet }>(`/api/sheets/${sheetId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return data.sheet
}

export async function reorderSheets(
  projectId: string,
  orderedIds: string[],
): Promise<Sheet[]> {
  const data = await api<{ sheets: Sheet[] }>('/api/sheets/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ projectId, orderedIds }),
  })
  return data.sheets
}

export async function saveSheetCalibration(
  sheetId: string,
  calibrationScale: number,
  calibrationUnit: CalibrationUnitLabel,
): Promise<Sheet> {
  const data = await api<{ sheet: Sheet }>(`/api/sheets/${sheetId}/calibration`, {
    method: 'PATCH',
    body: JSON.stringify({ calibrationScale, calibrationUnit }),
  })
  return data.sheet
}
