import * as THREE from 'three'
import { makeBoxMesh } from './meshes'

export function buildDuctModel(f: {
  width?: number
  height?: number
  diameter?: number
  length?: number
  section?: string
}): THREE.Group {
  const group = new THREE.Group()
  const L = f.length || 1
  if ((f.section || 'Rectangular') === 'Round') {
    const d = f.diameter || 0.3
    group.add(makeBoxMesh(L, d, d, 0, 0x6a8a9c, 0.5))
  } else {
    group.add(
      makeBoxMesh(L, f.height || 0.3, f.width || 0.4, 0, 0x6a8a9c, 0.5),
    )
  }
  return group
}

export function buildPipeModel(f: {
  length?: number
  diameterMm?: number
}): THREE.Group {
  const group = new THREE.Group()
  const d = Math.max(0.02, (f.diameterMm || 50) / 1000)
  group.add(makeBoxMesh(f.length || 1, d, d, 0, 0x4a7a5c, 0.55))
  return group
}

export function buildElectricalModel(f: {
  shape?: string
  length?: number
  sizeMm?: number
}): THREE.Group {
  const group = new THREE.Group()
  const L = f.length || 1
  const s = Math.max(0.02, (f.sizeMm || 25) / 1000)
  const color =
    f.shape === 'TRAY' ? 0x8a7a4a : f.shape === 'CABLE' ? 0x3a3a3a : 0x5a5a7a
  group.add(makeBoxMesh(L, s, s * (f.shape === 'TRAY' ? 3 : 1), 0, color, 0.55))
  return group
}

export function buildDuctFittingModel(f: {
  width?: number
  height?: number
}): THREE.Group {
  const group = new THREE.Group()
  group.add(
    makeBoxMesh(f.width || 0.4, f.height || 0.3, 0.3, 0, 0x7a6a8c, 0.55),
  )
  return group
}
