/**
 * Floor level-type taxonomy + compatibility helpers.
 * Element allowedLevelTypes live on the element register (omit = all types).
 */

export const FLOOR_LEVEL_TYPES = [
  'Foundation',
  'Below-Grade',
  'Above-Grade',
  'Roof',
] as const

export type FloorLevelType = (typeof FLOOR_LEVEL_TYPES)[number]

export function isFloorLevelType(value: unknown): value is FloorLevelType {
  return (
    typeof value === 'string' &&
    (FLOOR_LEVEL_TYPES as readonly string[]).includes(value)
  )
}

/** Normalize a stored array: unique valid types, order follows FLOOR_LEVEL_TYPES. */
export function normalizeLevelTypes(raw: unknown): FloorLevelType[] {
  if (!Array.isArray(raw)) return []
  const set = new Set<FloorLevelType>()
  for (const item of raw) {
    if (isFloorLevelType(item)) set.add(item)
  }
  return FLOOR_LEVEL_TYPES.filter((t) => set.has(t))
}

/**
 * Client floor naming convention (sort prefix + abbreviations).
 * Used for light inference of levelTypes; Floors modal can still override.
 * Below-Grade / B1–B2 are not in this sheet — kept via separate basement rules.
 */
export const CLIENT_FLOOR_NAMING = [
  {
    sortPrefix: 'RF',
    levelName: 'Roof Level',
    abbreviations: ['RF', 'ROOF', 'TOS_RF'],
    levelTypes: ['Roof'] as const,
  },
  {
    sortPrefix: '06',
    levelName: 'Sixth Floor',
    abbreviations: ['06F', 'L06'],
    levelTypes: ['Above-Grade'] as const,
  },
  {
    sortPrefix: '05',
    levelName: 'Fifth Floor',
    abbreviations: ['05F', 'L05'],
    levelTypes: ['Above-Grade'] as const,
  },
  {
    sortPrefix: '04',
    levelName: 'Fourth Floor',
    abbreviations: ['04F', 'L04'],
    levelTypes: ['Above-Grade'] as const,
  },
  {
    sortPrefix: '03',
    levelName: 'Third Floor',
    abbreviations: ['03F', 'L03'],
    levelTypes: ['Above-Grade'] as const,
  },
  {
    sortPrefix: '02',
    levelName: 'Second Floor',
    abbreviations: ['2F', 'SF', 'L02', '02F'],
    levelTypes: ['Above-Grade'] as const,
  },
  {
    sortPrefix: '01',
    levelName: 'First Floor',
    abbreviations: ['1F', 'FF', 'L01', '01F'],
    levelTypes: ['Above-Grade'] as const,
  },
  {
    sortPrefix: '00',
    levelName: 'Ground Floor',
    abbreviations: ['GF', 'L00', 'FFL', '00', '00F'],
    levelTypes: ['Above-Grade'] as const,
  },
  {
    sortPrefix: 'FND',
    levelName: 'Foundation',
    abbreviations: ['FND', 'TOF', 'BOF', 'FDN'],
    levelTypes: ['Foundation'] as const,
  },
] as const

/** Suggested sortOrder: roof highest, foundation lowest (matches client sheet top→bottom). */
export function suggestedSortOrderForFloorId(floorId: string): number | null {
  const id = floorId.trim().toUpperCase()
  const idx = CLIENT_FLOOR_NAMING.findIndex(
    (row) =>
      row.sortPrefix === id ||
      row.abbreviations.some((a) => a === id || id.startsWith(`${a}_`) || id.startsWith(`${a}-`)),
  )
  if (idx < 0) return null
  // RF → high sort among typical stacks; we use negative-from-top so RF=8 … FND=0
  return CLIENT_FLOOR_NAMING.length - 1 - idx
}

/**
 * Light inference for legacy floors / new floors without explicit types.
 * Prefer client naming sheet; then basement hybrids; else Above-Grade.
 */
export function inferFloorLevelTypes(
  floorId: string,
  label = '',
): FloorLevelType[] {
  const id = floorId.trim().toUpperCase()
  const compact = id.replace(/[^A-Z0-9]/g, '')
  const text = `${floorId} ${label}`.toUpperCase()
  const hay = ` ${text.replace(/[^A-Z0-9]+/g, ' ')} `

  // --- Client sheet: Roof ---
  if (
    /\bROOF\b/.test(hay) ||
    /\bTOS_?RF\b/.test(hay) ||
    id === 'RF' ||
    compact === 'RF' ||
    compact === 'TOSRF' ||
    id.startsWith('RF_') ||
    id.startsWith('RF-') ||
    id.endsWith('_RF') ||
    id.endsWith('-RF')
  ) {
    return ['Roof']
  }

  // --- Client sheet: Foundation (FND / TOF / BOF; legacy FDN) ---
  if (
    /\bFOUNDATION\b/.test(hay) ||
    /\bFND\b/.test(hay) ||
    /\bTOF\b/.test(hay) ||
    /\bBOF\b/.test(hay) ||
    /\bFDN\b/.test(hay) ||
    id === 'FND' ||
    id === 'FDN' ||
    id === 'TOF' ||
    id === 'BOF' ||
    id.startsWith('FND') ||
    id.startsWith('FDN')
  ) {
    // Hybrid basement+foundation still wins over pure foundation when both present
    if (/\bBASEMENT\b/.test(hay) || /\bB2\b/.test(hay)) {
      return ['Foundation', 'Below-Grade']
    }
    return ['Foundation']
  }

  // B2 / basement+foundation hybrid (confirmed earlier; not on naming sheet)
  if (
    /\bB2\b/.test(hay) ||
    id === 'B2' ||
    id.startsWith('B2_') ||
    id.startsWith('B2-') ||
    (/\bFOUNDATION\b/.test(hay) && /\bBASEMENT\b/.test(hay))
  ) {
    return ['Foundation', 'Below-Grade']
  }

  // Below-grade / basement (not on naming sheet)
  if (
    /\bBASEMENT\b/.test(hay) ||
    /\bBELOW\s*GRADE\b/.test(hay) ||
    /^B\d/.test(id) ||
    id.startsWith('B1')
  ) {
    return ['Below-Grade']
  }

  // --- Client sheet: Ground + numbered floors → Above-Grade ---
  for (const row of CLIENT_FLOOR_NAMING) {
    if (row.levelTypes[0] !== 'Above-Grade') continue
    if (row.sortPrefix === id) return ['Above-Grade']
    for (const abbr of row.abbreviations) {
      if (
        id === abbr ||
        compact === abbr.replace(/[^A-Z0-9]/g, '') ||
        id.startsWith(`${abbr}_`) ||
        id.startsWith(`${abbr}-`) ||
        new RegExp(`\\b${abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(hay)
      ) {
        return ['Above-Grade']
      }
    }
  }

  // Patterns: L01–L99, 01F–99F, 00–06 as sort prefixes
  if (/^L0?\d{1,2}$/.test(id) || /^\d{1,2}F$/.test(id) || /^0[0-6]$/.test(id)) {
    return ['Above-Grade']
  }

  return ['Above-Grade']
}

/** Prefer stored types when non-empty; otherwise infer. */
export function resolveFloorLevelTypes(args: {
  floorId: string
  label?: string
  levelTypes?: unknown
}): FloorLevelType[] {
  const stored = normalizeLevelTypes(args.levelTypes)
  if (stored.length > 0) return stored
  return inferFloorLevelTypes(args.floorId, args.label ?? '')
}

/**
 * Unmapped / omitted allowedLevelTypes → all level types (no filter).
 * Empty array → nowhere (avoid accidental use).
 */
export function resolveAllowedLevelTypes(
  allowed: readonly FloorLevelType[] | null | undefined,
): FloorLevelType[] | 'all' {
  if (allowed == null) return 'all'
  const n = normalizeLevelTypes([...allowed])
  if (n.length === 0) return 'all'
  return n
}

/** Intersection: at least one shared type. */
export function isFloorCompatibleWithElement(
  floorLevelTypes: readonly FloorLevelType[],
  allowedLevelTypes: readonly FloorLevelType[] | null | undefined,
): boolean {
  const allowed = resolveAllowedLevelTypes(allowedLevelTypes)
  if (allowed === 'all') return true
  const floorSet = new Set(normalizeLevelTypes([...floorLevelTypes]))
  if (floorSet.size === 0) return false
  return allowed.some((t) => floorSet.has(t))
}

export type FloorOptionForElement = {
  floorId: string
  label: string
  levelTypes: FloorLevelType[]
  compatible: boolean
  /** Incompatible but kept visible because instances of this element exist. */
  exception: boolean
}

/**
 * Compatible floors + exception floors that already host this element.
 * Sort: compatible first (by incoming order), then exceptions.
 */
export function filterFloorsForElement<
  T extends { floorId: string; label: string; levelTypes?: unknown },
>(args: {
  floors: readonly T[]
  allowedLevelTypes: readonly FloorLevelType[] | null | undefined
  /** floorIds that already have ≥1 instance of the active element */
  floorIdsWithElementInstances: ReadonlySet<string>
}): Array<T & { compatible: boolean; exception: boolean; levelTypes: FloorLevelType[] }> {
  const out: Array<
    T & { compatible: boolean; exception: boolean; levelTypes: FloorLevelType[] }
  > = []
  for (const f of args.floors) {
    const levelTypes = resolveFloorLevelTypes({
      floorId: f.floorId,
      label: f.label,
      levelTypes: f.levelTypes,
    })
    const compatible = isFloorCompatibleWithElement(
      levelTypes,
      args.allowedLevelTypes,
    )
    const hasInstances = args.floorIdsWithElementInstances.has(f.floorId)
    const exception = !compatible && hasInstances
    if (compatible || exception) {
      out.push({ ...f, levelTypes, compatible, exception })
    }
  }
  return out.sort((a, b) => {
    if (a.compatible !== b.compatible) return a.compatible ? -1 : 1
    return 0
  })
}

export function formatLevelTypesLabel(types: readonly FloorLevelType[]): string {
  return types.join(', ')
}

export function emptyCompatibleFloorsMessage(args: {
  elementLabel: string
  allowedLevelTypes: readonly FloorLevelType[] | null | undefined
}): string {
  const allowed = resolveAllowedLevelTypes(args.allowedLevelTypes)
  const typeHint =
    allowed === 'all' ? 'compatible' : formatLevelTypesLabel(allowed)
  return `No compatible floors yet — add a ${typeHint} floor to place ${args.elementLabel}`
}
