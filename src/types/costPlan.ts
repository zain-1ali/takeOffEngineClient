export type CostPlanWorkCategory =
  | 'Concrete'
  | 'Formwork'
  | 'Reinforcement'
  | 'Masonry'
  | 'Finishes'
  | 'Other'

export type CostPlanLine = {
  kind: 'group' | 'item' | 'total'
  ref?: string
  description: string
  qty?: number
  unit?: string
  rate?: number | null
  amount?: number | null
  /** amount ÷ gfaM2; omitted when GFA is not set */
  ratePerM2?: number
  isRebar?: boolean
  dec?: number
  source?: 'MODELLED' | 'MANUAL'
  uniformatCode?: string
  elementKey?: string
  workCategory?: CostPlanWorkCategory
}



export type CostPlanCodeSection = {

  code: string

  title: string

  heading: string

  lines: CostPlanLine[]

  subtotal: number

}



export type CostPlanGroupSection = {

  id: string

  title: string

  heading: string

  codes: CostPlanCodeSection[]

  subtotal: number

}



export type CostPlanSummaryLine = {

  kind: 'stage' | 'addon' | 'total'

  description: string

  amount: number

  percentOfElemental?: number

  percentApplied?: number

  ratePerM2?: number

}



export type CostPlanCascade = {

  designAllowancePercent: number

  overheadPercent: number

  profitPercent: number

  inflationPercent: number

  elementalCost: number

  designAllowanceAmount: number

  elementalWithDesignAllowance: number

  overheadAmount: number

  profitAmount: number

  constructionCostWithoutInflation: number

  inflationAmount: number

  constructionCostSCC: number

  percentOfElemental: {

    elemental: number

    withDesignAllowance: number

    withoutInflation: number

    scc: number

  }

  summaryLines: CostPlanSummaryLine[]

}



export type CostPlanPayload = {

  currency: string

  scope: 'floor' | 'project'

  floorId: string | null

  /** Gross Floor Area (m²). Null → omit Rate/m² column. */

  gfaM2: number | null

  groups: CostPlanGroupSection[]

  lines: CostPlanLine[]

  grandTotal: number

  unclassifiedCount: number

  cascade: CostPlanCascade

  locationOptions?: Record<string, string[]>

}


