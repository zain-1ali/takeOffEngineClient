/**
 * Hand-check: IFC review is scoped to the schedule screen that opened import.
 * Run: npx tsx src/components/schedule/ifcImportScope.check.ts
 */
import assert from 'node:assert/strict'
import type { IfcSuggestion } from '../../types/ifcImport'
import {
  emptyScopeCopy,
  filterSuggestionsForScope,
  otherTypesHint,
  suggestionMatchesScope,
} from './ifcImportScope'

function stub(partial: Partial<IfcSuggestion> & Pick<IfcSuggestion, 'entityType'>): IfcSuggestion {
  return {
    id: 'row-1',
    projectId: 'p',
    jobId: 'j',
    sourceGlobalId: 'gid',
    expressId: 1,
    name: 'test',
    floorId: 'GF',
    sourceStorey: null,
    floorMatchStatus: 'MATCHED_NAME',
    floorMatchNote: '',
    mappedInstanceData: null,
    confidence: 'HIGH',
    confidenceNotes: [],
    needsManualModeling: false,
    skipReason: null,
    status: 'PENDING',
    acceptedInstanceId: null,
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

const wall = stub({ entityType: 'IfcWall' })
const slab = stub({ entityType: 'IfcSlab' })
const pad = stub({
  entityType: 'IfcFooting',
  mappedInstanceData: {
    elementKey: 'PAD_FOOTING',
    shape: 'RECTANGULAR',
    mark: null,
    geometry: { length: 2, width: 2, baseThickness: 0.6 },
  },
})
const strip = stub({
  entityType: 'IfcFooting',
  mappedInstanceData: {
    elementKey: 'STRIP_FOOTING',
    shape: 'FLAT',
    mark: null,
    geometry: { length: 10, width: 0.6, height: 0.3 },
  },
})
const cap = stub({
  entityType: 'IfcFooting',
  mappedInstanceData: {
    elementKey: 'PILE_CAP',
    shape: 'RECTANGULAR',
    mark: null,
    geometry: { length: 3, width: 2.5, thickness: 0.5 },
  },
})
const column = stub({
  entityType: 'IfcColumn',
  mappedInstanceData: {
    elementKey: 'COLUMNS',
    shape: 'RECTANGULAR',
    mark: null,
    geometry: { width: 0.4, depth: 0.3, clearHeight: 3 },
  },
})
const beam = stub({
  entityType: 'IfcBeam',
  mappedInstanceData: {
    elementKey: 'BEAMS',
    shape: 'RECTANGULAR',
    mark: null,
    geometry: { spanLength: 4, width: 0.3, depth: 0.5 },
  },
})

const mixed = [wall, slab, pad, strip, cap, column, beam]

assert.equal(suggestionMatchesScope(wall, 'WALLS'), true)
assert.equal(suggestionMatchesScope(slab, 'WALLS'), false)
assert.equal(filterSuggestionsForScope(mixed, 'WALLS').length, 1)
assert.equal(filterSuggestionsForScope(mixed, 'SLABS').length, 1)
assert.equal(filterSuggestionsForScope(mixed, 'PAD_FOOTING')[0], pad)
assert.equal(filterSuggestionsForScope(mixed, 'STRIP_FOOTING')[0], strip)
assert.equal(filterSuggestionsForScope(mixed, 'PILE_CAP')[0], cap)
assert.equal(filterSuggestionsForScope(mixed, 'COLUMNS')[0], column)
assert.equal(filterSuggestionsForScope(mixed, 'BEAMS')[0], beam)
assert.equal(filterSuggestionsForScope(mixed, 'RAFT').length, 0)

const villaEmpty = emptyScopeCopy(
  'PAD_FOOTING',
  [wall, slab],
  { walls: 138, slabs: 156, footings: 0, geometryOk: 294, skipped: 0 },
)
assert.match(villaEmpty.title, /No pad foundation/)
assert.match(villaEmpty.body, /no IfcFooting/)
assert.match(villaEmpty.body, /138 walls \/ 156 slabs \/ 0 footings/)
assert.match(villaEmpty.body, /Slabs/)

const wallsOnlyHint = otherTypesHint('WALLS', mixed)
assert.ok(wallsOnlyHint)
assert.match(wallsOnlyHint, /1 slab/)
assert.match(wallsOnlyHint, /pad foundation/)
assert.match(wallsOnlyHint, /Slabs/)
assert.match(wallsOnlyHint, /column/)

const columnsHint = otherTypesHint('COLUMNS', mixed)
assert.ok(columnsHint)
assert.match(columnsHint, /wall/)

const raftCopy = emptyScopeCopy('RAFT', mixed, {
  walls: 1,
  slabs: 1,
  footings: 3,
  geometryOk: 5,
  skipped: 0,
})
assert.match(raftCopy.title, /not auto-mapped/)
assert.match(raftCopy.body, /Pad/)

const columnsEmpty = emptyScopeCopy(
  'COLUMNS',
  [wall, slab],
  { walls: 1, slabs: 1, footings: 0, columns: 0, geometryOk: 2, skipped: 0 },
)
assert.match(columnsEmpty.title, /No column/)
assert.match(columnsEmpty.body, /no IfcColumn/)
assert.match(columnsEmpty.body, /1 walls \/ 1 slabs \/ 0 footings \/ 0 columns \/ 0 beams/)

const beamsEmpty = emptyScopeCopy(
  'BEAMS',
  [wall, slab],
  { walls: 1, slabs: 1, footings: 0, columns: 0, beams: 0, geometryOk: 2, skipped: 0 },
)
assert.match(beamsEmpty.title, /No beam/)
assert.match(beamsEmpty.body, /no IfcBeam/)

console.log('ifcImportScope.check.ts: all assertions passed')
