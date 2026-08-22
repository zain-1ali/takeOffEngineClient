import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { ELEMENT_ENGINES } from '../../elementEngines'
import { ELEMENT_SCHEMAS } from '../../constants/elementSchemas'
import { COLORS3D } from '../../three/colors'
import { disposeObject3D } from '../../three/buildModelForInstance'
import { modelViewOptions } from '../../three/viewOptions'
import type { IfcMappedInstanceData, IfcSuggestionConfidence } from '../../types/ifcImport'

/** Amber outline for LOW-confidence suggestions (matches review table signal). */
const LOW_OUTLINE = 0xf59e0b
const HIGH_OUTLINE = COLORS3D.wire

const PREVIEW_KEYS = new Set([
  'WALLS',
  'SLABS',
  'PAD_FOOTING',
  'STRIP_FOOTING',
  'PILE_CAP',
  'COLUMNS',
  'BEAMS',
])

type CameraState = {
  theta: number
  phi: number
  radius: number
}

function previewPayload(
  data: IfcMappedInstanceData,
): { elementKey: string; instance: Record<string, unknown> } | null {
  const ek = data.elementKey
  if (!ek || !PREVIEW_KEYS.has(ek) || !data.shape || !data.geometry) return null
  if (!ELEMENT_ENGINES[ek]) return null
  const schema = ELEMENT_SCHEMAS[ek]
  return {
    elementKey: ek,
    instance: {
      shape: data.shape,
      cover: 40,
      bottomMainDia: 12,
      bottomMainSpacing: 200,
      bottomDistDia: 12,
      bottomDistSpacing: 200,
      mainDia: 12,
      mainSpacing: 150,
      distDia: 12,
      distSpacing: 250,
      starterBarsPerPile: 4,
      starterDia: 20,
      starterProjection: 0.8,
      starterEmbedment: 0.4,
      ribBarsPerRib: 2,
      ...(schema?.rebarDefaults || {}),
      ...(ek === 'COLUMNS'
        ? { cover: 40, tieDia: 8, tieSpacing: 200 }
        : {}),
      ...(ek === 'BEAMS'
        ? { cover: 40, linkDia: 8, linkSpacing: 200 }
        : {}),
      ...data.geometry,
    },
  }
}

function planDim(geometry: Record<string, number>): number {
  const nums = [
    geometry.length,
    geometry.width,
    geometry.height,
    geometry.thickness,
    geometry.baseThickness,
    geometry.radius,
    geometry.diameter,
    geometry.depth,
    geometry.clearHeight,
    geometry.flangeWidth,
    geometry.overallDepth,
    geometry.spanLength,
    geometry.supportDepth,
    geometry.tipDepth,
    geometry.webWidth,
  ]
    .map((n) => Number(n) || 0)
    .filter((n) => n > 0)
  return Math.max(1, ...nums)
}

function applyOutlineColor(root: THREE.Object3D, color: number) {
  root.traverse((child) => {
    const lines = child as THREE.LineSegments
    if (!lines.isLineSegments) return
    const mat = lines.material
    if (Array.isArray(mat)) {
      mat.forEach((m) => {
        if ('color' in m) (m as THREE.LineBasicMaterial).color.setHex(color)
      })
    } else if (mat && 'color' in mat) {
      ;(mat as THREE.LineBasicMaterial).color.setHex(color)
    }
  })
}

function buildPreviewModel(
  data: IfcMappedInstanceData,
  confidence: IfcSuggestionConfidence,
): THREE.Group | null {
  const payload = previewPayload(data)
  if (!payload) return null
  const prevRebar = modelViewOptions.showRebar
  const prevDims = modelViewOptions.showDims
  modelViewOptions.showRebar = false
  modelViewOptions.showDims = false
  let model: THREE.Group
  try {
    model = ELEMENT_ENGINES[payload.elementKey].build3D(payload.instance)
  } finally {
    modelViewOptions.showRebar = prevRebar
    modelViewOptions.showDims = prevDims
  }

  const outline = confidence === 'LOW' ? LOW_OUTLINE : HIGH_OUTLINE
  applyOutlineColor(model, outline)

  if (confidence === 'LOW') {
    model.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const mat = mesh.material as THREE.MeshLambertMaterial
      if (mat && 'color' in mat) mat.color.setHex(0x4a3a28)
    })
  }

  return model
}

/**
 * Compact 3D preview for IFC review — same mesh builders as the Model tab,
 * without rebar/dims. One WebGL context; open from a Preview button.
 */
export function IfcSuggestionPreviewViewport({
  mapped,
  confidence,
  className,
}: {
  mapped: IfcMappedInstanceData
  confidence: IfcSuggestionConfidence
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const camRef = useRef<CameraState>({ theta: 0.9, phi: 1.0, radius: 8 })
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    modelRoot: THREE.Group
    raf: number
  } | null>(null)

  const payload = previewPayload(mapped)
  const rebuildKey = payload
    ? [
        payload.elementKey,
        payload.instance.shape,
        JSON.stringify(mapped.geometry),
        confidence,
      ].join(':')
    : 'empty'

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const w = Math.max(1, container.clientWidth)
    const h = Math.max(1, container.clientHeight)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(COLORS3D.ground)

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 1000)
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    } catch {
      return
    }
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    container.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.8))
    const dir = new THREE.DirectionalLight(0xffffff, 0.55)
    dir.position.set(5, 10, 7)
    scene.add(dir)

    const grid = new THREE.GridHelper(16, 16, 0x2a3a4a, 0x1b2530)
    scene.add(grid)

    const modelRoot = new THREE.Group()
    scene.add(modelRoot)

    const updateCamera = () => {
      const { radius: r, theta: t } = camRef.current
      const p = Math.max(0.15, Math.min(Math.PI - 0.15, camRef.current.phi))
      camera.position.x = r * Math.sin(p) * Math.cos(t)
      camera.position.y = r * Math.cos(p)
      camera.position.z = r * Math.sin(p) * Math.sin(t)
      camera.lookAt(0, 0, 0)
    }

    let dragging = false
    let lastX = 0
    let lastY = 0
    const dom = renderer.domElement
    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
    }
    const onPointerUp = () => {
      dragging = false
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      camRef.current.theta -= (e.clientX - lastX) * 0.01
      camRef.current.phi -= (e.clientY - lastY) * 0.01
      lastX = e.clientX
      lastY = e.clientY
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      camRef.current.radius = Math.max(
        2,
        Math.min(80, camRef.current.radius + e.deltaY * 0.01),
      )
    }

    dom.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointermove', onPointerMove)
    dom.addEventListener('wheel', onWheel, { passive: false })

    const resize = () => {
      if (!containerRef.current) return
      const cw = Math.max(1, containerRef.current.clientWidth)
      const ch = Math.max(1, containerRef.current.clientHeight)
      renderer.setSize(cw, ch)
      camera.aspect = cw / ch
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      if (!dragging) camRef.current.theta += 0.004
      updateCamera()
      renderer.render(scene, camera)
    }
    animate()

    sceneRef.current = { renderer, scene, camera, modelRoot, raf }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      dom.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointermove', onPointerMove)
      dom.removeEventListener('wheel', onWheel)
      disposeObject3D(modelRoot)
      renderer.dispose()
      if (dom.parentElement === container) container.removeChild(dom)
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const ctx = sceneRef.current
    if (!ctx) return
    while (ctx.modelRoot.children.length) {
      const child = ctx.modelRoot.children.pop()!
      ctx.modelRoot.remove(child)
      disposeObject3D(child)
    }
    const model = buildPreviewModel(mapped, confidence)
    if (!model) return
    ctx.modelRoot.add(model)
    camRef.current.radius = Math.max(3.5, planDim(mapped.geometry || {}) * 2.4)
  }, [rebuildKey, mapped, confidence])

  if (!payload) {
    return (
      <div
        className={`flex items-center justify-center border border-steel-border bg-bg text-sm text-steel ${className || 'h-72'}`}
      >
        Complete shape and dimensions to preview.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden border border-steel-border bg-bg ${className || 'h-72 w-full'}`}
    />
  )
}

/** @deprecated Use IfcSuggestionPreviewViewport */
export const IfcWallPreviewViewport = IfcSuggestionPreviewViewport

export function canBuildIfcPreview(
  data: IfcMappedInstanceData | null | undefined,
): boolean {
  if (!data) return false
  return previewPayload(data) != null
}

export function canPreviewWallSuggestion(
  data: IfcMappedInstanceData | null | undefined,
): boolean {
  return data?.elementKey === 'WALLS' && canBuildIfcPreview(data)
}
