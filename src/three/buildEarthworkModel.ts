import * as THREE from 'three'
import { COLORS3D } from './colors'
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
  return makeBoxMesh(
    f.length,
    f.depth,
    width,
    -f.depth,
    COLORS3D.ground,
    0.55,
  )
}
