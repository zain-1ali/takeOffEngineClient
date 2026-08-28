/**
 * Element tree — derived from the Element Register master list.
 * @see ./elementRegister.ts
 */

import {
  ELEMENT_MODULE_TITLES,
  ELEMENT_REGISTER,
  type ElementModuleId,
  type ElementRegisterEntry,
} from './elementRegister'

export type ElementDef = {
  num: number
  key: string
  label: string
  implemented: boolean
  suffix?: string
  code?: string
}

export type ElementModule = {
  module: number
  title: string
  elements: ElementDef[]
}

function toDef(e: ElementRegisterEntry): ElementDef {
  return {
    num: e.num,
    key: e.key,
    label: e.label,
    implemented: e.implemented,
    ...(e.suffix ? { suffix: e.suffix } : {}),
    code: e.code,
  }
}

export const ELEMENT_TREE: ElementModule[] = (
  [1, 2, 3] as ElementModuleId[]
).map((module) => ({
  module,
  title: ELEMENT_MODULE_TITLES[module],
  elements: ELEMENT_REGISTER.filter((e) => e.module === module).map(toDef),
}))

export const FLOW_STEPS = [
  { id: 'project', num: 1, label: 'Project' },
  { id: 'floors', num: 2, label: 'Floors' },
  { id: 'drawings', num: 3, label: 'Drawings' },
  { id: 'grid', num: 4, label: 'Axis Grid' },
  { id: 'model', num: 5, label: 'Model Elements' },
  { id: 'register', num: 6, label: 'Element Register' },
  { id: 'reports', num: 7, label: 'Reports' },
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
  if (el.code) return el.code
  return el.suffix ? `${el.num}${el.suffix}` : String(el.num)
}
