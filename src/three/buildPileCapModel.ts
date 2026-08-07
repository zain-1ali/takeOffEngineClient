import * as THREE from 'three'
import { COLORS3D } from './colors'
import { barCountForSpan } from './math'
import { makePrismMesh, makeRebarBar } from './meshes'
import { modelViewOptions } from './viewOptions'

export type PileCapInstance = {
  shape: 'RECTANGULAR' | 'TRIANGULAR' | 'HEXAGONAL' | 'TRAPEZOIDAL' | string
  thickness: number
  length?: number
  width?: number
  triangleBase?: number
  triangleHeight?: number
  hexSide?: number
  baseWidth?: number
  topWidth?: number
  cover: number
  bottomMainDia: number
  bottomMainSpacing: number
  bottomDistDia: number
  bottomDistSpacing: number
  pileCount: number
  starterBarsPerPile: number
  starterDia: number
  starterProjection: number
  starterEmbedment: number
}

function plan(f: PileCapInstance): {
  points: [number, number][]
  meshLength: number
  meshWidth: number
} {
  if (f.shape === 'TRIANGULAR') {
    const base = f.triangleBase || 0
    const height = f.triangleHeight || 0
    return {
      points: [
        [-base / 2, -height / 2],
        [base / 2, -height / 2],
        [0, height / 2],
      ],
      meshLength: base,
      meshWidth: height,
    }
  }
  if (f.shape === 'HEXAGONAL') {
    const side = f.hexSide || 0
    const points: [number, number][] = Array.from({ length: 6 }, (_, i) => {
      const angle = (i * Math.PI) / 3
      return [side * Math.cos(angle), side * Math.sin(angle)]
    })
    return { points, meshLength: 2 * side, meshWidth: Math.sqrt(3) * side }
  }
  if (f.shape === 'TRAPEZOIDAL') {
    const length = f.length || 0
    const baseWidth = f.baseWidth || 0
    const topWidth = f.topWidth || 0
    return {
      points: [
        [-baseWidth / 2, -length / 2],
        [baseWidth / 2, -length / 2],
        [topWidth / 2, length / 2],
        [-topWidth / 2, length / 2],
      ],
      meshLength: length,
      meshWidth: Math.max(baseWidth, topWidth),
    }
  }
  const length = f.length || 0
  const width = f.width || 0
  return {
    points: [
      [-length / 2, -width / 2],
      [length / 2, -width / 2],
      [length / 2, width / 2],
      [-length / 2, width / 2],
    ],
    meshLength: length,
    meshWidth: width,
  }
}

export function buildPileCapModel(f: PileCapInstance): THREE.Group {
  const group = new THREE.Group()
  const footprint = plan(f)
  group.add(
    makePrismMesh(
      footprint.points,
      f.thickness,
      0,
      COLORS3D.concrete,
      0.45,
    ),
  )

  if (modelViewOptions.showRebar) {
    const cover = f.cover / 1000
    const halfL = footprint.meshLength / 2 - cover
    const halfW = footprint.meshWidth / 2 - cover
    const y = cover
    const mainCount = barCountForSpan(
      footprint.meshWidth - 2 * cover,
      f.bottomMainSpacing,
    )
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
    const distCount = barCountForSpan(
      footprint.meshLength - 2 * cover,
      f.bottomDistSpacing,
    )
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

    const pileRadius = Math.max(
      0,
      Math.min(halfL, halfW) * (f.pileCount === 1 ? 0 : 0.55),
    )
    for (let pile = 0; pile < f.pileCount; pile++) {
      const angle = (pile * Math.PI * 2) / Math.max(1, f.pileCount)
      const cx = Math.cos(angle) * pileRadius
      const cz = Math.sin(angle) * pileRadius
      for (let barIndex = 0; barIndex < f.starterBarsPerPile; barIndex++) {
        const barAngle =
          (barIndex * Math.PI * 2) / Math.max(1, f.starterBarsPerPile)
        const bundleOffset = 0.045
        const x = cx + Math.cos(barAngle) * bundleOffset
        const z = cz + Math.sin(barAngle) * bundleOffset
        const bar = makeRebarBar(
          x,
          Math.max(cover, f.thickness - f.starterEmbedment),
          z,
          x,
          f.thickness + f.starterProjection,
          z,
          f.starterDia,
        )
        if (bar) group.add(bar)
      }
    }
  }

  return group
}
