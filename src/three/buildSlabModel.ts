import * as THREE from 'three'
import { COLORS3D } from './colors'
import { barCountForSpan } from './math'
import { addPlanDims } from './dimensions'
import { makeBoxMesh, makeRebarBar } from './meshes'
import { modelViewOptions } from './viewOptions'

export type SlabInstance = {
  shape: 'FLAT' | 'SLOPED' | 'WAFFLE' | 'DROP_PANEL' | string
  length: number
  width: number
  thickness?: number
  startThickness?: number
  endThickness?: number
  flangeThickness?: number
  ribSpacing?: number
  ribWidth?: number
  ribDepth?: number
  dropLength?: number
  dropWidth?: number
  extraDropDepth?: number
  cover: number
  bottomMainDia: number
  bottomMainSpacing: number
  bottomDistDia: number
  bottomDistSpacing: number
  ribBarsPerRib: number
}

function evenlySpaced(count: number, extent: number): number[] {
  return Array.from(
    { length: count },
    (_, index) => -extent / 2 + (index * extent) / (count - 1 || 1),
  )
}

function waffleCount(span: number, spacing: number): number {
  return Math.floor(span / (spacing || 1)) + 1
}

function makeSlopedConcrete(f: SlabInstance): THREE.Group {
  const start = f.startThickness || 0
  const end = f.endThickness || 0
  const top = Math.max(start, end)
  const x0 = -f.length / 2
  const x1 = f.length / 2
  const z0 = -f.width / 2
  const z1 = f.width / 2
  const vertices = [
    x0, top - start, z0, x0, top - start, z1,
    x1, top - end, z0, x1, top - end, z1,
    x0, top, z0, x0, top, z1, x1, top, z0, x1, top, z1,
  ]
  const indices = [
    0, 2, 3, 0, 3, 1,
    4, 5, 7, 4, 7, 6,
    0, 4, 6, 0, 6, 2,
    1, 3, 7, 1, 7, 5,
    0, 1, 5, 0, 5, 4,
    2, 6, 7, 2, 7, 3,
  ]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({
      color: COLORS3D.concrete,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    }),
  )
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color: COLORS3D.wire }),
  )
  const group = new THREE.Group()
  group.add(mesh, edges)
  return group
}

function addWaffleConcrete(group: THREE.Group, f: SlabInstance) {
  const flange = f.flangeThickness || 0
  const ribDepth = f.ribDepth || 0
  const ribWidth = f.ribWidth || 0
  const spacing = f.ribSpacing || 1
  const nX = waffleCount(f.width, spacing)
  const nY = waffleCount(f.length, spacing)

  group.add(
    makeBoxMesh(
      f.length,
      flange,
      f.width,
      ribDepth,
      COLORS3D.concrete,
      0.45,
    ),
  )

  const material = new THREE.MeshLambertMaterial({
    color: COLORS3D.concrete,
    transparent: true,
    opacity: 0.5,
  })
  const matrix = new THREE.Matrix4()
  const ribsX = new THREE.InstancedMesh(
    new THREE.BoxGeometry(f.length, ribDepth, ribWidth),
    material,
    nX,
  )
  evenlySpaced(nX, Math.max(0, f.width - ribWidth)).forEach((z, index) => {
    matrix.makeTranslation(0, ribDepth / 2, z)
    ribsX.setMatrixAt(index, matrix)
  })
  ribsX.instanceMatrix.needsUpdate = true
  group.add(ribsX)

  const ribsY = new THREE.InstancedMesh(
    new THREE.BoxGeometry(ribWidth, ribDepth, f.width),
    material.clone(),
    nY,
  )
  evenlySpaced(nY, Math.max(0, f.length - ribWidth)).forEach((x, index) => {
    matrix.makeTranslation(x, ribDepth / 2, 0)
    ribsY.setMatrixAt(index, matrix)
  })
  ribsY.instanceMatrix.needsUpdate = true
  group.add(ribsY)
}

function addMesh(
  group: THREE.Group,
  f: SlabInstance,
  length: number,
  width: number,
  y: number,
) {
  const cover = f.cover / 1000
  const halfL = Math.max(0, length / 2 - cover)
  const halfW = Math.max(0, width / 2 - cover)
  const mainCount = barCountForSpan(width - 2 * cover, f.bottomMainSpacing)
  evenlySpaced(mainCount, 2 * halfW).forEach((z) => {
    const bar = makeRebarBar(
      -halfL, y, z, halfL, y, z, f.bottomMainDia,
    )
    if (bar) group.add(bar)
  })
  const distCount = barCountForSpan(length - 2 * cover, f.bottomDistSpacing)
  evenlySpaced(distCount, 2 * halfL).forEach((x) => {
    const bar = makeRebarBar(
      x, y + 0.02, -halfW, x, y + 0.02, halfW, f.bottomDistDia,
    )
    if (bar) group.add(bar)
  })
}

function addWaffleBars(group: THREE.Group, f: SlabInstance) {
  const spacing = f.ribSpacing || 1
  const ribWidth = f.ribWidth || 0
  const cover = f.cover / 1000
  const nX = waffleCount(f.width, spacing)
  const nY = waffleCount(f.length, spacing)
  const bars = Math.max(1, f.ribBarsPerRib)
  const localOffsets = evenlySpaced(
    bars,
    Math.max(0, ribWidth - 2 * cover),
  )
  evenlySpaced(nX, Math.max(0, f.width - ribWidth)).forEach((z) => {
    localOffsets.forEach((offset) => {
      const bar = makeRebarBar(
        -f.length / 2 + cover, cover, z + offset,
        f.length / 2 - cover, cover, z + offset,
        f.bottomMainDia,
      )
      if (bar) group.add(bar)
    })
  })
  evenlySpaced(nY, Math.max(0, f.length - ribWidth)).forEach((x) => {
    localOffsets.forEach((offset) => {
      const bar = makeRebarBar(
        x + offset, cover + 0.02, -f.width / 2 + cover,
        x + offset, cover + 0.02, f.width / 2 - cover,
        f.bottomDistDia,
      )
      if (bar) group.add(bar)
    })
  })
}

export function buildSlabModel(f: SlabInstance): THREE.Group {
  const group = new THREE.Group()
  let baseOffset = 0
  let top = f.thickness || 0

  if (f.shape === 'WAFFLE') {
    addWaffleConcrete(group, f)
    top = (f.ribDepth || 0) + (f.flangeThickness || 0)
  } else if (f.shape === 'SLOPED') {
    group.add(makeSlopedConcrete(f))
    top = Math.max(f.startThickness || 0, f.endThickness || 0)
  } else if (f.shape === 'DROP_PANEL') {
    baseOffset = f.extraDropDepth || 0
    group.add(
      makeBoxMesh(
        f.length,
        f.thickness || 0,
        f.width,
        baseOffset,
        COLORS3D.concrete,
        0.45,
      ),
    )
    group.add(
      makeBoxMesh(
        f.dropLength || 0,
        baseOffset,
        f.dropWidth || 0,
        0,
        COLORS3D.concrete,
        0.5,
      ),
    )
    top = baseOffset + (f.thickness || 0)
  } else {
    group.add(
      makeBoxMesh(
        f.length,
        f.thickness || 0,
        f.width,
        0,
        COLORS3D.concrete,
        0.45,
      ),
    )
  }

  if (modelViewOptions.showRebar) {
    const cover = f.cover / 1000
    if (f.shape === 'WAFFLE') {
      addWaffleBars(group, f)
    } else {
      addMesh(group, f, f.length, f.width, baseOffset + cover)
      if (f.shape === 'DROP_PANEL') {
        addMesh(
          group,
          f,
          f.dropLength || 0,
          f.dropWidth || 0,
          top - cover,
        )
      }
    }
  }

  addPlanDims(group, f.length, f.width)
  return group
}
