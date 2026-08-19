import * as THREE from 'three'
import { COLORS3D } from './colors'
import { barCountForSpan } from './math'
import { addHeightDim, addPlanDims } from './dimensions'
import { makePrismMesh, makeRebarBar } from './meshes'
import { modelViewOptions } from './viewOptions'

export type LongBarGroup = {
  diameterMm: number
  barCount: number
}

export type ColumnInstance = {
  shape: 'RECTANGULAR' | 'CIRCULAR' | 'L_SHAPED' | 'T_SHAPED' | 'CRUCIFORM' | string
  clearHeight: number
  width?: number
  depth?: number
  diameter?: number
  legThickness?: number
  flangeWidth?: number
  overallDepth?: number
  flangeThickness?: number
  webThickness?: number
  armThickness?: number
  cover: number
  longBars?: LongBarGroup[]
  longBarCount?: number
  longBarDia?: number
  tieDia: number
  tieSpacing: number
}

function resolveLongBars(f: ColumnInstance): LongBarGroup[] {
  if (Array.isArray(f.longBars) && f.longBars.length > 0) {
    return f.longBars.filter((g) => g.barCount > 0 && g.diameterMm > 0)
  }
  const dia = f.longBarDia || 0
  const count = f.longBarCount || 0
  if (dia > 0 && count > 0) return [{ diameterMm: dia, barCount: count }]
  return []
}

function planPoints(f: ColumnInstance): [number, number][] {
  if (f.shape === 'L_SHAPED') {
    const w = f.width || 0
    const d = f.depth || 0
    const t = f.legThickness || 0
    return [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, -d / 2 + t],
      [-w / 2 + t, -d / 2 + t],
      [-w / 2 + t, d / 2],
      [-w / 2, d / 2],
    ]
  }
  if (f.shape === 'T_SHAPED') {
    const w = f.flangeWidth || 0
    const d = f.overallDepth || 0
    const tf = f.flangeThickness || 0
    const tw = f.webThickness || 0
    return [
      [-w / 2, d / 2],
      [w / 2, d / 2],
      [w / 2, d / 2 - tf],
      [tw / 2, d / 2 - tf],
      [tw / 2, -d / 2],
      [-tw / 2, -d / 2],
      [-tw / 2, d / 2 - tf],
      [-w / 2, d / 2 - tf],
    ]
  }
  if (f.shape === 'CRUCIFORM') {
    const w = f.width || 0
    const d = f.depth || 0
    const t = f.armThickness || 0
    return [
      [-t / 2, d / 2],
      [t / 2, d / 2],
      [t / 2, t / 2],
      [w / 2, t / 2],
      [w / 2, -t / 2],
      [t / 2, -t / 2],
      [t / 2, -d / 2],
      [-t / 2, -d / 2],
      [-t / 2, -t / 2],
      [-w / 2, -t / 2],
      [-w / 2, t / 2],
      [-t / 2, t / 2],
    ]
  }
  const w = f.width || 0
  const d = f.depth || 0
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ]
}

function inset(points: [number, number][], cover: number): [number, number][] {
  const maxRadius = Math.max(
    cover,
    ...points.map(([x, z]) => Math.sqrt(x * x + z * z)),
  )
  const factor = Math.max(0.1, 1 - cover / maxRadius)
  return points.map(([x, z]) => [x * factor, z * factor])
}

function samplePerimeter(
  points: [number, number][],
  count: number,
): [number, number][] {
  const edges = points.map((point, i) => {
    const next = points[(i + 1) % points.length]
    return {
      point,
      next,
      length: Math.hypot(next[0] - point[0], next[1] - point[1]),
    }
  })
  const perimeter = edges.reduce((sum, edge) => sum + edge.length, 0)
  return Array.from({ length: count }, (_, i) => {
    let distance = (i * perimeter) / Math.max(1, count)
    for (const edge of edges) {
      if (distance <= edge.length) {
        const ratio = edge.length ? distance / edge.length : 0
        return [
          edge.point[0] + (edge.next[0] - edge.point[0]) * ratio,
          edge.point[1] + (edge.next[1] - edge.point[1]) * ratio,
        ]
      }
      distance -= edge.length
    }
    return points[0]
  })
}

export function buildColumnModel(f: ColumnInstance): THREE.Group {
  const group = new THREE.Group()
  const circular = f.shape === 'CIRCULAR'
  const cover = f.cover / 1000

  if (circular) {
    const diameter = f.diameter || 0
    const geometry = new THREE.CylinderGeometry(
      diameter / 2,
      diameter / 2,
      f.clearHeight,
      32,
    )
    const material = new THREE.MeshLambertMaterial({
      color: COLORS3D.concrete,
      transparent: true,
      opacity: 0.45,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.y = f.clearHeight / 2
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: COLORS3D.wire }),
    )
    edges.position.copy(mesh.position)
    group.add(mesh, edges)
  } else {
    group.add(
      makePrismMesh(
        planPoints(f),
        f.clearHeight,
        0,
        COLORS3D.concrete,
        0.45,
      ),
    )
  }

  const planWidth =
    f.shape === 'CIRCULAR'
      ? f.diameter || 0
      : f.shape === 'T_SHAPED'
        ? f.flangeWidth || 0
        : f.width || 0
  const planDepth =
    f.shape === 'CIRCULAR'
      ? f.diameter || 0
      : f.shape === 'T_SHAPED'
        ? f.overallDepth || 0
        : f.depth || 0

  if (modelViewOptions.showRebar) {
    const longBars = resolveLongBars(f)
    const totalLongCount = longBars.reduce((s, g) => s + g.barCount, 0)
    let longitudinalPositions: [number, number][]
    let tiePoints: [number, number][] = []
    if (circular) {
      const radius = Math.max(0.02, (f.diameter || 0) / 2 - cover)
      longitudinalPositions = Array.from({ length: totalLongCount }, (_, i) => {
        const angle = (i * Math.PI * 2) / Math.max(1, totalLongCount)
        return [Math.cos(angle) * radius, Math.sin(angle) * radius]
      })
    } else {
      tiePoints = inset(planPoints(f), cover)
      longitudinalPositions = samplePerimeter(tiePoints, totalLongCount)
    }

    let posIndex = 0
    for (const barGroup of longBars) {
      for (let b = 0; b < barGroup.barCount; b++) {
        const [x, z] = longitudinalPositions[posIndex] || longitudinalPositions[0]
        posIndex += 1
        const bar = makeRebarBar(
          x,
          cover,
          z,
          x,
          f.clearHeight - cover,
          z,
          barGroup.diameterMm,
        )
        if (bar) group.add(bar)
      }
    }

    const tieCount = barCountForSpan(f.clearHeight, f.tieSpacing)
    for (let i = 0; i < tieCount; i++) {
      const y = (i * f.clearHeight) / (tieCount - 1 || 1)
      if (circular) {
        const radius = Math.max(0.02, (f.diameter || 0) / 2 - cover)
        const geometry = new THREE.TorusGeometry(
          radius,
          Math.max(0.006, (f.tieDia / 1000) * 1.5),
          6,
          24,
        )
        const material = new THREE.MeshLambertMaterial({ color: COLORS3D.rebar })
        const tie = new THREE.Mesh(geometry, material)
        tie.rotation.x = Math.PI / 2
        tie.position.y = y
        group.add(tie)
      } else {
        tiePoints.forEach(([x, z], pointIndex) => {
          const [nextX, nextZ] = tiePoints[(pointIndex + 1) % tiePoints.length]
          const bar = makeRebarBar(
            x,
            y,
            z,
            nextX,
            y,
            nextZ,
            f.tieDia,
          )
          if (bar) group.add(bar)
        })
      }
    }
  }

  addPlanDims(group, planWidth, planDepth)
  addHeightDim(group, f.clearHeight, {
    x: planWidth / 2,
    z: planDepth / 2,
  })
  return group
}
