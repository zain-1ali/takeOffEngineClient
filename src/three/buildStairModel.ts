import * as THREE from 'three'
import { COLORS3D } from './colors'
import { addHeightDim, addPlanDims } from './dimensions'
import {
  makeHelicalRibbon,
  makeInclinedSlab,
  makeStepTriangles,
} from './inclinedModels'
import { makeRebarBar } from './meshes'
import { modelViewOptions } from './viewOptions'

export type StairInstance = {
  shape: 'STRAIGHT' | 'WINDER' | 'SPIRAL' | string
  width: number
  rise: number
  run?: number
  flight1Run?: number
  flight2Run?: number
  innerRadius?: number
  turnAngleDeg?: number
  stepCount: number
  waistThickness: number
  cover: number
  mainDia: number
  stringBeamCount: number
}

function addStraightFlight(
  group: THREE.Group,
  run: number,
  rise: number,
  width: number,
  steps: number,
  thickness: number,
) {
  group.add(makeInclinedSlab(run, rise, width, thickness))
  group.add(makeStepTriangles(run, rise, width, steps, thickness))
}

function addCurvedTreads(group: THREE.Group, f: StairInstance) {
  const count = Math.max(1, f.stepCount)
  const inner = f.innerRadius || 0
  const angle = ((f.turnAngleDeg || 0) * Math.PI) / 180
  const averageRadius = inner + f.width / 2
  const treadLength = (Math.abs(angle) * averageRadius) / count
  const material = new THREE.MeshLambertMaterial({
    color: COLORS3D.concrete,
    transparent: true,
    opacity: 0.55,
  })
  const geometry = new THREE.BoxGeometry(
    Math.max(0.02, treadLength),
    0.035,
    f.width,
  )
  const treads = new THREE.InstancedMesh(geometry, material, count)
  const matrix = new THREE.Matrix4()
  const rotation = new THREE.Quaternion()
  const position = new THREE.Vector3()
  const scale = new THREE.Vector3(1, 1, 1)
  for (let i = 0; i < count; i++) {
    const ratio = (i + 0.5) / count
    const theta = ratio * angle
    position.set(
      averageRadius * Math.cos(theta),
      ratio * f.rise + f.waistThickness,
      averageRadius * Math.sin(theta),
    )
    rotation.setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      1.5 * Math.PI - theta,
    )
    matrix.compose(position, rotation, scale)
    treads.setMatrixAt(i, matrix)
  }
  treads.instanceMatrix.needsUpdate = true
  group.add(treads)
}

function addStraightStringBars(group: THREE.Group, f: StairInstance) {
  const run = f.run || 0
  const cover = f.cover / 1000
  const half = Math.max(0, f.width / 2 - cover)
  const count = Math.max(0, f.stringBeamCount)
  for (let i = 0; i < count; i++) {
    const z = count === 1 ? 0 : -half + (i * 2 * half) / (count - 1)
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

export function buildStairModel(f: StairInstance): THREE.Group {
  const group = new THREE.Group()
  if (f.shape === 'SPIRAL') {
    group.add(
      makeHelicalRibbon(
        f.innerRadius || 0,
        f.width,
        f.turnAngleDeg || 0,
        f.rise,
        f.waistThickness,
      ),
    )
    addCurvedTreads(group, f)
    const outer = ((f.innerRadius || 0) + f.width) * 2
    addPlanDims(group, outer, outer)
    addHeightDim(group, f.rise, { x: outer / 2, z: outer / 2 })
    return group
  }

  if (f.shape === 'WINDER') {
    const firstRun = f.flight1Run || 0
    const secondRun = f.flight2Run || 0
    const angle = ((f.turnAngleDeg || 0) * Math.PI) / 180
    const averageRadius = (f.innerRadius || 0) + f.width / 2
    const turnRun = Math.abs(angle) * averageRadius
    const totalRun = firstRun + turnRun + secondRun || 1
    const firstRise = f.rise * firstRun / totalRun
    const turnRise = f.rise * turnRun / totalRun
    const secondRise = f.rise - firstRise - turnRise
    const firstSteps = Math.max(
      1,
      Math.round(f.stepCount * firstRun / totalRun),
    )
    const secondSteps = Math.max(
      1,
      Math.round(f.stepCount * secondRun / totalRun),
    )

    const first = new THREE.Group()
    addStraightFlight(
      first,
      firstRun,
      firstRise,
      f.width,
      firstSteps,
      f.waistThickness,
    )
    first.rotation.y = -Math.PI / 2
    first.position.set(averageRadius, 0, -firstRun / 2)
    group.add(first)

    const turn = makeHelicalRibbon(
      f.innerRadius || 0,
      f.width,
      f.turnAngleDeg || 0,
      turnRise,
      f.waistThickness,
    )
    turn.position.y = firstRise
    group.add(turn)
    const turnTreads = new THREE.Group()
    addCurvedTreads(turnTreads, {
      ...f,
      rise: turnRise,
      stepCount: Math.max(
        1,
        f.stepCount - firstSteps - secondSteps,
      ),
    })
    turnTreads.position.y = firstRise
    group.add(turnTreads)

    const tangent = new THREE.Vector3(
      -Math.sin(angle),
      0,
      Math.cos(angle),
    )
    const end = new THREE.Vector3(
      averageRadius * Math.cos(angle),
      firstRise + turnRise,
      averageRadius * Math.sin(angle),
    )
    const second = new THREE.Group()
    addStraightFlight(
      second,
      secondRun,
      secondRise,
      f.width,
      secondSteps,
      f.waistThickness,
    )
    second.rotation.y = 1.5 * Math.PI - angle
    second.position.copy(end.addScaledVector(tangent, secondRun / 2))
    group.add(second)
    const outer = ((f.innerRadius || 0) + f.width) * 2
    addPlanDims(group, Math.max(outer, firstRun, secondRun), outer)
    addHeightDim(group, f.rise, { x: outer / 2, z: outer / 2 })
    return group
  }

  addStraightFlight(
    group,
    f.run || 0,
    f.rise,
    f.width,
    f.stepCount,
    f.waistThickness,
  )
  if (modelViewOptions.showRebar) addStraightStringBars(group, f)
  addPlanDims(group, f.run || 0, f.width)
  addHeightDim(group, f.rise, {
    x: (f.run || 0) / 2,
    z: f.width / 2,
  })
  return group
}
