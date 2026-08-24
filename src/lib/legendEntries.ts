import type { Layer, MarkupObject, TakeoffItem } from '../types/models'

export const UNCATEGORIZED_LEGEND_ID = '__uncategorized__'
export const UNCATEGORIZED_LEGEND_COLOR = '#94a3b8'

export interface LegendEntry {
  id: string
  name: string
  color: string
  /** False when the layer is toggled off in the Layers panel. */
  visible: boolean
  sortOrder: number
}

/**
 * Layers (plus Uncategorized) that have at least one takeoff or markup
 * on this sheet — the basis of the on-canvas legend.
 */
export function buildSheetLegendEntries(input: {
  layers: Layer[]
  takeoffs: TakeoffItem[]
  markups: MarkupObject[]
  uncategorizedVisible: boolean
}): LegendEntry[] {
  const usedIds = new Set<string>()
  let usesUncategorized = false

  for (const item of input.takeoffs) {
    if (item.layerId == null) {
      usesUncategorized = true
    } else {
      usedIds.add(item.layerId)
    }
  }
  for (const item of input.markups) {
    if (item.layerId == null) {
      usesUncategorized = true
    } else {
      usedIds.add(item.layerId)
    }
  }

  const entries: LegendEntry[] = []

  if (usesUncategorized) {
    entries.push({
      id: UNCATEGORIZED_LEGEND_ID,
      name: 'Uncategorized',
      color: UNCATEGORIZED_LEGEND_COLOR,
      visible: input.uncategorizedVisible,
      sortOrder: -1,
    })
  }

  const sortedLayers = [...input.layers].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  )

  for (const layer of sortedLayers) {
    if (!usedIds.has(layer.id)) {
      continue
    }
    entries.push({
      id: layer.id,
      name: layer.name,
      color: layer.color,
      visible: layer.visible,
      sortOrder: layer.sortOrder,
    })
  }

  return entries
}
