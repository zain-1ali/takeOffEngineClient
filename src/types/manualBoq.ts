export type ManualBoqLinkKind = 'none' | 'analysis' | 'resource'
export type ManualBoqLabourMode = 'none' | 'outputRate' | 'fromLinkedRate'
export type ManualBoqResourceGroup = 'materials' | 'labour' | 'equipment'

export type ManualBoqItem = {
  id: string
  projectId: string
  floorId: string | null
  description: string
  unit: string
  quantity: number
  linkKind: ManualBoqLinkKind
  analysisCode: string | null
  resourceGroup: ManualBoqResourceGroup | null
  resourceCode: string | null
  labourMode: ManualBoqLabourMode
  outputPerDay: number | null
  gangDescription: string | null
  appliedUnitRate: number | null
  appliedAtRevision: string | null
  uniformatCode?: string | null
  createdAt?: string
  updatedAt?: string
}

export type ManualBoqInput = {
  floorId?: string | null
  description: string
  unit: string
  quantity: number
  linkKind?: ManualBoqLinkKind
  analysisCode?: string | null
  resourceGroup?: ManualBoqResourceGroup | null
  resourceCode?: string | null
  labourMode?: ManualBoqLabourMode
  outputPerDay?: number | null
  gangDescription?: string | null
  uniformatCode?: string | null
  /** Direct rate when linkKind is none (lump-sum Item lines). */
  unitRate?: number | null
}
