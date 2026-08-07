/** Rate library types — mirrors backend engines/rateAnalysis.ts */

export type RateResource = {
  code: string
  desc: string
  unit: string
  rate: number
  wastage?: number
}

export type RateMethod = {
  code: string
  title: string
  standard: string
  statement: string
}

export type RateCoeffLine = { ref: string; coeff: number }

export type RateAnalysisDef = {
  label: string
  unit: string
  method: string
  ohp?: number
  materials?: RateCoeffLine[]
  labour?: RateCoeffLine[]
  equipment?: RateCoeffLine[]
}

export type RateLib = {
  materials: RateResource[]
  labour: RateResource[]
  equipment: RateResource[]
  methods: RateMethod[]
  analyses: Record<string, RateAnalysisDef>
}

export type RateLineDetail = {
  ref: string
  desc: string
  unit: string
  coeff: number
  rate: number
  wastage: number
  amount: number
}

export type AnalysedRate = {
  code: string
  label: string
  unit: string
  method: string
  ohp: number
  matLines: RateLineDetail[]
  labLines: RateLineDetail[]
  eqLines: RateLineDetail[]
  matCost: number
  labCost: number
  eqCost: number
  prime: number
  ohpAmt: number
  rate: number
}
