import * as THREE from 'three'
import { createMote } from './mote.js'

export const MINI_COUNT = 4

/**
 * Stage presets: where Mote and its parallel-search copies sit for each
 * section of the landing page, in viewport-relative units
 * (x: -0.5 left edge … 0.5 right edge, y: -0.5 bottom … 0.5 top).
 */
const WIDE = {
  hero: { x: 0.25, y: -0.02, s: 1.05, tilt: 0, glow: 1, wave: 0, warm: 0, minis: hidden(0.25, -0.02) },
  parallel: {
    x: -0.04, y: -0.06, s: 0.62, tilt: 0, glow: 1.1, wave: 0, warm: 0.15,
    minis: [0, 1, 2, 3].map((i) => ({ x: 0.13, y: 0.24 - i * 0.155, s: 0.24 })),
  },
  ask: { x: -0.25, y: -0.04, s: 0.85, tilt: 0.28, glow: 1, wave: 0, warm: 0.1, minis: hidden(-0.25, -0.04) },
  answer: { x: 0.29, y: -0.02, s: 0.8, tilt: 0, glow: 1.9, wave: 0, warm: 1, minis: hidden(0.29, -0.02) },
  stack: { x: 0.0, y: 0.31, s: 0.42, tilt: 0, glow: 1.2, wave: 0, warm: 0.3, minis: hidden(0, 0.31) },
  cta: { x: 0.0, y: 0.17, s: 0.82, tilt: -0.12, glow: 1.4, wave: 1, warm: 0.45, minis: hidden(0, 0.17) },
}

// On phones the copy scrolls over the whole screen, so after the hero Mote
// retreats to a small companion in the top-right corner, out of the text's way.
const CORNER = { x: 0.34, y: 0.37 }
const NARROW = {
  hero: { x: 0.0, y: 0.31, s: 0.48, tilt: 0, glow: 1, wave: 0, warm: 0, minis: hidden(0, 0.31) },
  parallel: {
    ...CORNER, s: 0.2, tilt: 0, glow: 1.1, wave: 0, warm: 0.15,
    minis: [
      { x: 0.18, y: 0.4, s: 0.09 },
      { x: 0.22, y: 0.3, s: 0.09 },
      { x: 0.42, y: 0.27, s: 0.09 },
      { x: 0.12, y: 0.35, s: 0.09 },
    ],
  },
  ask: { ...CORNER, s: 0.22, tilt: 0.28, glow: 1, wave: 0, warm: 0.1, minis: hidden(CORNER.x, CORNER.y) },
  answer: { ...CORNER, s: 0.22, tilt: 0, glow: 1.9, wave: 0, warm: 1, minis: hidden(CORNER.x, CORNER.y) },
  stack: { ...CORNER, s: 0.2, tilt: 0, glow: 1.2, wave: 0, warm: 0.3, minis: hidden(CORNER.x, CORNER.y) },
  cta: { x: 0.0, y: 0.26, s: 0.55, tilt: -0.12, glow: 1.4, wave: 1, warm: 0.45, minis: hidden(0, 0.26) },
}

function hidden(x, y) {
  return Array.from({ length: MINI_COUNT }, () => ({ x, y, s: 0 }))
}

export function presetsFor(width, height) {
  return width / height < 0.85 || width <= 860 ? NARROW : WIDE
}

/** Flatten a preset into the plain numeric props GSAP tweens. */
export function flatten(p) {
  const out = { x: p.x, y: p.y, s: p.s, tilt: p.tilt, glow: p.glow, wave: p.wave, warm: p.warm }
  p.minis.forEach((m, i) => {
    out[`m${i}x`] = m.x
    out[`m${i}y`] = m.y
    out[`m${i}s`] = m.s
  })
  return out
}

export function createLandingScene(container, { reducedMotion = false, onWarm } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x000000, 0)
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
  camera.position.set(0, 0, 10)

  scene.add(new THREE.HemisphereLight('#fff3df', '#0d262b', 1.1))
  const key = new THREE.DirectionalLight('#fff4e0', 1.6)
  key.position.set(-2, 3, 4)
  scene.add(key)

  const mote = createMote()
  scene.add(mote.root)

  const minis = Array.from({ length: MINI_COUNT }, (_, i) => {
    const m = createMote({ detail: 32 })
    m.root.scale.setScalar(0)
    m.root.visible = false
    m.parts.shadow.visible = false
    m.parts.halo.material.opacity = 0.5
    m.phase = i * 1.7
    scene.add(m.root)
    return m
  })

  // Drifting dust: tiny warm specks that read as "thoughts in the air".
  const dustCount = 160
  const dustGeo = new THREE.BufferGeometry()
  const dustPos = new Float32Array(dustCount * 3)
  const dustSeed = new Float32Array(dustCount)
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 16
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 10
    dustPos[i * 3 + 2] = -1 - Math.random() * 6
    dustSeed[i] = Math.random() * Math.PI * 2
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ color: '#ffc77a', size: 0.035, transparent: true, opacity: 0.55, depthWrite: false })
  )
  scene.add(dust)

  // Animated stage, written to by GSAP ScrollTriggers.
  let presets = presetsFor(container.clientWidth || 1, container.clientHeight || 1)
  const stage = flatten(presets.hero)

  const pointer = new THREE.Vector2(0, 0)
  const onPointer = (e) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1))
  }
  window.addEventListener('pointermove', onPointer, { passive: true })

  let viewW = 1
  let viewH = 1
  function resize() {
    const w = container.clientWidth || window.innerWidth
    const h = container.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    viewH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z
    viewW = viewH * camera.aspect
    presets = presetsFor(w, h)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  resize()

  // Base size: Mote is ~2.4 units tall; size it against the shorter view axis.
  const baseScale = () => Math.min(viewH, viewW * 1.2) * 0.2

  const clock = new THREE.Clock()
  let running = true
  let visible = true
  let raf = 0
  let lastWarm = -1

  function frame() {
    if (!running) return
    raf = requestAnimationFrame(frame)
    if (!visible) return
    const dt = Math.min(clock.getDelta(), 0.05)
    const t = clock.elapsedTime
    const base = baseScale()

    mote.root.position.set(stage.x * viewW, stage.y * viewH, 0)
    mote.root.scale.setScalar(Math.max(0.0001, stage.s * base))
    mote.state.tilt = stage.tilt
    mote.state.glow = stage.glow
    mote.state.wave = stage.wave
    mote.state.bob = reducedMotion ? 0.2 : 1
    // Look toward the pointer, softened.
    const mp = mote.root.position
    mote.state.look.set(
      THREE.MathUtils.clamp(pointer.x - mp.x / (viewW / 2), -1, 1) * 0.8,
      THREE.MathUtils.clamp(pointer.y - mp.y / (viewH / 2), -1, 1) * 0.6
    )
    mote.update(t, dt)

    minis.forEach((m, i) => {
      const s = stage[`m${i}s`]
      m.root.visible = s > 0.002
      if (!m.root.visible) return
      const wob = reducedMotion ? 0 : Math.sin(t * 2.2 + m.phase) * 0.012
      m.root.position.set(stage[`m${i}x`] * viewW, (stage[`m${i}y`] + wob) * viewH, 0.4)
      m.root.scale.setScalar(s * base)
      m.state.look.set(0.6, 0)
      m.state.glow = 1.2
      m.update(t + m.phase, dt)
    })

    if (!reducedMotion) {
      const p = dust.geometry.attributes.position
      for (let i = 0; i < dustCount; i++) {
        p.array[i * 3 + 1] += Math.sin(t * 0.4 + dustSeed[i]) * 0.0015 + 0.0012
        if (p.array[i * 3 + 1] > 5) p.array[i * 3 + 1] = -5
      }
      p.needsUpdate = true
    }

    if (onWarm && Math.abs(stage.warm - lastWarm) > 0.002) {
      lastWarm = stage.warm
      onWarm(stage.warm)
    }

    renderer.render(scene, camera)
  }
  frame()

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
  })
  io.observe(container)

  return {
    stage,
    get presets() {
      return presets
    },
    dispose() {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      window.removeEventListener('pointermove', onPointer)
      mote.dispose()
      minis.forEach((m) => m.dispose())
      dust.geometry.dispose()
      dust.material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
