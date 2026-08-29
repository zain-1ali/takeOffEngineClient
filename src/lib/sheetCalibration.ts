import type { Sheet } from '../types/models'

/** True when the sheet has a usable real-world scale. */
export function sheetIsCalibrated(s: Sheet): boolean {
  return (
    s.calibrationScale != null &&
    s.calibrationScale > 0 &&
    Boolean(s.calibrationUnit)
  )
}

/** Prefer `title`, else strip " - Page N" from converted sheet names. */
export function drawingDisplayName(sheet: Sheet | undefined): string {
  if (!sheet) return '—'
  const titled = sheet.title?.trim()
  if (titled) return titled
  const raw = sheet.name?.trim() || ''
  const withoutPage = raw.replace(/\s*-\s*Page\s+\d+\s*$/i, '').trim()
  if (withoutPage) return withoutPage
  if (sheet.sourcePdfUrl) {
    const part = sheet.sourcePdfUrl.split('/').pop() || ''
    return decodeURIComponent(part.replace(/\.pdf$/i, '')) || 'Drawing'
  }
  return 'Drawing'
}
