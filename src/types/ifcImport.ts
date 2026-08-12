export type IfcSuggestionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'
export type IfcImportJobStatus = 'SUCCEEDED' | 'FAILED' | 'COMMITTED'
export type IfcWallConfidence = 'HIGH' | 'MEDIUM' | 'LOW'

export type IfcWallSuggestion = {
  id: string
  sourceGlobalId: string
  expressId: number
  elementKey: 'WALLS'
  name: string | null
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
