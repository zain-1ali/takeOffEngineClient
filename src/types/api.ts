import type { RateLib } from './rateLib'

export type AxisLine = { label: string; spacing: number }

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
}

export type Project = {
  id: string
  name: string
  number: string
  client: string
  contractor: string
  location: string
  currency: string
  units: string
  preparedBy: string
  revision: string
  date: string
  materials: ProjectMaterials
  rateLib: RateLib
  useRateAnalysis: boolean
  grid: { xAxes: AxisLine[]; yAxes: AxisLine[] }
  createdAt?: string
  updatedAt?: string
}

export type ProjectSummary = {
  id: string
  name: string
  number: string
  client: string
  currency: string
  updatedAt: string
  createdAt: string
}

export type DashboardProjectCard = {
  id: string
  name: string
  number: string
  client: string
  location: string
  currency: string
  defaultGrade: string
  floorCount: number
  elementCount: number
  pricedTotal: number
  unpricedCount: number
  verified: boolean
  updatedAt: string
  createdAt: string
}

export type DashboardPayload = {
  stats: {
    activeProjects: number
    elementsModelled: number
    handCalcVerifiedPct: number
    handCalcVerifiedIsPlaceholder: boolean
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
  createdAt?: string
  updatedAt?: string
}

export type CalcResultRow = {
  instanceId: string
  mark: string
  result: Record<string, unknown>
}
