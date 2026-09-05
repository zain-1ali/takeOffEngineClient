export type BoqCatalogueListItem = {
  ref: string
  elementKey: string
  elementLabel: string
  description: string
  unit: string
  formulaText: string
  quantityBasis: 'independent' | 'derived' | 'conditional'
  nrm2Ref: string
  workCategory: string
  applicableLevels: string[]
}

export type SelectedBoqItem = {
  id: string
  projectId: string
  floorId: string
  elementKey: string
  catalogueRef: string
  description: string
  unit: string
  formulaText: string
  quantityBasis: 'independent' | 'derived' | 'conditional' | ''
  nrm2Ref: string
  workCategory: string
  applicableLevels: string[]
  quantity: number
  wastePct: number
  takeoffKind: '' | 'dim' | 'bbs'
  measurementSetId: string | null
  takeoffLineCount: number
  createdAt: string
  updatedAt: string
}

export type BoqTakeoffLinkTarget = {
  setId: string
  itemId: string
  ref: string
  description: string
  unit: string
  lineCount: number
  lines: import('../lib/boqTakeoff/measurement').TakeoffLine[]
}

export type BoqTakeoffSharedBy = {
  id: string
  ref: string
  description: string
  unit: string
}

export type BoqTakeoffDetail = {
  kind: 'dim' | 'bbs'
  unit: string
  ref: string
  description: string
  elementKey: string
  wastePct: number
  measurementSetId: string | null
  linked: boolean
  lines: import('../lib/boqTakeoff/measurement').TakeoffLine[]
  bars: import('../lib/boqTakeoff/bbs').BbsBar[]
  sharedBy: BoqTakeoffSharedBy[]
  linkTargets: BoqTakeoffLinkTarget[]
}
