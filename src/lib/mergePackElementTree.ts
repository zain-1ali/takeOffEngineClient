import {
  ELEMENT_TREE,
  type ElementModule,
} from '../constants/elementTree'
import type { BoqPackElementSummary, BoqPackSummary } from '../types/boqPack'

export function mergePackIntoElementTree(
  pack: BoqPackSummary | null | undefined,
  elements: BoqPackElementSummary[] | undefined,
  base: ElementModule[] = ELEMENT_TREE,
): ElementModule[] {
  if (!elements?.length) return base

  const byModule = new Map()
  for (const m of base) {
    byModule.set(m.module, {
      module: m.module,
      title: m.title,
      elements: [...m.elements],
    })
  }
  for (const pm of pack?.modules || []) {
    if (!byModule.has(pm.moduleNo)) {
      byModule.set(pm.moduleNo, {
        module: pm.moduleNo,
        title: pm.title || `Module ${pm.moduleNo}`,
        elements: [],
      })
    }
  }

  const seen = new Map()
  for (const m of byModule.values()) {
    for (const e of m.elements) seen.set(e.key, true)
  }

  for (const el of elements) {
    if (el.bindingKind !== 'CATALOGUE') continue
    if (seen.get(el.elementKey)) continue
    seen.set(el.elementKey, true)
    let mod = byModule.get(el.moduleNo)
    if (!mod) {
      mod = {
        module: el.moduleNo,
        title: `Module ${el.moduleNo}`,
        elements: [],
      }
      byModule.set(el.moduleNo, mod)
    }
    mod.elements.push({
      num: el.moduleNo,
      key: el.elementKey,
      label: el.label,
      implemented: true,
      catalogueOnly: true,
      packScope: el.scope,
    })
  }

  return [...byModule.values()].sort((a, b) => a.module - b.module)
}
