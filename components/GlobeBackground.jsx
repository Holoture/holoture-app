'use client'

/**
 * GlobeBackground — flat grid-tile Earth with a neon rim glow, a tilted orbital
 * ring, and the Holoture bull running around the ring. Fixed page background.
 *
 * Self-contained: builds its own canvas textures, needs no props, disposes all
 * GPU resources on unmount.
 *
 * Props (all optional):
 *   rotationSpeed  number  full globe turns per one full page scroll   (default 1)
 *   idleSpeed      number  idle auto-rotation in radians/second        (default 0.03)
 *   bullSpeed      number  bull ring travel in radians/second          (default 2π/9 ≈ one lap / 9s)
 *   opacity        number  overall canvas opacity 0–1                  (default 0.85)
 *   position       string  'center' | 'right'                          (default 'right')
 */

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const TWO_PI = Math.PI * 2
const GLOBE_RADIUS = 1
const RING_RADIUS = GLOBE_RADIUS * 1.34   // sits just outside the globe
const RING_TILT_DEG = 20
const VIEWPORT_FRACTION = 0.78            // globe diameter ≈ 78% of viewport height
const LERP = 0.07                         // rotation easing toward target
const DEFAULT_LAP_SECONDS = 9             // one bull lap ≈ 9s

const OCEAN = '#0a0f1e'
const LAND = '#009BFF'
const GRID_DEGREES = 4
const LAND_LUMA_THRESHOLD = 24

const EARTH_MASK_URL = 'https://unpkg.com/three-globe/example/img/earth-dark.jpg'
const BULL_URL = '/bull-logo.png' // same-origin asset in /public

// ── Grid-tile land/ocean texture (thresholded land mask + lat/long grid) ────────
function buildGlobeTexture(onReady) {
  const w = 2048, h = 1024
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = OCEAN
  ctx.fillRect(0, 0, w, h)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4

  function overlayGrid() {
    ctx.strokeStyle = OCEAN
    ctx.lineWidth = 2
    const step = (w * GRID_DEGREES) / 360
    for (let x = 0; x <= w; x += step) {
      ctx.beginPath(); ctx.moveTo(Math.round(x), 0); ctx.lineTo(Math.round(x), h); ctx.stroke()
    }
    for (let y = 0; y <= h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, Math.round(y)); ctx.lineTo(w, Math.round(y)); ctx.stroke()
    }
  }
  function drawFromMask(img) {
    const tmp = document.createElement('canvas')
    tmp.width = w; tmp.height = h
    const tctx = tmp.getContext('2d')
    tctx.drawImage(img, 0, 0, w, h)
    const src = tctx.getImageData(0, 0, w, h).data
    const out = ctx.getImageData(0, 0, w, h)
    const d = out.data
    const ocean = [10, 15, 30], land = [0, 155, 255]
    for (let i = 0; i < d.length; i += 4) {
      const luma = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]
      const c = luma > LAND_LUMA_THRESHOLD ? land : ocean
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255
    }
    ctx.putImageData(out, 0, 0)
    overlayGrid()
  }
  function drawFallback() {
    ctx.fillStyle = OCEAN; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = LAND
    const blobs = [
      [360, 360, 230, 150], [520, 560, 130, 170],
      [1050, 360, 150, 110], [1120, 560, 170, 200],
      [1450, 420, 320, 180], [1650, 720, 130, 90],
    ]
    for (const [x, y, rx, ry] of blobs) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TWO_PI); ctx.fill() }
    overlayGrid()
  }

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => { try { drawFromMask(img) } catch { drawFallback() } tex.needsUpdate = true; onReady && onReady() }
  img.onerror = () => { drawFallback(); tex.needsUpdate = true; onReady && onReady() }
  img.src = EARTH_MASK_URL
  return tex
}

// ── Bull texture: knock out the near-white background → transparent ──────────────
function buildBullTexture(onReady) {
  // 1×1 transparent placeholder until the image loads.
  const canvas = document.createElement('canvas')
  canvas.width = 1; canvas.height = 1
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  let aspect = 1

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    aspect = img.naturalWidth / img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    try {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = data.data
      for (let i = 0; i < d.length; i += 4) {
        // Near-white → fully transparent (keep the cyan bull shape).
        if (d[i] > 228 && d[i + 1] > 228 && d[i + 2] > 228) d[i + 3] = 0
      }
      ctx.putImageData(data, 0, 0)
    } catch {/* tainted canvas — leave as-is */}
    tex.image = canvas
    tex.needsUpdate = true
    onReady && onReady(aspect)
  }
  img.onerror = () => { onReady && onReady(aspect) }
  img.src = BULL_URL
  return { tex, getAspect: () => aspect }
}

const ATMOSPHERE_VERT = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
// Sharp neon rim: steep fresnel so only the very limb lights up.
const ATMOSPHERE_FRAG = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    float rim = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
    float intensity = pow(rim, 5.0);
    gl_FragColor = vec4(0.0, 0.607, 1.0, intensity);
  }
`

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function GlobeBackground({
  rotationSpeed = 1,
  idleSpeed = 0.03,
  bullSpeed = TWO_PI / DEFAULT_LAP_SECONDS,
  opacity = 0.85,
  position = 'right',
}) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let width = mount.clientWidth || window.innerWidth
    let height = mount.clientHeight || window.innerHeight
    const staticMode = prefersReducedMotion()

    // ── Renderer / scene / camera ──────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0x0a0f1e, 1)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200)
    const renderOnce = () => renderer.render(scene, camera)

    const group = new THREE.Group() // scroll/idle Y rotation applies here
    scene.add(group)

    // ── Starfield ────────────────────────────────────────────────────────────────
    const starCount = 1400
    const starPos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      const rr = 40 + Math.random() * 50
      const t = Math.random() * TWO_PI
      const p = Math.acos(2 * Math.random() - 1)
      starPos[i * 3] = rr * Math.sin(p) * Math.cos(t)
      starPos[i * 3 + 1] = rr * Math.sin(p) * Math.sin(t)
      starPos[i * 3 + 2] = rr * Math.cos(p)
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.12, sizeAttenuation: true,
      transparent: true, opacity: 0.55, depthWrite: false,
    })
    const stars = new THREE.Points(starGeo, starMat)
    scene.add(stars)

    // ── Globe (flat grid-tile) ──────────────────────────────────────────────────────
    const globeTex = buildGlobeTexture(() => { if (staticMode) renderOnce() })
    const globeGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 96, 96)
    const globeMat = new THREE.MeshBasicMaterial({ map: globeTex })
    const globe = new THREE.Mesh(globeGeo, globeMat)
    group.add(globe)

    // ── Rim glow ──────────────────────────────────────────────────────────────────
    const glowGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.06, 96, 96)
    const glowMat = new THREE.ShaderMaterial({
      vertexShader: ATMOSPHERE_VERT,
      fragmentShader: ATMOSPHERE_FRAG,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    })
    const glow = new THREE.Mesh(glowGeo, glowMat)
    group.add(glow)

    // ── Orbital ring (tilted ~20° on X) ────────────────────────────────────────────
    const ringGroup = new THREE.Group()
    ringGroup.rotation.x = THREE.MathUtils.degToRad(RING_TILT_DEG)
    group.add(ringGroup)

    const ringGeo = new THREE.TorusGeometry(RING_RADIUS, 0.006, 16, 240)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x009bff, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2 // lay the torus flat (circle in the ringGroup XZ plane)
    ringGroup.add(ring)

    // ── Bull sprite on the ring ──────────────────────────────────────────────────────
    const BULL_HEIGHT = GLOBE_RADIUS * 0.18 // ~9% of globe diameter
    const { tex: bullTex } = buildBullTexture((aspect) => {
      bullSprite.scale.set(BULL_HEIGHT * aspect, BULL_HEIGHT, 1)
      bullBaseW = BULL_HEIGHT * aspect
      bullBaseH = BULL_HEIGHT
      if (staticMode) renderOnce()
    })
    const bullMat = new THREE.SpriteMaterial({ map: bullTex, transparent: true, depthTest: true })
    const bullSprite = new THREE.Sprite(bullMat)
    let bullBaseW = BULL_HEIGHT
    let bullBaseH = BULL_HEIGHT
    bullSprite.scale.set(BULL_HEIGHT, BULL_HEIGHT, 1)
    ringGroup.add(bullSprite)

    // ── Layout / sizing ────────────────────────────────────────────────────────────
    function frameCamera() {
      camera.aspect = width / height
      const vFov = THREE.MathUtils.degToRad(camera.fov)
      const dist = GLOBE_RADIUS / (VIEWPORT_FRACTION * Math.tan(vFov / 2)) + 0.6
      camera.position.set(0, 0, dist)
      camera.lookAt(0, 0, 0)
      group.position.x = position === 'right' ? GLOBE_RADIUS * 0.55 : 0
      camera.updateProjectionMatrix()
    }
    frameCamera()

    // ── Rotation + bull travel ────────────────────────────────────────────────────────
    let idleAngle = 0
    let currentY = 0
    let bullAngle = staticMode ? 0.6 : 0
    const clock = new THREE.Clock()
    const wPos = new THREE.Vector3()
    const wAhead = new THREE.Vector3()
    const ndcA = new THREE.Vector3()
    const ndcB = new THREE.Vector3()

    function scrollProgress() {
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (max <= 0) return 0
      return Math.min(1, Math.max(0, window.scrollY / max))
    }

    function placeBull() {
      // Position on the ring circle (ringGroup local XZ plane).
      wPos.set(RING_RADIUS * Math.cos(bullAngle), 0, RING_RADIUS * Math.sin(bullAngle))
      bullSprite.position.copy(wPos)

      // World positions of current + slightly-ahead point for the screen tangent.
      wPos.copy(bullSprite.position); ringGroup.localToWorld(wPos)
      wAhead.set(RING_RADIUS * Math.cos(bullAngle + 0.04), 0, RING_RADIUS * Math.sin(bullAngle + 0.04))
      ringGroup.localToWorld(wAhead)

      // Cull when on the far side (behind the globe).
      bullSprite.visible = wPos.z > 0.02

      // Screen-space tangent → in-plane sprite rotation so it runs along the ring.
      ndcA.copy(wPos).project(camera)
      ndcB.copy(wAhead).project(camera)
      const dx = (ndcB.x - ndcA.x) * width
      const dy = (ndcB.y - ndcA.y) * height
      let rot = Math.atan2(dy, dx) // CCW, NDC y-up
      // Art faces left → flip horizontally so the bull faces its travel direction.
      let sx = -bullBaseW
      let sy = bullBaseH
      // Keep it upright on arcs where it would otherwise be upside-down.
      if (Math.cos(rot) < 0) { sy = -bullBaseH }
      bullMat.rotation = rot
      bullSprite.scale.set(sx, sy, 1)
    }

    let raf = 0
    function animate() {
      raf = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.05)

      idleAngle += idleSpeed * dt
      const target = -(scrollProgress() * TWO_PI * rotationSpeed) - idleAngle
      currentY += (target - currentY) * LERP
      group.rotation.y = currentY

      bullAngle = (bullAngle + bullSpeed * dt) % TWO_PI
      placeBull()

      renderer.render(scene, camera)
    }

    if (staticMode) {
      group.rotation.y = -0.5
      placeBull()
      renderOnce()
    } else {
      animate()
    }

    // ── Resize ───────────────────────────────────────────────────────────────────────
    function onResize() {
      width = mount.clientWidth || window.innerWidth
      height = mount.clientHeight || window.innerHeight
      renderer.setSize(width, height)
      frameCamera()
      if (staticMode) { placeBull(); renderOnce() }
    }
    window.addEventListener('resize', onResize)

    // ── Cleanup ────────────────────────────────────────────────────────────────────
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      globeGeo.dispose(); globeMat.dispose(); globeTex.dispose()
      glowGeo.dispose(); glowMat.dispose()
      ringGeo.dispose(); ringMat.dispose()
      starGeo.dispose(); starMat.dispose()
      bullMat.dispose(); bullTex.dispose()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  }, [rotationSpeed, idleSpeed, bullSpeed, position])

  return (
    <div
      ref={mountRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        opacity,
        pointerEvents: 'none',
        backgroundColor: '#0a0f1e',
      }}
    />
  )
}
