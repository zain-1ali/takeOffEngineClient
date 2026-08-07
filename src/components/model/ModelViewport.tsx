import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { COLORS3D } from '../../three/colors'
import {
  buildModelForInstance,
  disposeObject3D,
  planDimForInstance,
} from '../../three/buildModelForInstance'
import type { Instance } from '../../types/api'

type CameraState = {
  theta: number
  phi: number
  radius: number
  autoRotate: boolean
}

/**
 * Imperative Three.js viewport — spherical orbit/zoom matching the HTML prototype.
 */
export function ModelViewport({
  instance,
  elementKey,
  blindingThickness,
  rebuildKey,
  autoRotate,
  onAutoRotateOff,
}: {
  instance: Instance | null
  elementKey: string
  blindingThickness: number
  /** Bump when rebar/dims toggles change so the model rebuilds. */
  rebuildKey: string
  autoRotate: boolean
  onAutoRotateOff: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const camRef = useRef<CameraState>({
    theta: 0.9,
    phi: 1.0,
    radius: 8,
    autoRotate: true,
  })
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    modelRoot: THREE.Group
    raf: number
  } | null>(null)

  // Keep autoRotate in sync with parent toggle
  useEffect(() => {
    camRef.current.autoRotate = autoRotate
  }, [autoRotate])

  // Mount scene once
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

    const amb = new THREE.AmbientLight(0xffffff, 0.75)
    scene.add(amb)
    const dir = new THREE.DirectionalLight(0xffffff, 0.6)
    dir.position.set(5, 10, 7)
    scene.add(dir)

    const grid = new THREE.GridHelper(20, 20, 0x2a3a4a, 0x1b2530)
    scene.add(grid)

    const modelRoot = new THREE.Group()
    scene.add(modelRoot)

    const updateCamera = () => {
      const c = camera
      const { radius: r, theta: t } = camRef.current
      const p = Math.max(0.15, Math.min(Math.PI - 0.15, camRef.current.phi))
      c.position.x = r * Math.sin(p) * Math.cos(t)
      c.position.y = r * Math.cos(p)
      c.position.z = r * Math.sin(p) * Math.sin(t)
      c.lookAt(0, 0, 0)
    }

    let dragging = false
    let lastX = 0
    let lastY = 0
    const dom = renderer.domElement

    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      camRef.current.autoRotate = false
      onAutoRotateOff()
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
        Math.min(30, camRef.current.radius + e.deltaY * 0.01),
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
      if (camRef.current.autoRotate) camRef.current.theta += 0.0035
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
    // onAutoRotateOff is stable enough; mount once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rebuild model when instance / toggles change
  useEffect(() => {
    const ctx = sceneRef.current
    if (!ctx) return

    while (ctx.modelRoot.children.length) {
      const child = ctx.modelRoot.children.pop()!
      ctx.modelRoot.remove(child)
      disposeObject3D(child)
    }

    if (!instance) return

    const model = buildModelForInstance(elementKey, instance, blindingThickness)
    ctx.modelRoot.add(model)
    camRef.current.radius = Math.max(4, planDimForInstance(instance) * 2.6)
  }, [instance, elementKey, blindingThickness, rebuildKey])

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[280px] bg-bg overflow-hidden"
    />
  )
}
