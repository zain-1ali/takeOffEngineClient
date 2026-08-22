import type { IfcMappedInstanceData, IfcSuggestion } from '../../types/ifcImport'

export function defaultMappedElementKey(
  row: IfcSuggestion,
): IfcMappedInstanceData['elementKey'] {
  if (row.mappedInstanceData?.elementKey) return row.mappedInstanceData.elementKey
  if (row.entityType === 'IfcWall') return 'WALLS'
  if (row.entityType === 'IfcSlab') return 'SLABS'
  if (row.entityType === 'IfcColumn') return 'COLUMNS'
  if (row.entityType === 'IfcBeam') return 'BEAMS'
  return null
}

export function isFoundationRow(row: IfcSuggestion): boolean {
  const ek = row.mappedInstanceData?.elementKey
  return (
    row.entityType === 'IfcFooting' ||
    ek === 'PAD_FOOTING' ||
    ek === 'STRIP_FOOTING' ||
    ek === 'PILE_CAP'
  )
}

export function isColumnRow(row: IfcSuggestion): boolean {
  return (
    row.entityType === 'IfcColumn' ||
    row.mappedInstanceData?.elementKey === 'COLUMNS'
  )
}

export function isBeamRow(row: IfcSuggestion): boolean {
  return (
    row.entityType === 'IfcBeam' ||
    row.mappedInstanceData?.elementKey === 'BEAMS'
  )
}

const COLUMN_SHAPES = new Set([
  'RECTANGULAR',
  'CIRCULAR',
  'L_SHAPED',
  'T_SHAPED',
  'CRUCIFORM',
])

const BEAM_SHAPES = new Set([
  'RECTANGULAR',
  'T_SECTION',
  'L_SECTION',
  'CANTILEVER_TAPERED',
  'GROUND_TIE',
])

export function impliedShape(row: IfcSuggestion): string | null {
  const ek =
    row.mappedInstanceData?.elementKey ?? defaultMappedElementKey(row)
  if (ek === 'PAD_FOOTING' || ek === 'PILE_CAP') return 'RECTANGULAR'
  if (ek === 'STRIP_FOOTING' || ek === 'SLABS') return 'FLAT'
  if (ek === 'WALLS' || row.entityType === 'IfcWall') return 'LINEAR'
  // Columns / Beams: never guess a section variant from a typed number.
  return null
}

export function geoUiKey(row: IfcSuggestion, uiKey: string): string {
  if (
    uiKey === 'thickness' &&
    row.mappedInstanceData?.elementKey === 'PAD_FOOTING'
  ) {
    return 'baseThickness'
  }
  if (isColumnRow(row)) {
    const shape = row.mappedInstanceData?.shape
    if (uiKey === 'height') return 'clearHeight'
    if (uiKey === 'width') {
      return shape === 'T_SHAPED' ? 'flangeWidth' : 'width'
    }
    if (uiKey === 'depth') {
      return shape === 'T_SHAPED' ? 'overallDepth' : 'depth'
    }
    if (uiKey === 'thickness') {
      if (shape === 'L_SHAPED') return 'legThickness'
      if (shape === 'CRUCIFORM') return 'armThickness'
      if (shape === 'T_SHAPED') return 'flangeThickness'
      return 'legThickness'
    }
  }
  if (isBeamRow(row)) {
    const shape = row.mappedInstanceData?.shape
    if (uiKey === 'length') return 'spanLength'
    if (uiKey === 'width') {
      return shape === 'T_SECTION' || shape === 'L_SECTION'
        ? 'flangeWidth'
        : 'width'
    }
    if (uiKey === 'depth') {
      if (shape === 'T_SECTION' || shape === 'L_SECTION') return 'overallDepth'
      if (shape === 'CANTILEVER_TAPERED') return 'supportDepth'
      return 'depth'
    }
    if (uiKey === 'thickness') {
      if (shape === 'T_SECTION' || shape === 'L_SECTION') return 'flangeThickness'
      return uiKey
    }
  }
  return uiKey
}

export function missingFields(row: IfcSuggestion): string[] {
  const data = row.mappedInstanceData
  const missing: string[] = []
  const shape = data?.shape
  const g = data?.geometry
  const ek = data?.elementKey
  if (isBeamRow(row) || ek === 'BEAMS') {
    if (!shape || !BEAM_SHAPES.has(shape)) missing.push('Shape')
    if (shape === 'T_SECTION' || shape === 'L_SECTION') {
      if (!(Number(g?.spanLength) > 0)) missing.push('Span (m)')
      if (!(Number(g?.flangeWidth) > 0)) missing.push('Flange W (m)')
      if (!(Number(g?.flangeThickness) > 0)) missing.push('Flange T (m)')
      if (!(Number(g?.webWidth) > 0)) missing.push('Web W (m)')
      if (!(Number(g?.overallDepth) > 0)) missing.push('Overall D (m)')
    } else if (shape === 'CANTILEVER_TAPERED') {
      if (!(Number(g?.spanLength) > 0)) missing.push('Span (m)')
      if (!(Number(g?.width) > 0)) missing.push('W (m)')
      if (!(Number(g?.supportDepth) > 0)) missing.push('Support D (m)')
      if (!(Number(g?.tipDepth) > 0)) missing.push('Tip D (m)')
    } else if (shape === 'RECTANGULAR' || shape === 'GROUND_TIE') {
      if (!(Number(g?.spanLength) > 0)) missing.push('Span (m)')
      if (!(Number(g?.width) > 0)) missing.push('W (m)')
      if (!(Number(g?.depth) > 0)) missing.push('D (m)')
    }
    return missing
  }
  if (isColumnRow(row) || ek === 'COLUMNS') {
    if (!shape || !COLUMN_SHAPES.has(shape)) missing.push('Shape')
    if (shape === 'CIRCULAR') {
      if (!(Number(g?.diameter) > 0)) missing.push('Dia. (m)')
    } else if (shape === 'L_SHAPED') {
      if (!(Number(g?.width) > 0)) missing.push('Overall W (m)')
      if (!(Number(g?.depth) > 0)) missing.push('Overall D (m)')
      if (!(Number(g?.legThickness) > 0)) missing.push('Leg T (m)')
    } else if (shape === 'T_SHAPED') {
      if (!(Number(g?.flangeWidth) > 0)) missing.push('Flange W (m)')
      if (!(Number(g?.overallDepth) > 0)) missing.push('Overall D (m)')
      if (!(Number(g?.flangeThickness) > 0)) missing.push('Flange T (m)')
      if (!(Number(g?.webThickness) > 0)) missing.push('Web T (m)')
    } else if (shape === 'CRUCIFORM') {
      if (!(Number(g?.width) > 0)) missing.push('Overall W (m)')
      if (!(Number(g?.depth) > 0)) missing.push('Overall D (m)')
      if (!(Number(g?.armThickness) > 0)) missing.push('Arm T (m)')
    } else if (shape === 'RECTANGULAR') {
      if (!(Number(g?.width) > 0)) missing.push('W (m)')
      if (!(Number(g?.depth) > 0)) missing.push('D (m)')
    }
    if (shape && COLUMN_SHAPES.has(shape) && !(Number(g?.clearHeight) > 0)) {
      missing.push('H (m)')
    }
    return missing
  }
  if (row.entityType === 'IfcSlab' || ek === 'SLABS') {
    if (shape !== 'FLAT') missing.push('Shape')
    if (!(Number(g?.length) > 0)) missing.push('Length (L)')
    if (!(Number(g?.width) > 0)) missing.push('Width (W)')
    if (!(Number(g?.thickness) > 0)) missing.push('Thickness (T)')
    return missing
  }
  if (ek === 'PAD_FOOTING') {
    if (shape !== 'RECTANGULAR') missing.push('Shape')
    if (!(Number(g?.length) > 0)) missing.push('Length (L)')
    if (!(Number(g?.width) > 0)) missing.push('Width (W)')
    if (!(Number(g?.baseThickness) > 0)) missing.push('Thickness (Z1)')
    return missing
  }
  if (ek === 'STRIP_FOOTING') {
    if (shape !== 'FLAT') missing.push('Shape')
    if (!(Number(g?.length) > 0)) missing.push('Length (L)')
    if (!(Number(g?.width) > 0)) missing.push('Width (W)')
    if (!(Number(g?.height) > 0)) missing.push('Height (H)')
    return missing
  }
  if (ek === 'PILE_CAP') {
    if (shape !== 'RECTANGULAR') missing.push('Shape')
    if (!(Number(g?.length) > 0)) missing.push('Length (L)')
    if (!(Number(g?.width) > 0)) missing.push('Width (W)')
    if (!(Number(g?.thickness) > 0)) missing.push('Thickness (T)')
    if (!(Number(g?.pileCount) >= 1)) missing.push('Piles')
    return missing
  }
  if (isFoundationRow(row)) {
    missing.push('Shape')
    return missing
  }
  if (shape !== 'LINEAR' && shape !== 'CURVED') missing.push('Shape')
  if (!(Number(g?.thickness) > 0)) missing.push('Thickness (T)')
  if (!(Number(g?.height) > 0)) missing.push('Height (H)')
  if (shape === 'LINEAR' && !(Number(g?.length) > 0)) missing.push('Length (L)')
  if (shape === 'CURVED') {
    if (!(Number(g?.radius) > 0)) missing.push('Radius')
    if (!(Number(g?.arcAngleDeg) > 0)) missing.push('Arc angle')
  }
  return missing
}

const GEO_MISSING_LABELS: Record<string, string[]> = {
  length: ['Length (L)'],
  spanLength: ['Span (m)'],
  width: ['Width (W)', 'W (m)', 'Overall W (m)', 'Flange W (m)'],
  depth: ['D (m)', 'Overall D (m)'],
  diameter: ['Dia. (m)'],
  thickness: ['Thickness (T)', 'Thickness (Z1)'],
  baseThickness: ['Thickness (Z1)', 'Thickness (T)'],
  height: ['Height (H)'],
  clearHeight: ['H (m)'],
  legThickness: ['Leg T (m)'],
  armThickness: ['Arm T (m)'],
  flangeWidth: ['Flange W (m)'],
  overallDepth: ['Overall D (m)'],
  flangeThickness: ['Flange T (m)'],
  webThickness: ['Web T (m)'],
  webWidth: ['Web W (m)'],
  supportDepth: ['Support D (m)'],
  tipDepth: ['Tip D (m)'],
  pileCount: ['Piles'],
}

function geoFieldNeeded(key: string, missing: string[]): boolean {
  const labels = GEO_MISSING_LABELS[key]
  if (!labels) return false
  return labels.some((label) => missing.includes(label))
}

function geoEnabled(row: IfcSuggestion, key: string): boolean {
  const shape = row.mappedInstanceData?.shape
  const ek = row.mappedInstanceData?.elementKey
  if (row.entityType === 'IfcSlab' || ek === 'SLABS') {
    return key === 'length' || key === 'width' || key === 'thickness'
  }
  if (ek === 'PAD_FOOTING') {
    return key === 'length' || key === 'width' || key === 'thickness'
  }
  if (ek === 'STRIP_FOOTING') {
    return key === 'length' || key === 'width' || key === 'height'
  }
  if (ek === 'PILE_CAP') {
    return (
      key === 'length' ||
      key === 'width' ||
      key === 'thickness' ||
      key === 'pileCount'
    )
  }
  if (isColumnRow(row) || ek === 'COLUMNS') {
    const shape = row.mappedInstanceData?.shape
    if (shape === 'CIRCULAR') {
      return key === 'diameter' || key === 'clearHeight'
    }
    if (shape === 'L_SHAPED') {
      return (
        key === 'width' ||
        key === 'depth' ||
        key === 'legThickness' ||
        key === 'clearHeight'
      )
    }
    if (shape === 'T_SHAPED') {
      return (
        key === 'flangeWidth' ||
        key === 'overallDepth' ||
        key === 'flangeThickness' ||
        key === 'webThickness' ||
        key === 'clearHeight'
      )
    }
    if (shape === 'CRUCIFORM') {
      return (
        key === 'width' ||
        key === 'depth' ||
        key === 'armThickness' ||
        key === 'clearHeight'
      )
    }
    if (shape === 'RECTANGULAR') {
      return key === 'width' || key === 'depth' || key === 'clearHeight'
    }
    return false
  }
  if (isBeamRow(row) || ek === 'BEAMS') {
    const shape = row.mappedInstanceData?.shape
    if (shape === 'T_SECTION' || shape === 'L_SECTION') {
      return (
        key === 'spanLength' ||
        key === 'flangeWidth' ||
        key === 'flangeThickness' ||
        key === 'webWidth' ||
        key === 'overallDepth'
      )
    }
    if (shape === 'CANTILEVER_TAPERED') {
      return (
        key === 'spanLength' ||
        key === 'width' ||
        key === 'supportDepth' ||
        key === 'tipDepth'
      )
    }
    if (shape === 'RECTANGULAR' || shape === 'GROUND_TIE') {
      return key === 'spanLength' || key === 'width' || key === 'depth'
    }
    return false
  }
  if (key === 'thickness' || key === 'height') {
    return shape === 'LINEAR' || shape === 'CURVED'
  }
  if (key === 'length') return shape === 'LINEAR'
  return false
}

export function geoInputDisabled(
  row: IfcSuggestion,
  key: string,
  missing: string[] = missingFields(row),
): boolean {
  if (row.status !== 'PENDING') return true
  if (geoFieldNeeded(key, missing)) return false
  return !geoEnabled(row, key)
}

export type GeoPatchResult = {
  row: IfcSuggestion
  /** Set when this edit first fills a previously empty shape. */
  seededShape: string | null
}

/**
 * Apply a geometry input. If the row had no shape, a typed number seeds the
 * implied shape (FLAT / RECTANGULAR / LINEAR) so the Shape column can show it.
 */
export function applySuggestionGeoPatch(
  row: IfcSuggestion,
  key: string,
  raw: string,
): GeoPatchResult {
  const base = row.mappedInstanceData || {
    elementKey: defaultMappedElementKey(row),
    shape: null,
    mark: null,
    geometry: {} as Record<string, number>,
  }
  const g = { ...(base.geometry || {}) }
  const n = parseFloat(raw)
  if (Number.isFinite(n)) g[key] = n
  else delete g[key]

  let shape = base.shape
  let seededShape: string | null = null
  if (!shape && Number.isFinite(n)) {
    const implied = impliedShape({
      ...row,
      mappedInstanceData: { ...base, geometry: g },
    })
    if (implied) {
      shape = implied
      seededShape = implied
    }
  }

  return {
    seededShape,
    row: {
      ...row,
      mappedInstanceData: {
        ...base,
        shape,
        geometry: g,
      },
    },
  }
}

export function acceptReady(row: IfcSuggestion): boolean {
  return Boolean(row.floorId) && missingFields(row).length === 0
}

const PREVIEW_ELEMENT_KEYS = new Set([
  'WALLS',
  'SLABS',
  'PAD_FOOTING',
  'STRIP_FOOTING',
  'PILE_CAP',
  'COLUMNS',
  'BEAMS',
])

/** Same dim completeness as Accept (not floor). Used to enable the Preview button. */
export function canPreviewIfcSuggestion(row: IfcSuggestion): boolean {
  const ek = row.mappedInstanceData?.elementKey
  if (!ek || !PREVIEW_ELEMENT_KEYS.has(ek)) return false
  return missingFields(row).length === 0
}

export function previewDimCaption(data: IfcMappedInstanceData): string {
  const g = data.geometry || {}
  const v = (key: string) => (g[key] != null ? String(g[key]) : '—')
  const ek = data.elementKey
  if (ek === 'SLABS') {
    return `L ${v('length')} · W ${v('width')} · T ${v('thickness')}`
  }
  if (ek === 'PAD_FOOTING') {
    return `L ${v('length')} · W ${v('width')} · Z1 ${v('baseThickness')}`
  }
  if (ek === 'STRIP_FOOTING') {
    return `L ${v('length')} · W ${v('width')} · H ${v('height')}`
  }
  if (ek === 'PILE_CAP') {
    return `L ${v('length')} · W ${v('width')} · T ${v('thickness')} · Piles ${v('pileCount')}`
  }
  if (ek === 'COLUMNS') {
    if (data.shape === 'CIRCULAR') {
      return `Dia ${v('diameter')} · H ${v('clearHeight')}`
    }
    if (data.shape === 'T_SHAPED') {
      return `Flange ${v('flangeWidth')} · D ${v('overallDepth')} · tf ${v('flangeThickness')} · tw ${v('webThickness')} · H ${v('clearHeight')}`
    }
    if (data.shape === 'L_SHAPED') {
      return `W ${v('width')} · D ${v('depth')} · t ${v('legThickness')} · H ${v('clearHeight')}`
    }
    if (data.shape === 'CRUCIFORM') {
      return `W ${v('width')} · D ${v('depth')} · t ${v('armThickness')} · H ${v('clearHeight')}`
    }
    return `W ${v('width')} · D ${v('depth')} · H ${v('clearHeight')}`
  }
  if (ek === 'BEAMS') {
    if (data.shape === 'T_SECTION' || data.shape === 'L_SECTION') {
      return `Span ${v('spanLength')} · Flange ${v('flangeWidth')} · D ${v('overallDepth')} · tf ${v('flangeThickness')} · tw ${v('webWidth')}`
    }
    if (data.shape === 'CANTILEVER_TAPERED') {
      return `Span ${v('spanLength')} · W ${v('width')} · Ds ${v('supportDepth')} · Dt ${v('tipDepth')}`
    }
    return `Span ${v('spanLength')} · W ${v('width')} · D ${v('depth')}`
  }
  if (data.shape === 'CURVED') {
    return `R ${v('radius')} · ∠ ${v('arcAngleDeg')}° · T ${v('thickness')} · H ${v('height')}`
  }
  return `L ${v('length')} · T ${v('thickness')} · H ${v('height')}`
}
