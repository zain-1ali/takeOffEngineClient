import * as THREE from 'three'
import { COLORS3D } from './colors'
import { barCountForSpan } from './math'
import { addPlanDims } from './dimensions'
import { makeBoxMesh, makeRebarBar } from './meshes'
import { modelViewOptions } from './viewOptions'

export type BeamBarGroup = {
  diameterMm: number
  barCount: number
}

export type BeamInstance = {
  shape: 'RECTANGULAR' | 'T_SECTION' | 'L_SECTION' | 'CANTILEVER_TAPERED' | 'GROUND_TIE' | string
  spanLength: number
  width?: number
  depth?: number
  flangeWidth?: number
  flangeThickness?: number
  webWidth?: number
  overallDepth?: number
  supportDepth?: number
  tipDepth?: number
  cover: number
  topBars?: BeamBarGroup[]
  bottomBars?: BeamBarGroup[]
  topBarCount?: number
  topBarDia?: number
  bottomBarCount?: number
  bottomBarDia?: number
  linkDia: number
  linkSpacing: number
}

function resolveBarGroups(
  groups: BeamBarGroup[] | undefined,
  legacyCount: number | undefined,
  legacyDia: number | undefined,
): BeamBarGroup[] {
  if (Array.isArray(groups) && groups.length > 0) {
    return groups.filter((g) => g.barCount > 0 && g.diameterMm > 0)
  }
  const dia = legacyDia || 0
  const count = legacyCount || 0
  if (dia > 0 && count > 0) return [{ diameterMm: dia, barCount: count }]
  return []
}

function taperedConcrete(f: BeamInstance): THREE.Group {
  const span = f.spanLength
  const width = f.width || 0
  const supportDepth = f.supportDepth || 0
  const tipDepth = f.tipDepth || 0
  const x0 = -span / 2
  const x1 = span / 2
  const z0 = -width / 2
  const z1 = width / 2
  const tipBottom = supportDepth - tipDepth
  const vertices = [
    x0, 0, z0, x0, 0, z1, x0, supportDepth, z1, x0, supportDepth, z0,
    x1, tipBottom, z0, x1, tipBottom, z1, x1, supportDepth, z1, x1, supportDepth, z0,
  ]
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    3, 2, 6, 3, 6, 7,
    0, 3, 7, 0, 7, 4,
    1, 5, 6, 1, 6, 2,
  ]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const material = new THREE.MeshLambertMaterial({
    color: COLORS3D.concrete,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geometry, material)
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color: COLORS3D.wire }),
  )
  const group = new THREE.Group()
  group.add(mesh, edges)
  return group
}

function concreteModel(f: BeamInstance): THREE.Group {
  if (f.shape === 'CANTILEVER_TAPERED') return taperedConcrete(f)
  if (f.shape === 'T_SECTION' || f.shape === 'L_SECTION') {
    const span = f.spanLength
    const flangeWidth = f.flangeWidth || 0
    const flangeThickness = f.flangeThickness || 0
    const webWidth = f.webWidth || 0
    const depth = f.overallDepth || 0
    const group = makeBoxMesh(
      span,
      depth,
      webWidth,
      0,
      COLORS3D.concrete,
      0.45,
    )
    const overhang = flangeWidth - webWidth
    if (overhang > 0 && f.shape === 'L_SECTION') {
      const flange = makeBoxMesh(
        span,
        flangeThickness,
        overhang,
        depth - flangeThickness,
        COLORS3D.concrete,
        0.45,
      )
      flange.position.z = (webWidth + overhang) / 2
      group.add(flange)
    } else if (overhang > 0) {
      const shoulderWidth = overhang / 2
      const left = makeBoxMesh(
        span,
        flangeThickness,
        shoulderWidth,
        depth - flangeThickness,
        COLORS3D.concrete,
        0.45,
      )
      left.position.z = (webWidth + shoulderWidth) / 2
      group.add(left)
      const right = left.clone()
      right.position.z = -(webWidth + shoulderWidth) / 2
      group.add(right)
    }
    return group
  }
  return makeBoxMesh(
    f.spanLength,
    f.depth || 0,
    f.width || 0,
    0,
    COLORS3D.concrete,
    0.45,
  )
}

function distribute(count: number, halfWidth: number): number[] {
  return Array.from(
    { length: count },
    (_, i) => -halfWidth + (i * 2 * halfWidth) / (count - 1 || 1),
  )
}

export function buildBeamModel(f: BeamInstance): THREE.Group {
  const group = concreteModel(f)
  const planWidth =
    f.shape === 'T_SECTION' || f.shape === 'L_SECTION'
      ? f.flangeWidth || 0
      : f.width || 0

  if (modelViewOptions.showRebar) {
    const cover = f.cover / 1000
    const spanHalf = f.spanLength / 2 - cover
    const cageWidth =
      f.shape === 'T_SECTION' || f.shape === 'L_SECTION'
        ? f.webWidth || 0
        : f.width || 0
    const supportDepth =
      f.shape === 'CANTILEVER_TAPERED'
        ? f.supportDepth || 0
        : f.shape === 'T_SECTION' || f.shape === 'L_SECTION'
          ? f.overallDepth || 0
          : f.depth || 0
    const tipDepth =
      f.shape === 'CANTILEVER_TAPERED' ? f.tipDepth || 0 : supportDepth
    const halfCage = Math.max(0.01, cageWidth / 2 - cover)
    const topGroups = resolveBarGroups(f.topBars, f.topBarCount, f.topBarDia)
    const bottomGroups = resolveBarGroups(
      f.bottomBars,
      f.bottomBarCount,
      f.bottomBarDia,
    )
    const topTotal = topGroups.reduce((s, g) => s + g.barCount, 0)
    const bottomTotal = bottomGroups.reduce((s, g) => s + g.barCount, 0)

    let topIdx = 0
    for (const barGroup of topGroups) {
      for (let b = 0; b < barGroup.barCount; b++) {
        const z = distribute(topTotal, halfCage)[topIdx] ?? 0
        topIdx += 1
        const bar = makeRebarBar(
          -spanHalf,
          supportDepth - cover,
          z,
          spanHalf,
          supportDepth - cover,
          z,
          barGroup.diameterMm,
        )
        if (bar) group.add(bar)
      }
    }
    let botIdx = 0
    for (const barGroup of bottomGroups) {
      for (let b = 0; b < barGroup.barCount; b++) {
        const z = distribute(bottomTotal, halfCage)[botIdx] ?? 0
        botIdx += 1
        const bar = makeRebarBar(
          -spanHalf,
          cover,
          z,
          spanHalf,
          supportDepth - tipDepth + cover,
          z,
          barGroup.diameterMm,
        )
        if (bar) group.add(bar)
      }
    }
    const linkCount = barCountForSpan(f.spanLength, f.linkSpacing)
    for (let i = 0; i < linkCount; i++) {
      const ratio = i / (linkCount - 1 || 1)
      const x = -f.spanLength / 2 + ratio * f.spanLength
      const localDepth = supportDepth + (tipDepth - supportDepth) * ratio
      const bottom = supportDepth - localDepth + cover
      const top = supportDepth - cover
      const points: [number, number][] = [
        [-halfCage, bottom],
        [halfCage, bottom],
        [halfCage, top],
        [-halfCage, top],
      ]
      points.forEach(([z, y], index) => {
        const [nextZ, nextY] = points[(index + 1) % points.length]
        const bar = makeRebarBar(x, y, z, x, nextY, nextZ, f.linkDia)
        if (bar) group.add(bar)
      })
    }
  }

  addPlanDims(group, f.spanLength, planWidth)
  return group
}
