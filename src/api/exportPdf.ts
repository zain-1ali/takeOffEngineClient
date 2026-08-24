import { API_BASE_URL, getAccessToken } from '../lib/api'

export interface MarkedPdfVisibility {
  /** Layer IDs currently visible in the UI. Omit to include all layers. */
  visibleLayerIds?: string[] | null
  uncategorizedVisible?: boolean
}

function buildVisibilityQuery(visibility?: MarkedPdfVisibility): string {
  const params = new URLSearchParams()
  if (visibility?.visibleLayerIds != null) {
    params.set('visibleLayerIds', visibility.visibleLayerIds.join(','))
  }
  if (visibility?.uncategorizedVisible === false) {
    params.set('uncategorizedVisible', 'false')
  } else if (visibility?.uncategorizedVisible === true) {
    params.set('uncategorizedVisible', 'true')
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

async function downloadAttachment(url: string, fallbackName: string): Promise<void> {
  const headers = new Headers()
  const token = getAccessToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    credentials: 'include',
    headers,
  })
  if (!response.ok) {
    let message = `Export failed (${response.status})`
    try {
      const data: unknown = await response.json()
      if (
        typeof data === 'object' &&
        data !== null &&
        'error' in data &&
        typeof (data as { error?: unknown }).error === 'string'
      ) {
        message = (data as { error: string }).error
      }
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message)
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = /filename="([^"]+)"/i.exec(disposition)
  const fileName = match?.[1] || fallbackName

  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

/** Download a single sheet's marked-up PDF. */
export async function downloadSheetMarkedPdf(
  sheetId: string,
  visibility?: MarkedPdfVisibility,
): Promise<void> {
  const query = buildVisibilityQuery(visibility)
  await downloadAttachment(
    `/api/sheets/${sheetId}/export/pdf${query}`,
    `sheet-${sheetId}-marked-up.pdf`,
  )
}

/** Download all project sheets as one combined marked-up PDF. */
export async function downloadProjectMarkedPdf(
  projectId: string,
  visibility?: MarkedPdfVisibility,
): Promise<void> {
  const query = buildVisibilityQuery(visibility)
  await downloadAttachment(
    `/api/projects/${projectId}/export/marked-pdf${query}`,
    `project-${projectId}-marked-up.pdf`,
  )
}

/** Download the Quantity Takeoff Table as CSV (Sheet Name, Type, Label, Value, Unit). */
export async function downloadProjectTakeoffCsv(projectId: string): Promise<void> {
  await downloadAttachment(
    `/api/projects/${projectId}/export/csv`,
    `takeoff_export.csv`,
  )
}

/** Download one sheet's Quantity Takeoff Table as CSV. */
export async function downloadSheetTakeoffCsv(sheetId: string): Promise<void> {
  await downloadAttachment(
    `/api/sheets/${sheetId}/export/csv`,
    `sheet-${sheetId}-takeoff.csv`,
  )
}
