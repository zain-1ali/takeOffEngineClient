import type { IfcImportJob, IfcSuggestion } from '../../types/ifcImport'

export const IFC_IMPORT_SCOPE_KEYS = [
  'WALLS',
  'SLABS',
  'PAD_FOOTING',
  'STRIP_FOOTING',
  'PILE_CAP',
  'RAFT',
  'COLUMNS',
  'BEAMS',
] as const

export type IfcImportScopeKey = (typeof IFC_IMPORT_SCOPE_KEYS)[number]

const SCOPE_LABEL: Record<IfcImportScopeKey, string> = {
  WALLS: 'RC Walls',
  SLABS: 'Slabs',
  PAD_FOOTING: 'Pad Foundation',
  STRIP_FOOTING: 'Strip Foundation',
  PILE_CAP: 'Pile Cap',
  RAFT: 'Raft Foundation',
  COLUMNS: 'Columns',
  BEAMS: 'Beams',
}

const SCOPE_NOUN: Record<IfcImportScopeKey, string> = {
  WALLS: 'wall',
  SLABS: 'slab',
  PAD_FOOTING: 'pad foundation',
  STRIP_FOOTING: 'strip foundation',
  PILE_CAP: 'pile cap',
  RAFT: 'raft foundation',
  COLUMNS: 'column',
  BEAMS: 'beam',
}

export function isIfcImportScopeKey(key: string): key is IfcImportScopeKey {
  return (IFC_IMPORT_SCOPE_KEYS as readonly string[]).includes(key)
}

export function suggestionMatchesScope(
  row: IfcSuggestion,
  elementKey: string,
): boolean {
  if (elementKey === 'WALLS') return row.entityType === 'IfcWall'
  if (elementKey === 'SLABS') return row.entityType === 'IfcSlab'
  if (elementKey === 'PAD_FOOTING') {
    return (
      row.entityType === 'IfcFooting' &&
      row.mappedInstanceData?.elementKey === 'PAD_FOOTING'
    )
  }
  if (elementKey === 'STRIP_FOOTING') {
    return (
      row.entityType === 'IfcFooting' &&
      row.mappedInstanceData?.elementKey === 'STRIP_FOOTING'
    )
  }
  if (elementKey === 'PILE_CAP') {
    return (
      row.entityType === 'IfcFooting' &&
      row.mappedInstanceData?.elementKey === 'PILE_CAP'
    )
  }
  if (elementKey === 'RAFT') return false
  if (elementKey === 'COLUMNS') return row.entityType === 'IfcColumn'
  if (elementKey === 'BEAMS') return row.entityType === 'IfcBeam'
  return false
}

export function filterSuggestionsForScope(
  rows: IfcSuggestion[],
  elementKey: string,
): IfcSuggestion[] {
  return rows.filter((row) => suggestionMatchesScope(row, elementKey))
}

export type IfcSuggestionTypeCounts = {
  walls: number
  slabs: number
  pads: number
  strips: number
  pileCaps: number
  columns: number
  beams: number
  unmappedFootings: number
}

export function countSuggestionTypes(
  rows: IfcSuggestion[],
): IfcSuggestionTypeCounts {
  const counts: IfcSuggestionTypeCounts = {
    walls: 0,
    slabs: 0,
    pads: 0,
    strips: 0,
    pileCaps: 0,
    columns: 0,
    beams: 0,
    unmappedFootings: 0,
  }
  for (const row of rows) {
    if (row.entityType === 'IfcWall') counts.walls += 1
    else if (row.entityType === 'IfcSlab') counts.slabs += 1
    else if (row.entityType === 'IfcColumn') counts.columns += 1
    else if (row.entityType === 'IfcBeam') counts.beams += 1
    else if (row.entityType === 'IfcFooting') {
      const key = row.mappedInstanceData?.elementKey
      if (key === 'PAD_FOOTING') counts.pads += 1
      else if (key === 'STRIP_FOOTING') counts.strips += 1
      else if (key === 'PILE_CAP') counts.pileCaps += 1
      else counts.unmappedFootings += 1
    }
  }
  return counts
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

function otherTypeParts(
  counts: IfcSuggestionTypeCounts,
  elementKey: string,
): string[] {
  const parts: string[] = []
  if (elementKey !== 'WALLS' && counts.walls) {
    parts.push(plural(counts.walls, 'wall'))
  }
  if (elementKey !== 'SLABS' && counts.slabs) {
    parts.push(plural(counts.slabs, 'slab'))
  }
  if (elementKey !== 'PAD_FOOTING' && counts.pads) {
    parts.push(plural(counts.pads, 'pad foundation'))
  }
  if (elementKey !== 'STRIP_FOOTING' && counts.strips) {
    parts.push(plural(counts.strips, 'strip foundation'))
  }
  if (elementKey !== 'PILE_CAP' && counts.pileCaps) {
    parts.push(plural(counts.pileCaps, 'pile cap'))
  }
  if (elementKey !== 'COLUMNS' && counts.columns) {
    parts.push(plural(counts.columns, 'column'))
  }
  if (elementKey !== 'BEAMS' && counts.beams) {
    parts.push(plural(counts.beams, 'beam'))
  }
  if (counts.unmappedFootings) {
    parts.push(
      `${plural(counts.unmappedFootings, 'unmapped footing')} (manual modeling)`,
    )
  }
  return parts
}

function joinList(parts: string[]): string {
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

function screenHint(elementKey: IfcImportScopeKey): string {
  return SCOPE_LABEL[elementKey]
}

function otherScreensHint(
  counts: IfcSuggestionTypeCounts,
  elementKey: string,
): string | null {
  const screens: string[] = []
  if (elementKey !== 'WALLS' && counts.walls) screens.push(screenHint('WALLS'))
  if (elementKey !== 'SLABS' && counts.slabs) screens.push(screenHint('SLABS'))
  if (elementKey !== 'PAD_FOOTING' && counts.pads) {
    screens.push(screenHint('PAD_FOOTING'))
  }
  if (elementKey !== 'STRIP_FOOTING' && counts.strips) {
    screens.push(screenHint('STRIP_FOOTING'))
  }
  if (elementKey !== 'PILE_CAP' && counts.pileCaps) {
    screens.push(screenHint('PILE_CAP'))
  }
  if (elementKey !== 'COLUMNS' && counts.columns) {
    screens.push(screenHint('COLUMNS'))
  }
  if (elementKey !== 'BEAMS' && counts.beams) {
    screens.push(screenHint('BEAMS'))
  }
  if (screens.length === 0) return null
  return `Open ${joinList(screens)} to review ${screens.length === 1 ? 'it' : 'them'}.`
}

export function scopeGroupTitle(elementKey: string): string {
  if (elementKey === 'WALLS') return 'Walls'
  if (elementKey === 'SLABS') return 'Slabs'
  if (elementKey === 'PAD_FOOTING') return 'Pad foundations'
  if (elementKey === 'STRIP_FOOTING') return 'Strip foundations'
  if (elementKey === 'PILE_CAP') return 'Pile caps'
  if (elementKey === 'RAFT') return 'Raft foundations'
  if (elementKey === 'COLUMNS') return 'Columns'
  if (elementKey === 'BEAMS') return 'Beams'
  return 'Suggestions'
}

export function scopeIntro(elementKey: string): string {
  if (elementKey === 'WALLS') {
    return 'Showing wall suggestions from this IFC. Slabs and foundations are reviewed from their own schedule screens. Accept creates a schedule instance tagged IFC_IMPORT (duplicate GlobalIds are skipped). Max file size 200 MB.'
  }
  if (elementKey === 'SLABS') {
    return 'Showing flat slab suggestions from this IFC. Walls and foundations are reviewed from their own schedule screens. Raft is not auto-mapped (slab-on-grade may appear here as IfcSlab). Accept creates a schedule instance tagged IFC_IMPORT (duplicate GlobalIds are skipped). Max file size 200 MB.'
  }
  if (elementKey === 'PAD_FOOTING') {
    return 'Showing pad foundation suggestions from this IFC. Strip and pile cap rows are reviewed on those screens. Raft is not auto-mapped. Accept creates a schedule instance tagged IFC_IMPORT (duplicate GlobalIds are skipped). Max file size 200 MB.'
  }
  if (elementKey === 'STRIP_FOOTING') {
    return 'Showing strip foundation suggestions from this IFC. Pad and pile cap rows are reviewed on those screens. Raft is not auto-mapped. Accept creates a schedule instance tagged IFC_IMPORT (duplicate GlobalIds are skipped). Max file size 200 MB.'
  }
  if (elementKey === 'PILE_CAP') {
    return 'Showing pile cap suggestions from this IFC. Pad and strip rows are reviewed on those screens. Pile count is usually missing from IFC and must be filled before Accept. Max file size 200 MB.'
  }
  if (elementKey === 'COLUMNS') {
    return 'Showing column suggestions from this IFC. Rectangular, circular, L, T, and cruciform sections are auto-mapped when the profile is confident; anything else stays for manual review. Accept creates a schedule instance tagged IFC_IMPORT (duplicate GlobalIds are skipped). Max file size 200 MB.'
  }
  if (elementKey === 'BEAMS') {
    return 'Showing beam suggestions from this IFC. Rectangular, T, L, cantilever-tapered, and ground-tie sections are auto-mapped when the profile is confident; lintels and unclassifiable sections stay for manual review. Accept creates a schedule instance tagged IFC_IMPORT (duplicate GlobalIds are skipped). Max file size 200 MB.'
  }
  if (elementKey === 'RAFT') {
    return 'Raft is not auto-mapped from IFC. Slab-on-grade (IfcSlab BASESLAB) appears under Slabs. Footings appear under Pad, Strip, or Pile Cap. Max file size 200 MB.'
  }
  return 'Upload runs the IFC parser in the background. Accept creates a schedule instance tagged IFC_IMPORT. Max file size 200 MB.'
}

export type IfcScopeEmptyCopy = {
  title: string
  body: string
}

export function emptyScopeCopy(
  elementKey: string,
  rows: IfcSuggestion[],
  summary: IfcImportJob['summary'],
): IfcScopeEmptyCopy {
  const scoped = filterSuggestionsForScope(rows, elementKey)
  if (scoped.length > 0) {
    return { title: '', body: '' }
  }

  const counts = countSuggestionTypes(rows)
  const others = otherTypeParts(counts, elementKey)
  const screens = otherScreensHint(counts, elementKey)
  const parseLine = `This file parsed as ${summary.walls} walls / ${summary.slabs} slabs / ${summary.footings ?? 0} footings / ${summary.columns ?? 0} columns / ${summary.beams ?? 0} beams.`
  const otherSentence = others.length
    ? ` It does contain ${joinList(others)}.${screens ? ` ${screens}` : ''}`
    : ''

  if (elementKey === 'RAFT') {
    return {
      title: 'Raft is not auto-mapped from IFC',
      body: `IfcSlab BASESLAB / slab-on-grade items appear under Slabs. IfcFooting entities appear under Pad, Strip, or Pile Cap. ${parseLine}${otherSentence}`,
    }
  }

  const noun = isIfcImportScopeKey(elementKey)
    ? SCOPE_NOUN[elementKey]
    : 'matching'
  const label = isIfcImportScopeKey(elementKey)
    ? SCOPE_LABEL[elementKey]
    : 'this element'

  if (elementKey === 'PAD_FOOTING' && (summary.footings ?? 0) === 0) {
    return {
      title: `No ${noun} suggestions in this IFC`,
      body: `This file contains no IfcFooting entities, so ${label} has nothing to review. Pads exported as Floor/Slab (IfcSlab) show under Slabs — they are not listed here. ${parseLine}${otherSentence}`,
    }
  }
  if (elementKey === 'STRIP_FOOTING' && (summary.footings ?? 0) === 0) {
    return {
      title: `No ${noun} suggestions in this IFC`,
      body: `This file contains no IfcFooting entities, so ${label} has nothing to review. ${parseLine}${otherSentence}`,
    }
  }
  if (elementKey === 'PILE_CAP' && (summary.footings ?? 0) === 0) {
    return {
      title: `No ${noun} suggestions in this IFC`,
      body: `This file contains no IfcFooting entities, so ${label} has nothing to review. ${parseLine}${otherSentence}`,
    }
  }
  if (elementKey === 'WALLS' && summary.walls === 0) {
    return {
      title: 'No wall suggestions in this IFC',
      body: `This file contains no IfcWall entities. ${parseLine}${otherSentence}`,
    }
  }
  if (elementKey === 'SLABS' && summary.slabs === 0) {
    return {
      title: 'No slab suggestions in this IFC',
      body: `This file contains no IfcSlab entities. ${parseLine}${otherSentence}`,
    }
  }
  if (elementKey === 'COLUMNS' && (summary.columns ?? 0) === 0) {
    return {
      title: 'No column suggestions in this IFC',
      body: `This file contains no IfcColumn entities, so Columns has nothing to review. ${parseLine}${otherSentence}`,
    }
  }
  if (elementKey === 'BEAMS' && (summary.beams ?? 0) === 0) {
    return {
      title: 'No beam suggestions in this IFC',
      body: `This file contains no IfcBeam entities, so Beams has nothing to review. ${parseLine}${otherSentence}`,
    }
  }

  return {
    title: `No ${noun} suggestions mapped`,
    body: `Nothing in this IFC mapped to ${label}. ${parseLine}${otherSentence}`,
  }
}

export function otherTypesHint(
  elementKey: string,
  rows: IfcSuggestion[],
): string | null {
  const scoped = filterSuggestionsForScope(rows, elementKey)
  if (scoped.length === 0) return null
  const counts = countSuggestionTypes(rows)
  const others = otherTypeParts(counts, elementKey)
  if (!others.length) return null
  const screens = otherScreensHint(counts, elementKey)
  return `Also parsed: ${joinList(others)}.${screens ? ` ${screens}` : ''}`
}
