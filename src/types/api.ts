import type { RateLib } from './rateLib'

export type AxisLine = { label: string; spacing: number }

export type ConcreteMix = {
  cement: number
  sand: number
  agg: number
  water: number
}

export type MortarMix = {
  cementBagsPerM3: number
  sandM3PerM3: number
}

/** Screed / plaster: cement kg + sand m³ per m³ finished material. */
export type FinishWetMix = {
  cementKgPerM3: number
  sandM3PerM3: number
}

export type ProjectMaterials = {
  concreteClasses: string[]
  defaultConcreteGrade: string
  stoneMortarRatio: string
  stoneMortarFraction: number
  blindingThickness: number
  screedThickness: number
  plasterThickness: number
  paintCoats: number
  tileWastage: number
  earthworkBulkingFactor: number
  /** Draft kg/m² — BOM uses applied_* until revision bump. */
  verticalBracingRate: number
  soffitPropRate: number
  appliedVerticalBracingRate: number
  appliedSoffitPropRate: number
  concreteMixes: Record<string, ConcreteMix>
  appliedConcreteMixes: Record<string, ConcreteMix>
  mortarMix: MortarMix
  appliedMortarMix: MortarMix
  screedMix: FinishWetMix
  appliedScreedMix: FinishWetMix
  plasterMix: FinishWetMix
  appliedPlasterMix: FinishWetMix
  appliedStoneMortarRatio: string
  appliedStoneMortarFraction: number
}

export type CurrencyConversionLogEntry = {
  id: string
  fromCurrency: string
  toCurrency: string
  rateUsed: number
  rateDate: string
  timestamp: string | Date
  triggeredBy: string
}

export type Project = {
  id: string
  name: string
  number: string
  client: string
  contractor: string
  consultant: string
  location: string
  currency: string
  /** Canonical `metric` | `imperial` (legacy strings still parsed). */
  units: string
  preparedBy: string
  revision: string
  date: string
  /** Gross Floor Area (m²) for Cost Plan Rate/m². Null/undefined = omit the column. */
  gfaM2?: number | null
  /** Cost Plan cascade — percentage points (6 = 6%). */
  designAllowancePercent?: number
  overheadPercent?: number
  profitPercent?: number
  inflationPercent?: number
  /** Cost Plan / bill PDF color theme id. */
  reportTheme?: string
  materials: ProjectMaterials
  rateLib: RateLib
  useRateAnalysis: boolean
  grid: { xAxes: AxisLine[]; yAxes: AxisLine[] }
  currencyConversionLog?: CurrencyConversionLogEntry[]
  createdAt?: string
  updatedAt?: string
}

export type ProjectSummary = {
  id: string
  name: string
  number: string
  client: string
  currency: string
  updatedAt?: string
  createdAt?: string
}

export type DashboardProjectCard = {
  id: string
  name: string
  number: string
  client: string
  contractor?: string
  consultant?: string
  location: string
  currency: string
  defaultGrade: string
  floorCount: number
  elementCount: number
  pricedTotal: number
  unpricedCount: number
  verified: boolean
  updatedAt?: string
  createdAt?: string
}

export type DashboardPayload = {
  stats: {
    activeProjects: number
    elementsModelled: number
    handCalcVerifiedPct: number
    handCalcVerifiedIsPlaceholder?: boolean
    totalPricedValue: number
    currency: string
    pendingReview: number
  }
  projects: DashboardProjectCard[]
  recentActivity: { id: string; description: string; createdAt: string }[]
}

export type Floor = {
  id: string
  floorId: string
  label: string
  elevation: number
  height: number
  sortOrder: number
}

export type Instance = {
  id: string
  floorId: string
  elementKey: string
  shape: string
  mark: string
  count: number
  geometry: Record<string, unknown>
  concreteGrade: string | null
  reinforcement: Record<string, unknown> | null
  spec: string | null
  /** UniFormat location (Walls / Slabs / Doors / Wall finishes). */
  location: string | null
  source?: 'MANUAL' | 'IFC_IMPORT' | null
  sourceGlobalId?: string | null
  createdAt?: string
  updatedAt?: string
}

export type CalcResultRow = {
  instanceId: string
  mark: string
  count: number
  result: Record<string, unknown>
}
