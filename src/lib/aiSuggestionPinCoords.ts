import type { AiSuggestion } from '../types/models'
import type { ImagePoint } from './measurementMath'

/** Human-confirmed pin location (source-image pixels). */
export function confirmedSuggestionImagePoint(
  suggestion: Pick<AiSuggestion, 'confirmedX' | 'confirmedY'>,
): ImagePoint | null {
  if (
    suggestion.confirmedX == null ||
    suggestion.confirmedY == null ||
    !Number.isFinite(suggestion.confirmedX) ||
    !Number.isFinite(suggestion.confirmedY)
  ) {
    return null
  }
  return {
    x: suggestion.confirmedX,
    y: suggestion.confirmedY,
  }
}

/**
 * Pins only after a human placed the room on Accept (confirmedX/Y).
 * REJECTED and PENDING without confirmation are omitted.
 */
export function aiSuggestionsForPins(
  suggestions: AiSuggestion[],
): Array<AiSuggestion & { imagePoint: ImagePoint }> {
  return suggestions.flatMap((suggestion) => {
    if (suggestion.status === 'REJECTED') {
      return []
    }
    const imagePoint = confirmedSuggestionImagePoint(suggestion)
    if (!imagePoint) {
      return []
    }
    return [{ ...suggestion, imagePoint }]
  })
}
