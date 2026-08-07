/** Element tree — matches AgileQS-Takeoff.html ELEMENT_TREE (23 elements). */

export type ElementDef = {
  num: number
  key: string
  label: string
  implemented: boolean
  suffix?: string
}

export type ElementModule = {
  module: number
  title: string
  elements: ElementDef[]
}

export const ELEMENT_TREE: ElementModule[] = [
  {
    module: 1,
    title: 'Structural Elements',
    elements: [
      { num: 1, key: 'PAD_FOOTING', label: 'Pad Foundation', implemented: true },
      { num: 2, key: 'STRIP_FOOTING', label: 'Strip Foundation (RC)', implemented: true },
      { num: 2, key: 'STONE_STRIP', label: 'Stone Strip Foundation', implemented: true, suffix: 'a' },
      { num: 3, key: 'RAFT', label: 'Raft Foundation', implemented: true },
      { num: 4, key: 'PILE_CAP', label: 'Pile Cap', implemented: true },
      { num: 5, key: 'PILES', label: 'Piles', implemented: true },
      { num: 6, key: 'EARTHWORKS', label: 'Earthworks', implemented: true },
      { num: 7, key: 'COLUMNS', label: 'Columns', implemented: false },
      { num: 8, key: 'WALLS', label: 'Walls', implemented: true },
      { num: 9, key: 'BEAMS', label: 'Beams', implemented: false },
      { num: 10, key: 'SLABS', label: 'Slabs', implemented: false },
      { num: 11, key: 'STAIRS', label: 'Stairs', implemented: false },
      { num: 12, key: 'RAMPS', label: 'Ramps', implemented: false },
    ],
  },
  {
    module: 2,
    title: 'Architectural & Finishes',
    elements: [
      { num: 13, key: 'MASONRY', label: 'Masonry / Infill Walls', implemented: false },
      { num: 14, key: 'DOORS_WINDOWS', label: 'Doors & Windows', implemented: false },
      { num: 15, key: 'LINTELS', label: 'Lintels', implemented: false },
      { num: 16, key: 'FLOOR_FINISH', label: 'Floor Finishes', implemented: true },
      { num: 17, key: 'WALL_FINISH', label: 'Wall Finishes', implemented: true },
      { num: 18, key: 'CEILING_FINISH', label: 'Ceiling Finishes', implemented: true },
      { num: 19, key: 'SKIRTING', label: 'Skirting / Baseboards', implemented: false },
    ],
  },
  {
    module: 3,
    title: 'MEP Networks',
    elements: [
      { num: 20, key: 'DUCTS', label: 'Air Distribution Ducts', implemented: false },
      { num: 21, key: 'DUCT_FITTINGS', label: 'Duct Fittings & HVAC', implemented: false },
      { num: 22, key: 'PIPES', label: 'Pipes & Plumbing', implemented: false },
      { num: 23, key: 'ELECTRICAL', label: 'Conduits & Cable Trays', implemented: false },
    ],
  },
]

export const FLOW_STEPS = [
  { id: 'project', num: 1, label: 'Project' },
  { id: 'floors', num: 2, label: 'Floors' },
  { id: 'grid', num: 3, label: 'Axis Grid' },
  { id: 'model', num: 4, label: 'Model Elements' },
  { id: 'reports', num: 5, label: 'Reports' },
] as const

export type FlowStepId = (typeof FLOW_STEPS)[number]['id']

export function findElement(key: string): ElementDef | undefined {
  for (const mod of ELEMENT_TREE) {
    const el = mod.elements.find((e) => e.key === key)
    if (el) return el
  }
  return undefined
}

export function elementDisplayNum(el: ElementDef): string {
  return el.suffix ? `${el.num}${el.suffix}` : String(el.num)
}
