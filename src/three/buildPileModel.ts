import * as THREE from 'three'
import { COLORS3D } from './colors'
import { barCountForSpan } from './math'
import { addHeightDim, addPlanDims } from './dimensions'
import { makeBoxMesh, makePrismMesh, makeRebarBar } from './meshes'
import { modelViewOptions } from './viewOptions'

export type PileInstance = {
  shape: 'CIRCULAR_BORED' | 'SQUARE_DRIVEN' | 'H_SECTION' | string
  pileLength: number
  diameter?: number
  side?: number
  sectionDepth?: number
  flangeWidth?: number
  flangeThickness?: number
  webThickness?: number
  sectionKgPerM?: number
  cover: number
  longBarCount: number
  longBarDia: number
  linkDia: number
  linkSpacing: number
}

function concreteModel(f: PileInstance): {
  group: THREE.Group
  width: number
  depth: number
} {
  if (f.shape === 'CIRCULAR_BORED') {
    const diameter = f.diameter || 0
    const geometry = new THREE.CylinderGeometry(
      diameter / 2,
      diameter / 2,
      f.pileLength,
      32,
    )
    const material = new THREE.MeshLambertMaterial({
      color: COLORS3D.concrete,
      transparent: true,
      opacity: 0.45,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.y = f.pileLength / 2
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: COLORS3D.wire }),
    )
    edges.position.copy(mesh.position)
    const group = new THREE.Group()
    group.add(mesh, edges)
    return { group, width: diameter, depth: diameter }
  }
  if (f.shape === 'H_SECTION') {
    const h = f.sectionDepth || 0
    const b = f.flangeWidth || 0
    const tf = f.flangeThickness || 0
    const tw = f.webThickness || 0
    const points: [number, number][] = [
      [-b / 2, -h / 2],
      [b / 2, -h / 2],
      [b / 2, -h / 2 + tf],
      [tw / 2, -h / 2 + tf],
      [tw / 2, h / 2 - tf],
      [b / 2, h / 2 - tf],
      [b / 2, h / 2],
      [-b / 2, h / 2],
      [-b / 2, h / 2 - tf],
      [-tw / 2, h / 2 - tf],
      [-tw / 2, -h / 2 + tf],
      [-b / 2, -h / 2 + tf],
    ]
    return {
      group: makePrismMesh(
        points,
        f.pileLength,
        0,
        COLORS3D.rebar,
        0.75,
      ),
      width: b,
      depth: h,
    }
  }
  const side = f.side || 0
  return {
    group: makeBoxMesh(
      side,
      f.pileLength,
      side,
      0,
      COLORS3D.concrete,
      0.45,
    ),
    width: side,
    depth: side,
  }
}

export function buildPileModel(f: PileInstance): THREE.Group {
  const result = concreteModel(f)
  const group = result.group

  // H-section piles are structural steel only — no RC cage.
  if (modelViewOptions.showRebar && f.shape !== 'H_SECTION') {
    const cover = f.cover / 1000
    const radiusX = Math.max(0.02, result.width / 2 - cover)
    const radiusZ = Math.max(0.02, result.depth / 2 - cover)
    for (let i = 0; i < f.longBarCount; i++) {
      const angle = (i * Math.PI * 2) / Math.max(1, f.longBarCount)
      const x = Math.cos(angle) * radiusX
      const z = Math.sin(angle) * radiusZ
      const bar = makeRebarBar(
        x,
        cover,
        z,
        x,
        f.pileLength - cover,
        z,
        f.longBarDia,
      )
      if (bar) group.add(bar)
    }

    const linkCount = barCountForSpan(f.pileLength, f.linkSpacing)
    for (let i = 0; i < linkCount; i++) {
      const geometry = new THREE.TorusGeometry(
        Math.min(radiusX, radiusZ),
        Math.max(0.006, (f.linkDia / 1000) * 1.5),
        6,
        24,
      )
      const material = new THREE.MeshLambertMaterial({ color: COLORS3D.rebar })
      const ring = new THREE.Mesh(geometry, material)
      ring.rotation.x = Math.PI / 2
      const usable = Math.max(0, f.pileLength - 2 * cover)
      ring.position.y =
        cover + (linkCount <= 1 ? usable / 2 : (i * usable) / (linkCount - 1))
      group.add(ring)
    }
  }

  addPlanDims(group, result.width, result.depth)
  addHeightDim(group, f.pileLength, {
    x: result.width / 2,
    z: result.depth / 2,
  })
  return group
}
