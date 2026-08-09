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
}
