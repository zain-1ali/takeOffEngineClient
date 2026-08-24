import { api } from '../lib/api'
import type { Instance } from '../types/api'

export type PromotionMeasurementType = 'AREA' | 'LINEAR'
export type PromotionSourceKind = 'TAKEOFF_ITEM' | 'AI_SUGGESTION'

export interface BlueprintPromotionOption {
  elementKey: string
  label: string
  measurementType: PromotionMeasurementType
  mappedField: string
}

export function fetchBlueprintPromotionOptions(
  projectId: string,
  measurementType: PromotionMeasurementType,
) {
  return api<{ options: BlueprintPromotionOption[] }>(
    `/api/projects/${projectId}/blueprint-promotions/options?measurementType=${measurementType}`,
  )
}

export function promoteBlueprintSource(
  projectId: string,
  body: {
    sourceKind: PromotionSourceKind
    sourceId: string
    floorId: string
    elementKey: string
  },
) {
  return api<{ instance: Instance }>(
    `/api/projects/${projectId}/blueprint-promotions`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
}
