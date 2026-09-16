export type TakeoffInputMethod =
  | 'auto'
  | 'count'
  | 'length'
  | 'area'
  | 'volume'
  | 'weight'
  | 'time'
  | 'percent'
  | 'direct'

export type TakeoffLineInput = {
  enabled?: boolean
  method?: TakeoffInputMethod
  quantity?: number
  count?: number
  length?: number
  width?: number
  height?: number
  depth?: number
  factor?: number
  wastePct?: number
  percentage?: number
  sourceLineKey?: string
}

export type TakeoffInputSet = {
  id: string | null
  projectId: string
  floorId: string
  elementKey: string
  shared: Record<string, unknown>
  lineInputs: Record<string, TakeoffLineInput>
  updatedAt: string
}

export type TakeoffDriverField = {
  key: string
  label: string
  group: string
  type: 'number' | 'percent' | 'switch' | 'count'
  unit?: string
  default?: number | boolean
  feeds?: string[]
}

export type TakeoffInputSchema = {
  elementKey: string
  engineKey: string
  persistFloorId: string
  fields: TakeoffDriverField[]
  selectedCount: number
}
