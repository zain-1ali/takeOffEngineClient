export type IfcSuggestionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'
export type IfcImportJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'COMMITTED'
export type IfcWallConfidence = 'HIGH' | 'MEDIUM' | 'LOW'
export type IfcSuggestionConfidence = 'HIGH' | 'MEDIUM' | 'LOW'
export type IfcSuggestionEntityType = 'IfcWall' | 'IfcSlab'
export type IfcFloorMatchStatus =
  | 'MATCHED_NAME'
  | 'MATCHED_ELEVATION'
  | 'AMBIGUOUS'
  | 'UNMATCHED'
  | 'NO_STOREY'
  | 'MANUAL'

export type IfcSourceStorey = {
  expressId: number
  globalId: string | null
  name: string | null
  elevationM: number | null
}

export type IfcMappedInstanceData = {
  elementKey: 'WALLS' | 'SLABS' | null
  shape: string | null
  mark: string | null
  geometry: Record<string, number> | null
}

/** First-class review row (IfcSuggestion collection). */
export type IfcSuggestion = {
  id: string
  projectId: string
  jobId: string
  sourceGlobalId: string
  expressId: number
  entityType: IfcSuggestionEntityType
  name: string | null
  floorId: string | null
  sourceStorey: IfcSourceStorey | null
  floorMatchStatus: IfcFloorMatchStatus
  floorMatchNote: string
  mappedInstanceData: IfcMappedInstanceData | null
  confidence: IfcSuggestionConfidence
  confidenceNotes: string[]
  needsManualModeling: boolean
  skipReason: string | null
  status: IfcSuggestionStatus
  acceptedInstanceId: string | null
  createdAt: string
  updatedAt: string
}

/** Legacy embedded wall row on IfcImportJob (kept for older clients). */
export type IfcWallSuggestion = {
  id: string
  sourceGlobalId: string
  expressId: number
  elementKey: 'WALLS'
  name: string | null
  floorId: string | null
  sourceStorey: IfcSourceStorey | null
  floorMatchStatus: IfcFloorMatchStatus
  floorMatchNote: string
  mark: string | null
  shape: 'LINEAR' | 'CURVED' | null
  geometry: {
    length?: number
    radius?: number
    arcAngleDeg?: number
    thickness: number
    height: number
  } | null
  confidence: IfcWallConfidence
  confidenceNotes: string[]
  needsManualReview: boolean
  status: IfcSuggestionStatus
}

export type IfcImportJob = {
  id: string
  projectId: string
  fileName: string
  status: IfcImportJobStatus
  error: string | null
  summary: {
    walls: number
    slabs: number
    geometryOk: number
    skipped: number
  }
  suggestions: IfcWallSuggestion[]
  committedAt: string | null
  createdAt: string
  updatedAt: string
}
