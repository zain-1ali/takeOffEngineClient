export type ReportSource = 'MODELLED' | 'MANUAL' | 'CATALOGUE'

export type ReportLine = {
  kind: 'group' | 'item' | 'total'
  ref?: string
  description: string
  qty?: number
  unit?: string
  rate?: number | null
  amount?: number | null
  isRebar?: boolean
  dec?: number
  source?: ReportSource
  nrm2Ref?: string
  quantityBasis?: 'independent' | 'derived' | 'conditional'
  workCategory?: string
  formulaText?: string
  applicableLevels?: string[]
}

export type LabourActivity = {
  ref: string
  activity: string
  qty: number
  unit: string
  outputRate: string
  /** Crew composition, e.g. "1 Mason + 2 Labourer". */
  gang: string
  days: number
  floorId?: string | null
  source?: ReportSource
}

export type TradeSummary = {
  trade: string
  manDays: number
  dayRate: number
  cost: number
  source?: ReportSource
}

export type LabourFloorLoad = {
  floorId: string
  activities: LabourActivity[]
  trades: TradeSummary[]
  totalManDays: number
  totalCost: number
}

export type ElementReportBundle = {
  elementKey: string
  num: number
  suffix: string
  label: string
  kind: 'structural' | 'masonry' | 'finish' | 'earthworks'
  units: number
  boq: ReportLine[]
  bom: ReportLine[]
  labour: {
    activities: LabourActivity[]
    trades: TradeSummary[]
    totalManDays: number
    totalCost: number
  }
  summary: Record<string, number>
  cost: { boq: number; bom: number; labour: number }
}

export type ProjectReports = {
  scope: 'floor' | 'project'
  floorId: string | null
  currency: string
  unitSystem?: 'metric' | 'imperial'
  summary: {
    totalConcrete: number
    totalFormwork: number
    totalSteel: number
    totalUnits: number
    pricedTotal: number
    elementCount: number
  }
  boq: ReportLine[]
  bom: ReportLine[]
  labour: {
    activities: LabourActivity[]
    trades: TradeSummary[]
    totalManDays: number
    totalCost: number
    byFloor?: LabourFloorLoad[]
  }
  byElement: ElementReportBundle[]
}
