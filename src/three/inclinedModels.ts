import * as THREE from 'three'
import { COLORS3D } from './colors'

function concreteMaterial(opacity = 0.45) {
  return new THREE.MeshLambertMaterial({
    color: COLORS3D.concrete,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
  })
}

function meshWithEdges(geometry: THREE.BufferGeometry): THREE.Group {
  geometry.computeVertexNormals()
  const group = new THREE.Group()
  group.add(new THREE.Mesh(geometry, concreteMaterial()))
  group.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: COLORS3D.wire }),
    ),
  )
  return group
}

export function makeInclinedSlab(
  horizontalRun: number,
  rise: number,
  width: number,
  thickness: number,
): THREE.Group {
  const length = Math.hypot(horizontalRun, rise)
  const geometry = new THREE.BoxGeometry(length, thickness, width)
  const group = meshWithEdges(geometry)
  group.rotation.z = Math.atan2(rise, horizontalRun)
  group.position.y = rise / 2
  return group
}

export function makeStepTriangles(
  run: number,
  rise: number,
  width: number,
  stepCount: number,
  waistThickness: number,
): THREE.Group {
  const group = new THREE.Group()
  const count = Math.max(1, stepCount)
  const tread = run / count
  const riser = rise / count
  const slope = rise / (run || 1)
  for (let i = 0; i < count; i++) {
    const x0 = -run / 2 + i * tread
    const y0 = i * riser + waistThickness
    const z0 = -width / 2
    const z1 = width / 2
    const vertices = [
      x0, y0, z0, x0, y0 + riser, z0,
      x0 + tread, y0 + riser, z0,
      x0, y0, z1, x0, y0 + riser, z1,
      x0 + tread, y0 + riser, z1,
    ]
    const indices = [
      0, 1, 2, 3, 5, 4,
      0, 3, 4, 0, 4, 1,
      1, 4, 5, 1, 5, 2,
      2, 5, 3, 2, 3, 0,
    ]
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3),
    )
    geometry.setIndex(indices)
    const wedge = meshWithEdges(geometry)
    // Keep the tread triangles seated on the inclined waist.
    wedge.position.y = slope * (x0 + run / 2) - i * riser
    group.add(wedge)
  }
  return group
}

/**
 * Visual helical ribbon used by spiral stairs and helical ramps. It mirrors
 * the estimating engine's average-radius path but keeps the full annular
 * width so the model remains recognisably curved.
 */
export function makeHelicalRibbon(
  innerRadius: number,
  width: number,
  angleDeg: number,
  rise: number,
  thickness: number,
): THREE.Group {
  const segments = Math.max(8, Math.ceil(Math.abs(angleDeg) / 10))
  const angle = (angleDeg * Math.PI) / 180
  const vertices: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= segments; i++) {
    const ratio = i / segments
    const theta = ratio * angle
    const y = ratio * rise
    const cos = Math.cos(theta)
    const sin = Math.sin(theta)
    vertices.push(
      innerRadius * cos, y, innerRadius * sin,
      (innerRadius + width) * cos, y, (innerRadius + width) * sin,
      innerRadius * cos, y - thickness, innerRadius * sin,
      (innerRadius + width) * cos, y - thickness, (innerRadius + width) * sin,
    )
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 4
    const b = (i + 1) * 4
    indices.push(
      a, a + 1, b + 1, a, b + 1, b,
      a + 2, b + 3, a + 3, a + 2, b + 2, b + 3,
      a, b, b + 2, a, b + 2, a + 2,
      a + 1, a + 3, b + 3, a + 1, b + 3, b + 1,
    )
  }
  const last = segments * 4
  indices.push(
    0, 2, 3, 0, 3, 1,
    last, last + 1, last + 3, last, last + 3, last + 2,
  )
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3),
  )
  geometry.setIndex(indices)
  return meshWithEdges(geometry)
}
