import { api } from '../lib/api'
import type {
  AiSuggestion,
  AiSuggestionStatus,
  TakeoffItem,
} from '../types/models'

/** Fetch AI room suggestions for a sheet. */
export async function fetchAiSuggestions(
  sheetId: string,
  status?: AiSuggestionStatus,
): Promise<AiSuggestion[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return api<AiSuggestion[]>(`/api/sheets/${sheetId}/ai-suggestions${query}`)
}

export interface AcceptAiSuggestionEdits {
  label?: string
  dimensionA?: number | null
  dimensionB?: number | null
  calculatedArea?: number | null
  calculatedPerimeter?: number | null
}

export type AcceptAiSuggestionInput = AcceptAiSuggestionEdits & {
  confirmedX: number
  confirmedY: number
}

export interface AcceptAiSuggestionResult {
  suggestion: AiSuggestion
  item: TakeoffItem
}

/** Accept a suggestion into a data-only TakeoffItem (no canvas shape). */
export async function acceptAiSuggestion(
  suggestionId: string,
  input: AcceptAiSuggestionInput,
): Promise<AcceptAiSuggestionResult> {
  return api<AcceptAiSuggestionResult>(
    `/api/ai-suggestions/${suggestionId}/accept`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

/** Reject a pending suggestion (keeps the row). */
export async function rejectAiSuggestion(
  suggestionId: string,
): Promise<AiSuggestion> {
  const data = await api<{ suggestion: AiSuggestion }>(
    `/api/ai-suggestions/${suggestionId}/reject`,
    { method: 'POST' },
  )
  return data.suggestion
}

/** Restore a rejected suggestion back to PENDING. */
export async function restoreAiSuggestion(
  suggestionId: string,
): Promise<AiSuggestion> {
  const data = await api<{ suggestion: AiSuggestion }>(
    `/api/ai-suggestions/${suggestionId}/restore`,
    { method: 'POST' },
  )
  return data.suggestion
}
