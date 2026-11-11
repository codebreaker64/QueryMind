import * as THREE from 'three'

/**
 * Mote: QueryMind's mascot, modelled from primitives so each part can be
 * animated on its own (eyes blink, arms wave, antenna bead pulses).
 * Built to match the concept art in docs/design/mote-concept.jpg.
 */

const PALETTE = {
  bodyTop: new THREE.Color('#ff9d45'),
  bodyBottom: new THREE.Color('#ffd470'),
  emissive: new THREE.Color('#ff8a2e'),
  sheen: new THREE.Color('#fff1c9'),
  eye: new THREE.Color('#1b120c'),
  bead: new THREE.Color('#ffd98a'),
  cheek: '#ff7f7a',
}

// Droplet profile: wide, soft bottom; narrower crown.
function profileRadius(t) {
  // t in [0, PI]: 0 = bottom pole, PI = top pole
  const y = -Math.cos(t)
  const crown = Math.max(0, y)
  const belly = Math.max(0, -y)
  return Math.sin(t) * (1 - 0.3 * Math.pow(crown, 1.4) + 0.06 * belly)
}
function profileY(t) {
  const y = -Math.cos(t)
  return y < 0 ? y * 0.86 : y * 1.08
}

function bodySurface(t, theta) {
  const r = profileRadius(t)
  return new THREE.Vector3(Math.sin(theta) * r, profileY(t), Math.cos(theta) * r)
}

function bodyNormal(t, theta) {
  const e = 0.002
  const p = bodySurface(t, theta)
  const pt = bodySurface(t + e, theta).sub(p)
  const pth = bodySurface(t, theta + e).sub(p)
  return new THREE.Vector3().crossVectors(pth, pt).normalize()
}

function radialTexture(inner, outer, size = 128) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, inner)
  grad.addColorStop(1, outer)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function placeOnBody(mesh, t, theta, lift = 0) {
  const p = bodySurface(t, theta)
  const n = bodyNormal(t, theta)
  mesh.position.copy(p).addScaledVector(n, lift)
  mesh.lookAt(mesh.position.clone().add(n))
  return mesh
}

export function createMote({ detail = 64 } = {}) {
  const root = new THREE.Group()
  root.name = 'Mote'
  const rig = new THREE.Group() // squash/stretch + tilt pivot
  root.add(rig)

  // ── Body ──────────────────────────────────────────────
  const pts = []
  const steps = 48
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI
    pts.push(new THREE.Vector2(Math.max(profileRadius(t), 0.0001), profileY(t)))
  }
  const bodyGeo = new THREE.LatheGeometry(pts, detail)
  const colors = []
  const pos = bodyGeo.attributes.position
  const tmp = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const k = THREE.MathUtils.smoothstep(pos.getY(i), -0.9, 1.0)
    tmp.copy(PALETTE.bodyBottom).lerp(PALETTE.bodyTop, k)
    colors.push(tmp.r, tmp.g, tmp.b)
  }
  bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  bodyGeo.computeVertexNormals()

  const bodyMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.45,
    sheen: 1,
    sheenColor: PALETTE.sheen,
    sheenRoughness: 0.5,
    emissive: PALETTE.emissive,
    emissiveIntensity: 0.55,
  })
  // Soft inner glow: brighten the rim and the belly, like light through frosted glass.
  bodyMat.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = { value: 1 }
    bodyMat.userData.shader = shader
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGlow;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float rim = 1.0 - clamp(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
        totalEmissiveRadiance += vec3(1.0, 0.55, 0.18) * pow(rim, 2.0) * 0.7 * uGlow;
        totalEmissiveRadiance += vec3(1.0, 0.78, 0.35) * vColor.g * 0.22 * uGlow;`
      )
  }
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.name = 'body'
  rig.add(body)

  // ── Face ──────────────────────────────────────────────
  const face = new THREE.Group()
  face.name = 'face'
  rig.add(face)

  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: PALETTE.eye,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  })
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const eyes = []
  for (const side of [-1, 1]) {
    const eye = new THREE.Group()
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), eyeMat)
    ball.scale.set(0.105, 0.135, 0.06)
    eye.add(ball)
    const shine = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), shineMat)
    shine.scale.setScalar(0.03)
    shine.position.set(0.035 * -side + 0.02, 0.05, 0.05)
    eye.add(shine)
    placeOnBody(eye, 1.86, side * 0.27, 0.0)
    eye.name = side < 0 ? 'eyeLeft' : 'eyeRight'
    face.add(eye)
    eyes.push(eye)
  }

  const smileMat = new THREE.MeshBasicMaterial({ color: PALETTE.eye })
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.013, 8, 24, Math.PI * 0.85), smileMat)
  const smilePivot = new THREE.Group()
  smilePivot.add(smile)
  smile.rotation.z = Math.PI + Math.PI * 0.075
  placeOnBody(smilePivot, 1.66, 0, 0.004)
  face.add(smilePivot)

  const cheekTex = radialTexture('rgba(255,120,120,0.55)', 'rgba(255,120,120,0)')
  const cheekMat = new THREE.MeshBasicMaterial({ map: cheekTex, transparent: true, depthWrite: false })
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.17), cheekMat)
    placeOnBody(cheek, 1.66, side * 0.5, 0.008)
    face.add(cheek)
  }

  // ── Arms ──────────────────────────────────────────────
  const armMat = bodyMat
  const arms = []
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group()
    const p = bodySurface(1.3, side * 1.45)
    shoulder.position.copy(p).multiplyScalar(0.93)
    const arm = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), armMat)
    arm.scale.set(0.21, 0.15, 0.15)
    arm.position.set(side * 0.19, -0.01, 0.03)
    shoulder.add(arm)
    shoulder.rotation.z = side * -0.35
    shoulder.name = side < 0 ? 'armLeft' : 'armRight'
    shoulder.userData.side = side
    rig.add(shoulder)
    arms.push(shoulder)
  }

  // ── Antenna ───────────────────────────────────────────
  const antenna = new THREE.Group()
  antenna.position.set(0, 1.0, 0)
  rig.add(antenna)
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.08, 0),
    new THREE.Vector3(0.01, 0.22, 0),
    new THREE.Vector3(0.09, 0.46, 0.01),
    new THREE.Vector3(0.27, 0.56, 0.02),
    new THREE.Vector3(0.42, 0.5, 0.03),
  ])
  const stalk = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.05, 12, false), bodyMat)
  antenna.add(stalk)
  const beadMat = new THREE.MeshStandardMaterial({
    color: PALETTE.bead,
    emissive: PALETTE.bead,
    emissiveIntensity: 2.2,
    roughness: 0.3,
  })
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), beadMat)
  bead.position.copy(curve.getPoint(1)).add(new THREE.Vector3(0.02, -0.04, 0))
  antenna.add(bead)
  const beadGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: radialTexture('rgba(255,214,140,0.9)', 'rgba(255,190,90,0)'),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  )
  beadGlow.scale.setScalar(0.6)
  beadGlow.position.copy(bead.position)
  antenna.add(beadGlow)

  // ── Light & atmosphere ────────────────────────────────
  const innerLight = new THREE.PointLight('#ffb35a', 2.2, 4, 1.6)
  innerLight.position.set(0, -0.1, 0.4)
  rig.add(innerLight)

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: radialTexture('rgba(255,150,50,0.32)', 'rgba(255,120,40,0)'),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  )
  halo.scale.setScalar(4.2)
  halo.position.set(0, 0, -0.6)
  root.add(halo)

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 0.5),
    new THREE.MeshBasicMaterial({
      map: radialTexture('rgba(255,170,90,0.35)', 'rgba(255,170,90,0)'),
      transparent: true,
      depthWrite: false,
    })
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -1.35
  root.add(shadow)

  // ── Behaviour ─────────────────────────────────────────
  const state = {
    glow: 1, // drives emissive + halo
    wave: 0, // 0..1 how much the right arm waves
    tilt: 0, // head tilt (curious)
    look: new THREE.Vector2(0, 0), // -1..1 gaze target
    bob: 1, // idle float amount
  }
  let nextBlink = 1.5
  let blinkT = -1

  function update(time, dt) {
    // Idle float + breathing squash
    const bob = Math.sin(time * 1.6) * 0.07 * state.bob
    rig.position.y = bob
    const breathe = 1 + Math.sin(time * 1.6 + 1.2) * 0.018 * state.bob
    rig.scale.set(1 / Math.sqrt(breathe), breathe, 1 / Math.sqrt(breathe))
    shadow.scale.setScalar(1 - bob * 0.8)

    // Gaze & tilt: turn the whole rig a little toward the look target
    rig.rotation.y += (state.look.x * 0.45 - rig.rotation.y) * Math.min(1, dt * 4)
    rig.rotation.x += (-state.look.y * 0.18 - rig.rotation.x) * Math.min(1, dt * 4)
    rig.rotation.z += (state.tilt - rig.rotation.z) * Math.min(1, dt * 5)

    // Blink
    if (time > nextBlink && blinkT < 0) blinkT = 0
    if (blinkT >= 0) {
      blinkT += dt
      const k = blinkT < 0.07 ? 1 - blinkT / 0.07 : Math.min(1, (blinkT - 0.07) / 0.09)
      for (const e of eyes) e.scale.y = Math.max(0.08, k)
      if (blinkT > 0.16) {
        blinkT = -1
        for (const e of eyes) e.scale.y = 1
        nextBlink = time + 2 + Math.random() * 3.5
      }
    }

    // Arms: gentle sway, plus a wave on the right arm
    for (const arm of arms) {
      const side = arm.userData.side
      let z = side * -0.35 + Math.sin(time * 1.6 + side) * 0.08
      if (side > 0 && state.wave > 0) z = THREE.MathUtils.lerp(z, 1.7 + Math.sin(time * 8) * 0.35, state.wave)
      arm.rotation.z = z
    }

    // Antenna sway & bead pulse
    antenna.rotation.z = Math.sin(time * 1.3) * 0.08
    antenna.rotation.x = Math.sin(time * 1.1 + 0.5) * 0.05
    const pulse = 0.85 + Math.sin(time * 3) * 0.15
    beadMat.emissiveIntensity = 2.2 * pulse * state.glow
    beadGlow.scale.setScalar(0.55 * pulse * (0.7 + 0.3 * state.glow))

    // Glow level
    bodyMat.emissiveIntensity = 0.55 * state.glow
    if (bodyMat.userData.shader) bodyMat.userData.shader.uniforms.uGlow.value = state.glow
    halo.material.opacity = Math.min(1, 0.55 + 0.45 * state.glow)
    halo.scale.setScalar(2.6 + state.glow * 0.7)
    innerLight.intensity = 2.2 * state.glow
  }

  function dispose() {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) {
          if (m.map) m.map.dispose()
          m.dispose()
        }
      }
    })
  }

  return { root, rig, state, update, dispose, parts: { body, eyes, arms, antenna, bead, halo, shadow } }
}
