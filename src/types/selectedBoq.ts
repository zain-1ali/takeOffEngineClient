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
  createdAt: string
  updatedAt: string
}
