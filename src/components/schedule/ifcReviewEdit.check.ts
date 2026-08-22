/**
 * Hand-check: required-field edit + live shape seed + Accept / Preview gates.
 * Run: npx tsx src/components/schedule/ifcReviewEdit.check.ts
 */
import assert from 'node:assert/strict'
import type { IfcSuggestion } from '../../types/ifcImport'
import {
  acceptReady,
  applySuggestionGeoPatch,
  canPreviewIfcSuggestion,
  geoInputDisabled,
  missingFields,
} from './ifcReviewEdit'

function stub(partial: Partial<IfcSuggestion> & Pick<IfcSuggestion, 'entityType'>): IfcSuggestion {
  return {
    id: 'row-1',
    projectId: 'p',
    jobId: 'j',
    sourceGlobalId: 'gid',
    expressId: 1,
    name: 'test',
    floorId: 'FDN',
    sourceStorey: null,
    floorMatchStatus: 'MATCHED_NAME',
    floorMatchNote: '',
    mappedInstanceData: null,
    confidence: 'MEDIUM',
    confidenceNotes: [],
    needsManualModeling: true,
    skipReason: null,
    status: 'PENDING',
    acceptedInstanceId: null,
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

// --- previously-stuck strip: shapeless, H required ---
const strip = stub({
  entityType: 'IfcFooting',
  mappedInstanceData: {
    elementKey: 'STRIP_FOOTING',
    shape: null,
    mark: null,
    geometry: { length: 10, width: 0.6 },
  },
})
assert.equal(geoInputDisabled(strip, 'height'), false, 'H editable on shapeless strip')
assert.equal(geoInputDisabled(strip, 'pileCount'), true, 'Piles stay disabled on strip')
assert.ok(missingFields(strip).includes('Height (H)'))
assert.ok(missingFields(strip).includes('Shape'))
assert.equal(acceptReady(strip), false)

const afterH = applySuggestionGeoPatch(strip, 'height', '0.3')
assert.equal(afterH.seededShape, 'FLAT', 'typing H seeds FLAT')
assert.equal(afterH.row.mappedInstanceData?.shape, 'FLAT', 'Shape column reads FLAT live')
assert.equal(missingFields(afterH.row).includes('Shape'), false)
assert.equal(missingFields(afterH.row).includes('Height (H)'), false)
assert.equal(acceptReady(afterH.row), true, 'Accept unblocks once H is filled')
assert.equal(canPreviewIfcSuggestion(afterH.row), true, 'strip Preview unblocks with H')

// Clearing H keeps the assumed shape visible
const clearedH = applySuggestionGeoPatch(afterH.row, 'height', '')
assert.equal(clearedH.seededShape, null)
assert.equal(clearedH.row.mappedInstanceData?.shape, 'FLAT')

// --- previously-stuck pile cap: shapeless, Piles required ---
const cap = stub({
  entityType: 'IfcFooting',
  mappedInstanceData: {
    elementKey: 'PILE_CAP',
    shape: null,
    mark: null,
    geometry: { length: 3, width: 2.5, thickness: 0.5 },
  },
})
assert.equal(geoInputDisabled(cap, 'pileCount'), false, 'Piles editable on shapeless pile cap')
assert.equal(geoInputDisabled(cap, 'height'), true, 'H stays disabled on pile cap')
assert.ok(missingFields(cap).includes('Piles'))
assert.equal(acceptReady(cap), false)

const afterPiles = applySuggestionGeoPatch(cap, 'pileCount', '4')
assert.equal(afterPiles.seededShape, 'RECTANGULAR', 'typing Piles seeds RECTANGULAR')
assert.equal(afterPiles.row.mappedInstanceData?.shape, 'RECTANGULAR')
assert.equal(afterPiles.row.mappedInstanceData?.geometry?.pileCount, 4)
assert.deepEqual(missingFields(afterPiles.row), [])
assert.equal(acceptReady(afterPiles.row), true, 'Accept unblocks once Piles is filled')
assert.equal(canPreviewIfcSuggestion(afterPiles.row), true, 'pile-cap Preview unblocks with Piles')

// Mapped pile cap already has shape — typing Piles must not relabel as assumed
const mappedCap = stub({
  entityType: 'IfcFooting',
  mappedInstanceData: {
    elementKey: 'PILE_CAP',
    shape: 'RECTANGULAR',
    mark: null,
    geometry: { length: 3, width: 2.5, thickness: 0.5 },
  },
})
assert.equal(geoInputDisabled(mappedCap, 'pileCount'), false)
const afterMappedPiles = applySuggestionGeoPatch(mappedCap, 'pileCount', '4')
assert.equal(afterMappedPiles.seededShape, null, 'IFC shape is not marked assumed')
assert.equal(afterMappedPiles.row.mappedInstanceData?.shape, 'RECTANGULAR')
assert.equal(acceptReady(afterMappedPiles.row), true)

// Slabs: H / Piles inapplicable
const slab = stub({
  entityType: 'IfcSlab',
  needsManualModeling: false,
  mappedInstanceData: {
    elementKey: 'SLABS',
    shape: 'FLAT',
    mark: null,
    geometry: { length: 6, width: 4, thickness: 0.2 },
  },
})
assert.equal(geoInputDisabled(slab, 'height'), true)
assert.equal(geoInputDisabled(slab, 'pileCount'), true)
assert.equal(acceptReady(slab), true)
assert.equal(canPreviewIfcSuggestion(slab), true, 'complete slab can preview')

const slabIncomplete = stub({
  entityType: 'IfcSlab',
  mappedInstanceData: {
    elementKey: 'SLABS',
    shape: 'FLAT',
    mark: null,
    geometry: { length: 6, width: 4 },
  },
})
assert.equal(canPreviewIfcSuggestion(slabIncomplete), false, 'slab missing T cannot preview')

// Wall Preview uses the same missing-dim gate as Accept (minus floor).
const wallMissingH = stub({
  entityType: 'IfcWall',
  mappedInstanceData: {
    elementKey: 'WALLS',
    shape: 'LINEAR',
    mark: null,
    geometry: { length: 5, thickness: 0.2 },
  },
})
assert.equal(geoInputDisabled(wallMissingH, 'height'), false)
assert.ok(missingFields(wallMissingH).includes('Height (H)'))
const afterWallH = applySuggestionGeoPatch(wallMissingH, 'height', '3')
assert.equal(afterWallH.seededShape, null, 'wall already LINEAR — not assumed')
assert.deepEqual(missingFields(afterWallH.row), [])
assert.equal(acceptReady(afterWallH.row), true)
assert.equal(canPreviewIfcSuggestion(afterWallH.row), true, 'wall Preview unblocks with H')

// --- Columns: shapeless unclassifiable row, then RECTANGULAR dims ---
const columnOdd = stub({
  entityType: 'IfcColumn',
  mappedInstanceData: {
    elementKey: 'COLUMNS',
    shape: null,
    mark: null,
    geometry: null,
  },
})
assert.ok(missingFields(columnOdd).includes('Shape'))
assert.equal(geoInputDisabled(columnOdd, 'width'), true, 'W stays closed until a shape is picked')
assert.equal(canPreviewIfcSuggestion(columnOdd), false)
assert.equal(acceptReady(columnOdd), false)

const columnPicked = {
  ...columnOdd,
  mappedInstanceData: {
    elementKey: 'COLUMNS' as const,
    shape: 'RECTANGULAR',
    mark: null,
    geometry: {} as Record<string, number>,
  },
}
assert.equal(geoInputDisabled(columnPicked, 'width'), false, 'W editable after RECTANGULAR is chosen')
assert.equal(geoInputDisabled(columnPicked, 'depth'), false, 'D editable after RECTANGULAR is chosen')
assert.equal(geoInputDisabled(columnPicked, 'clearHeight'), false, 'H editable after RECTANGULAR is chosen')
assert.equal(geoInputDisabled(columnPicked, 'diameter'), true, 'Dia stays disabled on rectangular')
assert.ok(missingFields(columnPicked).includes('W (m)'))
assert.ok(missingFields(columnPicked).includes('H (m)'))

const afterW = applySuggestionGeoPatch(columnPicked, 'width', '0.4')
assert.equal(afterW.seededShape, null, 'columns never assume a shape from a typed number')
const afterD = applySuggestionGeoPatch(afterW.row, 'depth', '0.3')
const afterColH = applySuggestionGeoPatch(afterD.row, 'clearHeight', '3')
assert.deepEqual(missingFields(afterColH.row), [])
assert.equal(acceptReady(afterColH.row), true)
assert.equal(canPreviewIfcSuggestion(afterColH.row), true, 'column Preview unblocks with W/D/H')

const circular = stub({
  entityType: 'IfcColumn',
  mappedInstanceData: {
    elementKey: 'COLUMNS',
    shape: 'CIRCULAR',
    mark: null,
    geometry: { diameter: 0.4, clearHeight: 3 },
  },
})
assert.equal(geoInputDisabled(circular, 'diameter'), false)
assert.equal(geoInputDisabled(circular, 'width'), true)
assert.equal(canPreviewIfcSuggestion(circular), true)

// --- Beams: shapeless unclassifiable row, then RECTANGULAR dims ---
const beamOdd = stub({
  entityType: 'IfcBeam',
  mappedInstanceData: {
    elementKey: 'BEAMS',
    shape: null,
    mark: null,
    geometry: null,
  },
})
assert.ok(missingFields(beamOdd).includes('Shape'))
assert.equal(geoInputDisabled(beamOdd, 'spanLength'), true, 'Span stays closed until a shape is picked')
assert.equal(geoInputDisabled(beamOdd, 'width'), true, 'W stays closed until a shape is picked')
assert.equal(canPreviewIfcSuggestion(beamOdd), false)
assert.equal(acceptReady(beamOdd), false)

const beamPicked = {
  ...beamOdd,
  mappedInstanceData: {
    elementKey: 'BEAMS' as const,
    shape: 'RECTANGULAR',
    mark: null,
    geometry: {} as Record<string, number>,
  },
}
assert.equal(geoInputDisabled(beamPicked, 'spanLength'), false, 'Span editable after RECTANGULAR is chosen')
assert.equal(geoInputDisabled(beamPicked, 'width'), false, 'W editable after RECTANGULAR is chosen')
assert.equal(geoInputDisabled(beamPicked, 'depth'), false, 'D editable after RECTANGULAR is chosen')
assert.equal(geoInputDisabled(beamPicked, 'tipDepth'), true, 'Tip D stays disabled on rectangular')
assert.equal(geoInputDisabled(beamPicked, 'pileCount'), true, 'Piles stay disabled on beams')
assert.ok(missingFields(beamPicked).includes('Span (m)'))
assert.ok(missingFields(beamPicked).includes('W (m)'))

const afterSpan = applySuggestionGeoPatch(beamPicked, 'spanLength', '4')
assert.equal(afterSpan.seededShape, null, 'beams never assume a shape from a typed number')
const afterBeamW = applySuggestionGeoPatch(afterSpan.row, 'width', '0.3')
const afterBeamD = applySuggestionGeoPatch(afterBeamW.row, 'depth', '0.5')
assert.deepEqual(missingFields(afterBeamD.row), [])
assert.equal(acceptReady(afterBeamD.row), true)
assert.equal(canPreviewIfcSuggestion(afterBeamD.row), true, 'beam Preview unblocks with Span/W/D')

const tapered = stub({
  entityType: 'IfcBeam',
  mappedInstanceData: {
    elementKey: 'BEAMS',
    shape: 'CANTILEVER_TAPERED',
    mark: null,
    geometry: { spanLength: 4, width: 0.3, supportDepth: 0.6, tipDepth: 0.3 },
  },
})
assert.equal(geoInputDisabled(tapered, 'supportDepth'), false)
assert.equal(geoInputDisabled(tapered, 'tipDepth'), false)
assert.equal(geoInputDisabled(tapered, 'depth'), true)
assert.equal(canPreviewIfcSuggestion(tapered), true)

console.log('ifcReviewEdit.check.ts: all assertions passed')
