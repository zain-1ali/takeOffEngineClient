import * as THREE from 'three'
import { addHeightDim, addPlanDims } from './dimensions'
import { makeHelicalRibbon, makeInclinedSlab } from './inclinedModels'
import { makeRebarBar } from './meshes'
import { modelViewOptions } from './viewOptions'

export type RampInstance = {
  shape: 'RECTANGULAR_INCLINE' | 'HELICAL' | string
  horizontalRun?: number
  innerRadius?: number
  turnAngleDeg?: number
  rise: number
  width: number
  thickness: number
  cover: number
  mainDia: number
  stringBeamCount: number
}

export function buildRampModel(f: RampInstance): THREE.Group {
  const group =
    f.shape === 'HELICAL'
      ? makeHelicalRibbon(
          f.innerRadius || 0,
          f.width,
          f.turnAngleDeg || 0,
          f.rise,
          f.thickness,
        )
      : makeInclinedSlab(
          f.horizontalRun || 0,
          f.rise,
          f.width,
          f.thickness,
        )

  if (
    modelViewOptions.showRebar &&
    f.shape === 'RECTANGULAR_INCLINE'
  ) {
    const run = f.horizontalRun || 0
    const cover = f.cover / 1000
    const half = Math.max(0, f.width / 2 - cover)
    for (let i = 0; i < f.stringBeamCount; i++) {
      const z =
        f.stringBeamCount === 1
          ? 0
          : -half + (i * 2 * half) / (f.stringBeamCount - 1)
      const bar = makeRebarBar(
        -run / 2 + cover,
        cover,
        z,
        run / 2 - cover,
        f.rise + cover,
        z,
        f.mainDia,
      )
      if (bar) group.add(bar)
    }
  }

  if (f.shape === 'HELICAL') {
    const outer = ((f.innerRadius || 0) + f.width) * 2
    addPlanDims(group, outer, outer)
    addHeightDim(group, f.rise, { x: outer / 2, z: outer / 2 })
  } else {
    addPlanDims(group, f.horizontalRun || 0, f.width)
    addHeightDim(group, f.rise, {
      x: (f.horizontalRun || 0) / 2,
      z: f.width / 2,
    })
  }
  return group
}
