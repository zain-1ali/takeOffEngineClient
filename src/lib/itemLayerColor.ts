import type { Layer } from '../types/models'

/** Neutral fallback when an item has no layer (ByLayer unassigned). */
export const UNASSIGNED_ITEM_COLOR = '#94a3b8'

export interface LayerColorItem {
  layerId: string | null
}

export interface ItemLayerColor {
  color: string
  unassigned: boolean
}

/**
 * ByLayer color: use the assigned layer's color, not the item's stored color field.
 */
export function getColorForItem(
  item: LayerColorItem,
  layers: Layer[],
): ItemLayerColor {
  if (item.layerId == null) {
    return { color: UNASSIGNED_ITEM_COLOR, unassigned: true }
  }
  const layer = layers.find((row) => row.id === item.layerId)
  if (!layer || !layer.color.trim()) {
    return { color: UNASSIGNED_ITEM_COLOR, unassigned: true }
  }
  return { color: layer.color.trim(), unassigned: false }
}
