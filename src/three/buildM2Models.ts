import * as THREE from 'three'
import { makeBoxMesh } from './meshes'

/** Thin skirting strip along room plan. */
export function buildSkirtingModel(f: {
  roomLength?: number
  roomWidth?: number
  perimeter?: number
}): THREE.Group {
  const group = new THREE.Group()
  const L = f.roomLength || 1
  const W = f.roomWidth || 1
  const h = 0.1
  const t = 0.02
  // Four runs as thin boxes on the floor plane
  group.add(makeBoxMesh(L, h, t, 0, 0x6b5a45, 0.7))
  const side = makeBoxMesh(t, h, W, 0, 0x6b5a45, 0.7)
  side.position.x = L / 2
  group.add(side)
  return group
}

export function buildMasonryModel(f: {
  wallLength?: number
  wallHeight?: number
  thickness?: number
}): THREE.Group {
  const group = new THREE.Group()
  group.add(
    makeBoxMesh(
      f.wallLength || 1,
      f.wallHeight || 1,
      f.thickness || 0.2,
      0,
      0x8a7355,
      0.65,
    ),
  )
  return group
}

export function buildDoorsWindowsModel(f: {
  width?: number
  height?: number
}): THREE.Group {
  const group = new THREE.Group()
  group.add(
    makeBoxMesh(f.width || 0.9, f.height || 2.1, 0.05, 0, 0x4a6a8c, 0.55),
  )
  return group
}

export function buildLintelModel(f: {
  clearSpan?: number
  bearingEach?: number
  length?: number
  width?: number
  depth?: number
}): THREE.Group {
  const group = new THREE.Group()
  const bearing = f.bearingEach != null ? f.bearingEach : 0.15
  const len =
    f.length != null && Number(f.length) > 0
      ? Number(f.length)
      : (f.clearSpan || 1) + 2 * bearing
  group.add(
    makeBoxMesh(len, f.depth || 0.15, f.width || 0.2, 0, 0x7a7a7a, 0.7),
  )
  return group
}
