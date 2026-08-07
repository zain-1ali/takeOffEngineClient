/**
 * Dispatch Instance API docs → Step 4 build*Model builders.
 * Flattens geometry + reinforcement the same way the calculate service does.
 */
import * as THREE from 'three'
import type { Instance } from '../types/api'
import { ELEMENT_ENGINES } from '../elementEngines'
import { materials3D } from './viewOptions'

export function flattenInstanceFor3D(inst: Instance): Record<string, unknown> {
  return {
    shape: inst.shape,
    mark: inst.mark,
    count: inst.count,
    ...(inst.geometry || {}),
    ...(inst.reinforcement || {}),
    ...(inst.concreteGrade != null ? { concreteGrade: inst.concreteGrade } : {}),
    ...(inst.spec != null ? { spec: inst.spec } : {}),
  }
}

export function buildModelForInstance(
  elementKey: string,
  inst: Instance,
  blindingThickness = 0.05,
): THREE.Group {
  materials3D.blindingThickness = blindingThickness
  const flat = flattenInstanceFor3D(inst) as any
  return ELEMENT_ENGINES[elementKey]?.build3D(flat) ?? new THREE.Group()
}

/** Largest plan/height dimension for framing the camera (mirrors prototype). */
export function planDimForInstance(inst: Instance): number {
  const g = inst.geometry || {}
  const nums = [
    Number(g.length) || 0,
    Number(g.width) || 0,
    Number(g.baseWidth) || 0,
    Number(g.height) || 0,
    Number(g.baseThickness) || 0,
    Number(g.thickness) || 0,
    Number(g.triangleBase) || 0,
    Number(g.triangleHeight) || 0,
    (Number(g.hexSide) || 0) * 2,
    Number(g.pileLength) || 0,
    Number(g.diameter) || 0,
    Number(g.side) || 0,
    Number(g.sectionDepth) || 0,
    Number(g.flangeWidth) || 0,
    Number(g.trenchWidth) || 0,
    Number(g.depth) || 0,
    Number(g.wallLength) || 0,
    Number(g.wallHeight) || 0,
    Number(g.roomLength) || 0,
    Number(g.roomWidth) || 0,
    Number(g.radius) || 0,
  ]
  return Math.max(1, ...nums)
}

export function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const mat = mesh.material
    if (mat) {
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
    }
  })
}
