export type RateSuggestionCategory = 'materials' | 'labour' | 'equipment'
export type RateSuggestionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'
export type RatePdfJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'COMMITTED'

export type RatePdfSuggestion = {
  id: string
  category: RateSuggestionCategory
  name: string
  unit: string
  unitCost: number
  confidence: number
  status: RateSuggestionStatus
}

export type RatePdfImportJob = {
  id: string
  projectId: string
  fileName: string
  status: RatePdfJobStatus
  error: string | null
  suggestions: RatePdfSuggestion[]
  committedAt: string | null
  createdAt?: string
  updatedAt?: string
}
