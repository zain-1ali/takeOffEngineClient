import * as THREE from 'three'
import { COLORS3D } from './colors'
import { addHeightDim, addPlanDims } from './dimensions'
import { makeBoxMesh } from './meshes'

export type EarthworkInstance = {
  shape: 'ISOLATED_PIT' | 'LINEAR_TRENCH' | 'BULK_BASIN' | string
  length: number
  width?: number
  trenchWidth?: number
  depth: number
}

export function buildEarthworkModel(f: EarthworkInstance): THREE.Group {
  const width =
    f.shape === 'LINEAR_TRENCH' ? f.trenchWidth || 0 : f.width || 0
  const group = makeBoxMesh(
    f.length,
    f.depth,
    width,
    -f.depth,
    COLORS3D.ground,
    0.55,
  )
  addPlanDims(group, f.length, width, { y: -f.depth - 0.05 })
  addHeightDim(
    group,
    f.depth,
    { x: f.length / 2, z: width / 2 },
    { y0: -f.depth },
  )
  return group
}
