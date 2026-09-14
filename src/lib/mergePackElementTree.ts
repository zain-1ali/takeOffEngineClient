import {
  ELEMENT_TREE,
  type ElementDef,
  type ElementModule,
} from '../constants/elementTree'
import type { BoqPackElementSummary, BoqPackSummary } from '../types/boqPack'

const HIDE_IF_UNBOUND = ['SKIRTING', 'PIPES', 'DUCT_FITTINGS']

function stockDefByKey(base: ElementModule[]): Map<string, ElementDef> {
  const map = new Map<string, ElementDef>()
  for (const m of base) {
    for (const e of m.elements) map.set(e.key, e)
  }
  return map
}

function ensureModule(
  byModule: Map<number, ElementModule>,
  moduleNo: number,
  title: string,
): ElementModule {
  let mod = byModule.get(moduleNo)
  if (!mod) {
    mod = { module: moduleNo, title, elements: [] }
    byModule.set(moduleNo, mod)
  }
  return mod
}

function findModuleForKey(
  byModule: Map<number, ElementModule>,
  key: string,
): ElementModule | undefined {
  for (const m of byModule.values()) {
    if (m.elements.some((e) => e.key === key)) return m
  }
  return undefined
}

function applyPackHeading(
  target: ElementDef,
  el: BoqPackElementSummary,
  engineKey: string,
): void {
  const hasEngine = Boolean(engineKey)
  target.label = el.label
  target.engineKey = engineKey || undefined
  target.catalogueOnly = !hasEngine
  target.packScope = el.scope
  target.implemented = true
}

function headingFromStock(
  el: BoqPackElementSummary,
  engineKey: string,
  stock: ElementDef | undefined,
): ElementDef {
  const hasEngine = Boolean(engineKey)
  const sameKeyStock = stock && stock.key === el.elementKey ? stock : undefined
  return {
    num: sameKeyStock?.num ?? el.moduleNo,
    key: el.elementKey,
    label: el.label,
    implemented: true,
    suffix: sameKeyStock?.suffix,
    code: sameKeyStock?.code,
    engineKey: engineKey || undefined,
    catalogueOnly: !hasEngine,
    packScope: el.scope,
  }
}

/**
 * Merge Issue Tracker headings into the stock element tree.
 * Pack heading identity wins; unused stock engines are hidden; 1:1 engines
 * are relabeled (and moved to the workbook module when it differs).
 */
export function mergePackIntoElementTree(
  pack: BoqPackSummary | null | undefined,
  elements: BoqPackElementSummary[] | undefined,
  base: ElementModule[] = ELEMENT_TREE,
): ElementModule[] {
  if (!elements?.length) return base

  const stockByKey = stockDefByKey(base)
  const boundEngines = new Set<string>()
  for (const el of elements) {
    const engine = (el.engineKey || '').trim()
    if (engine) boundEngines.add(engine)
    if (stockByKey.has(el.elementKey)) boundEngines.add(el.elementKey)
  }

  const byModule = new Map<number, ElementModule>()
  for (const m of base) {
    byModule.set(m.module, {
      module: m.module,
      title: m.title,
      elements: m.elements
        .filter((e) => {
          if (HIDE_IF_UNBOUND.includes(e.key) && !boundEngines.has(e.key)) {
            return false
          }
          return true
        })
        .map((e) => ({ ...e })),
    })
  }
  for (const pm of pack?.modules || []) {
    const mod = ensureModule(
      byModule,
      pm.moduleNo,
      pm.title || `Module ${pm.moduleNo}`,
    )
    if (pm.title) mod.title = pm.title
  }

  const seen = new Set<string>()
  for (const m of byModule.values()) {
    for (const e of m.elements) seen.add(e.key)
  }

  function removeKey(key: string) {
    for (const m of byModule.values()) {
      m.elements = m.elements.filter((e) => e.key !== key)
    }
    seen.delete(key)
  }

  for (const el of elements) {
    const engineKey = (el.engineKey || '').trim()
    const stock =
      stockByKey.get(el.elementKey) ||
      (engineKey ? stockByKey.get(engineKey) : undefined)
    const currentMod = findModuleForKey(byModule, el.elementKey)

    if (currentMod) {
      if (currentMod.module !== el.moduleNo) {
        removeKey(el.elementKey)
      } else {
        const target = currentMod.elements.find((e) => e.key === el.elementKey)
        if (target) applyPackHeading(target, el, engineKey)
        continue
      }
    }

    if (seen.has(el.elementKey)) continue
    seen.add(el.elementKey)
    const mod = ensureModule(
      byModule,
      el.moduleNo,
      pack?.modules?.find((m) => m.moduleNo === el.moduleNo)?.title ||
        `Module ${el.moduleNo}`,
    )
    mod.elements.push(headingFromStock(el, engineKey, stock))
  }

  return [...byModule.values()]
    .filter((m) => m.elements.length > 0)
    .sort((a, b) => a.module - b.module)
}
