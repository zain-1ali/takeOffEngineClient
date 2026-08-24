import type { Layer } from '../types/models'

/** Sentinel for the UI-only Uncategorized bucket (null layerId). */
export const UNCATEGORIZED_LAYER_ID = null

export function isObjectOnVisibleLayer(
  layerId: string | null | undefined,
  layers: readonly Layer[],
  uncategorizedVisible: boolean,
): boolean {
  if (layerId == null) {
    return uncategorizedVisible
  }
  const layer = layers.find((row) => row.id === layerId)
  // Deleted / unknown layer → treat as uncategorized visibility.
  if (!layer) {
    return uncategorizedVisible
  }
  return layer.visible
}
