import * as THREE from 'three'
import { COLORS3D } from './colors'
import { barCountForSpan } from './math'
import { makeBoxMesh, makeRebarBar } from './meshes'
import { modelViewOptions } from './viewOptions'

export type RaftInstance = {
  shape: 'MONOLITHIC' | 'THICKENED_EDGE' | string
  length: number
  width: number
  thickness: number
  edgeWidth?: number
  edgeExtraDepth?: number
  cover: number
  bottomMainDia: number
  bottomMainSpacing: number
  bottomDistDia: number
  bottomDistSpacing: number
}

function addMesh(
  group: THREE.Group,
  f: RaftInstance,
  y: number,
) {
  const cover = f.cover / 1000
  const halfL = f.length / 2 - cover
  const halfW = f.width / 2 - cover
  const mainCount = barCountForSpan(f.width - 2 * cover, f.bottomMainSpacing)
  for (let i = 0; i < mainCount; i++) {
    const z = -halfW + (i * 2 * halfW) / (mainCount - 1 || 1)
    const bar = makeRebarBar(
      -halfL,
      y,
      z,
      halfL,
      y,
      z,
      f.bottomMainDia,
    )
    if (bar) group.add(bar)
  }
  const distCount = barCountForSpan(f.length - 2 * cover, f.bottomDistSpacing)
  for (let i = 0; i < distCount; i++) {
    const x = -halfL + (i * 2 * halfL) / (distCount - 1 || 1)
    const bar = makeRebarBar(
      x,
      y + 0.02,
      -halfW,
      x,
      y + 0.02,
      halfW,
      f.bottomDistDia,
    )
    if (bar) group.add(bar)
  }
}

export function buildRaftModel(f: RaftInstance): THREE.Group {
  const group = new THREE.Group()
  const extraDepth =
    f.shape === 'THICKENED_EDGE' ? f.edgeExtraDepth || 0 : 0
  const edgeWidth = f.shape === 'THICKENED_EDGE' ? f.edgeWidth || 0 : 0

  group.add(
    makeBoxMesh(
      f.length,
      f.thickness,
      f.width,
      extraDepth,
      COLORS3D.concrete,
      0.45,
    ),
  )

  if (extraDepth > 0 && edgeWidth > 0) {
    const innerLength = Math.max(0, f.length - 2 * edgeWidth)
    const innerWidth = Math.max(0, f.width - 2 * edgeWidth)
    const front = makeBoxMesh(
      f.length,
      extraDepth,
      edgeWidth,
      0,
      COLORS3D.concrete,
      0.5,
    )
    front.position.z = (f.width - edgeWidth) / 2
    group.add(front)
    const back = front.clone()
    back.position.z = -(f.width - edgeWidth) / 2
    group.add(back)
    if (innerWidth > 0) {
      const left = makeBoxMesh(
        edgeWidth,
        extraDepth,
        innerWidth,
        0,
        COLORS3D.concrete,
        0.5,
      )
      left.position.x = (f.length - edgeWidth) / 2
      group.add(left)
      const right = left.clone()
      right.position.x = -(f.length - edgeWidth) / 2
      group.add(right)
    } else if (innerLength <= 0) {
      group.add(
        makeBoxMesh(
          f.length,
          extraDepth,
          f.width,
          0,
          COLORS3D.concrete,
          0.5,
        ),
      )
    }
  }

  if (modelViewOptions.showRebar) {
    const cover = f.cover / 1000
    addMesh(group, f, extraDepth + cover)
    addMesh(group, f, extraDepth + f.thickness - cover)
  }

  if (modelViewOptions.showDims) {
    const y = -0.05
    const material = new THREE.LineBasicMaterial({ color: COLORS3D.wire })
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-f.length / 2, y, f.width / 2 + 0.2),
      new THREE.Vector3(f.length / 2, y, f.width / 2 + 0.2),
    ])
    group.add(new THREE.Line(geometry, material))
  }

  return group
}
