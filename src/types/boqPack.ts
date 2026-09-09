export type BoqPackModuleSummary = {
  moduleNo: number
  moduleKey: string
  title: string
  itemCount: number
}

export type BoqPackElementSummary = {
  elementKey: string
  label: string
  moduleNo: number
  bindingKind: 'ENGINE' | 'CATALOGUE'
  engineKey: string
  scope: 'PROJECT' | 'FLOOR'
  sortOrder: number
}

export type BoqPackSummary = {
  id: string
  version: number
  status: string
  profile: string
  source: {
    fileName: string
    uploadedAt: string
    parserVersion: string
  }
  pricing: {
    currency: string
    location?: string
    taxInclusive: boolean
  }
  counts: {
    modules: number
    elements: number
    items: number
    rates: number
    resources: number
    analyses: number
  }
  modules: BoqPackModuleSummary[]
  warnings: string[]
}

export type BoqPackReconcile = {
  preserved: number
  needsReview: number
  orphaned: number
}

export type BoqPackUploadResult = {
  pack: BoqPackSummary | null
  packId: string
  reconcile: BoqPackReconcile
  selectedCreated: number
  warnings: string[]
  errors?: string[]
}

export type PackResourceRow = {
  id: string
  code: string
  category: string
  description: string
  unit: string
  unitRate: number
  wastePct: number
  sortOrder: number
  usageCount: number
  staleAnalysisCount: number
}

export type PackAnalysisListRow = {
  id: string
  lineKey: string
  moduleNo: number
  ref: string
  description: string
  unit: string
  status: 'APPLIED' | 'STALE' | 'INVALID'
  revision: number
  appliedRevision: number
  calculatedRate: number
  appliedRate: number
  rateSource: string
  delta: number
}

export type PackAnalysisDetail = {
  packId: string
  analysis: {
    id: string
    lineKey: string
    moduleNo: number
    ref: string
    description: string
    unit: string
    revision: number
    appliedRevision: number
    status: 'APPLIED' | 'STALE' | 'INVALID'
    allowances: {
      transportPctMaterials: number
      sundriesPctLabourPlantSubcontract: number
      overheadPct: number
      profitPct: number
    }
    lines: Array<{
      id: string
      sourceCode: string
      quantity: number
      remarks: string
      description: string
      category: string
      unit: string
      unitRate: number
      wastePct: number
      amount: number
      missing: boolean
    }>
    computed: {
      material: number
      labour: number
      plant: number
      subcontract: number
      baseResourceCost: number
      wasteAllowance: number
      directResourceCost: number
      transport: number
      sundries: number
      primeCost: number
      overhead: number
      profit: number
      compositeRate: number
    }
  }
  pricing?: {
    currency: string
    location: string
    taxInclusive: boolean
  }
  applied: {
    compositeRate: number
    rateSource: string
    material: number
    labour: number
    plant: number
    subcontract: number
  } | null
  delta: number
}
