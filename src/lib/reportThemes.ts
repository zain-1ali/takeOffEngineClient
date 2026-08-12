/**
 * Cost Plan / bill report color themes (original palettes).
 * Each theme: primary header, secondary dark accent, tertiary accent,
 * light tint, near-white paper.
 */

export type ReportThemeId =
  | 'zero-qs'
  | 'classic-slate'
  | 'forest'
  | 'charcoal'
  | 'terracotta'

export type ReportThemePalette = {
  /** Primary header color (table header bar). */
  primary: string
  /** Secondary / dark accent (section dividers, strong totals). */
  secondary: string
  /** Tertiary accent (selected border, highlights). */
  tertiary: string
  /** Light background tint (alternating / group rows). */
  tint: string
  /** Near-white page / paper background. */
  paper: string
}

export type ReportTheme = {
  id: ReportThemeId
  name: string
  colors: ReportThemePalette
}

export const DEFAULT_REPORT_THEME: ReportThemeId = 'zero-qs'

export const REPORT_THEMES: ReportTheme[] = [
  {
    id: 'zero-qs',
    name: 'Zero QS',
    colors: {
      primary: '#1B4F72',
      secondary: '#0E2A3D',
      tertiary: '#2E86AB',
      tint: '#E8F1F5',
      paper: '#FAFCFD',
    },
  },
  {
    id: 'classic-slate',
    name: 'Classic Slate',
    colors: {
      primary: '#475569',
      secondary: '#1E293B',
      tertiary: '#64748B',
      tint: '#F1F5F9',
      paper: '#F8FAFC',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: {
      primary: '#2D6A4F',
      secondary: '#1B4332',
      tertiary: '#40916C',
      tint: '#D8F3DC',
      paper: '#F7FBF8',
    },
  },
  {
    id: 'charcoal',
    name: 'Charcoal',
    colors: {
      primary: '#374151',
      secondary: '#111827',
      tertiary: '#6B7280',
      tint: '#E5E7EB',
      paper: '#F9FAFB',
    },
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    colors: {
      primary: '#C45C26',
      secondary: '#7C2D12',
      tertiary: '#2B6CB0',
      tint: '#FDE8D8',
      paper: '#FFFBF7',
    },
  },
]

const THEME_IDS = new Set(REPORT_THEMES.map((t) => t.id))

export function isReportThemeId(raw: unknown): raw is ReportThemeId {
  return typeof raw === 'string' && THEME_IDS.has(raw as ReportThemeId)
}

export function resolveReportTheme(
  id: string | null | undefined,
): ReportTheme {
  const found = REPORT_THEMES.find((t) => t.id === id)
  return found || REPORT_THEMES.find((t) => t.id === DEFAULT_REPORT_THEME)!
}

/** Contrast text for header bars (always light on our primaries). */
export const THEME_HEADER_TEXT = '#FFFFFF'
