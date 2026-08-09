/**
 * Prototype-faithful dimension lines (AgileQS-Takeoff.html modelView.showDims).
 * Lines + numeric labels converted from stored metres via modelViewOptions.unitSystem.
 */
import * as THREE from 'three'
import { lengthToDisplay, parseUnitSystem } from '../lib/units'
import { modelViewOptions } from './viewOptions'

const DIM_COLOR = 0xc9d3dc
const PLAN_Y = -0.05
const PLAN_OFFSET = 0.15

function dimMaterial(): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({ color: DIM_COLOR })
}

function addLine(
  group: THREE.Group,
  a: THREE.Vector3,
  b: THREE.Vector3,
  material: THREE.LineBasicMaterial,
) {
  const geometry = new THREE.BufferGeometry().setFromPoints([a, b])
  group.add(new THREE.Line(geometry, material))
}

function formatDimMetres(metres: number): string {
  const system = parseUnitSystem(modelViewOptions.unitSystem)
  const v = lengthToDisplay(metres, system)
  const unit = system === 'imperial' ? 'ft' : 'm'
  const dec = system === 'imperial' ? 2 : 2
  return `${v.toFixed(dec)} ${unit}`
}

function makeDimLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const padX = 10
  const padY = 6
  ctx.font = '600 28px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  const metrics = ctx.measureText(text)
  canvas.width = Math.ceil(metrics.width + padX * 2)
  canvas.height = 40
  ctx.font = '600 28px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  ctx.fillStyle = 'rgba(15, 23, 32, 0.72)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#e8eef4'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, padX, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  })
  const sprite = new THREE.Sprite(material)
  const scale = 0.35
  sprite.scale.set((canvas.width / canvas.height) * scale, scale, 1)
  return sprite
}

function addLabel(group: THREE.Group, text: string, position: THREE.Vector3) {
  const sprite = makeDimLabel(text)
  sprite.position.copy(position)
  group.add(sprite)
}

/** Plan L (along +X) and W (along +Z) at the model base. */
export function addPlanDims(
  group: THREE.Group,
  length: number,
  width: number,
  opts?: { y?: number; offset?: number },
) {
  if (!modelViewOptions.showDims) return
  if (!(length > 0) || !(width > 0)) return
  const y = opts?.y ?? PLAN_Y
  const offset = opts?.offset ?? PLAN_OFFSET
  const material = dimMaterial()
  addLine(
    group,
    new THREE.Vector3(-length / 2, y, width / 2 + offset),
    new THREE.Vector3(length / 2, y, width / 2 + offset),
    material,
  )
  addLabel(
    group,
    formatDimMetres(length),
    new THREE.Vector3(0, y + 0.02, width / 2 + offset + 0.12),
  )
  addLine(
    group,
    new THREE.Vector3(length / 2 + offset, y, -width / 2),
    new THREE.Vector3(length / 2 + offset, y, width / 2),
    material,
  )
  addLabel(
    group,
    formatDimMetres(width),
    new THREE.Vector3(length / 2 + offset + 0.12, y + 0.02, 0),
  )
}

/** Single plan length line (walls / linear elements). */
export function addLengthDim(
  group: THREE.Group,
  length: number,
  halfWidth: number,
  opts?: { y?: number; offset?: number },
) {
  if (!modelViewOptions.showDims) return
  if (!(length > 0)) return
  const y = opts?.y ?? PLAN_Y
  const offset = opts?.offset ?? PLAN_OFFSET
  addLine(
    group,
    new THREE.Vector3(-length / 2, y, halfWidth + offset),
    new THREE.Vector3(length / 2, y, halfWidth + offset),
    dimMaterial(),
  )
  addLabel(
    group,
    formatDimMetres(length),
    new THREE.Vector3(0, y + 0.02, halfWidth + offset + 0.12),
  )
}

/** Vertical height/depth line standing off the +X,+Z corner. */
export function addHeightDim(
  group: THREE.Group,
  height: number,
  at: { x: number; z: number } = { x: 0, z: 0 },
  opts?: { offset?: number; y0?: number },
) {
  if (!modelViewOptions.showDims) return
  if (!(height > 0)) return
  const offset = opts?.offset ?? PLAN_OFFSET
  const y0 = opts?.y0 ?? 0
  addLine(
    group,
    new THREE.Vector3(at.x + offset, y0, at.z + offset),
    new THREE.Vector3(at.x + offset, y0 + height, at.z + offset),
    dimMaterial(),
  )
  addLabel(
    group,
    formatDimMetres(height),
    new THREE.Vector3(at.x + offset + 0.14, y0 + height / 2, at.z + offset + 0.14),
  )
}
