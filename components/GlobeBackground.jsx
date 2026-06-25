'use client'

/**
 * GlobeBackground — animated realistic-earth globe for a fixed page background.
 *
 * Layers: starfield · real earth texture (CDN) · soft heat-map data overlay ·
 * cyan atmosphere limb glow · tilted equatorial orbital ring. No pins/labels.
 *
 * Self-contained: generates its own overlay texture, needs no props, and
 * disposes all GPU resources on unmount.
 *
 * Props (all optional):
 *   rotationSpeed  number  full globe turns per one full page scroll   (default 1)
 *   idleSpeed      number  idle auto-rotation in radians/second        (default 0.03)
 *   opacity        number  overall canvas opacity 0–1                  (default 0.85)
 *   position       string  'center' | 'right'                          (default 'right')
 */

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const TWO_PI = Math.PI * 2
const GLOBE_RADIUS = 1
const VIEWPORT_FRACTION = 0.78 // globe diameter ≈ 78% of viewport height
const LERP = 0.07              // rotation easing toward target

// Dark-style earth texture (NASA / three.js example asset) — dark oceans, clear
// continent detail, ideal for a dark site background.
const EARTH_TEXTURE_URL = 'https://unpkg.com/three-globe/example/img/earth-dark.jpg'

// ── Soft heat-map overlay: blurred green/red radial blobs on transparent bg ─────
function makeHeatOverlayTexture() {
  const w = 2048
  const h = 1024
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d')
  ctx.clearRect(0, 0, w, h) // transparent base — earth shows through

  const blobs = 70
  for (let i = 0; i < blobs; i++) {
    // Bias toward mid-latitudes (where most land sits) and away from the poles.
    const y = h * (0.18 + Math.random() * 0.64)
    const x = Math.random() * w
    const radius = 50 + Math.random() * 130
    const green = Math.random() > 0.5
    const [r, g, b] = green ? [0, 232, 122] : [255, 80, 80] // #00e87a / #ff5050
    const peak = 0.32 + Math.random() * 0.18               // ~0.4–0.5 at centre

    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
    grad.addColorStop(0, `rgba(${r},${g},${b},${peak})`)
    grad.addColorStop(0.6, `rgba(${r},${g},${b},${peak * 0.4})`)
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, TWO_PI)
    ctx.fill()
  }

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

const ATMOSPHERE_VERT = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const ATMOSPHERE_FRAG = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
    gl_FragColor = vec4(0.0, 0.607, 1.0, 1.0) * intensity;
  }
`

function prefersReducedOrLowPower() {
  if (typeof window === 'undefined') return false
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const small = window.matchMedia('(max-width: 768px)').matches
  const lowPower =
    typeof navigator !== 'undefined' &&
    typeof navigator.hardwareConcurrency === 'number' &&
    navigator.hardwareConcurrency > 0 &&
    navigator.hardwareConcurrency <= 4
  return reduce || small || lowPower
}

export default function GlobeBackground({
  rotationSpeed = 1,
  idleSpeed = 0.03,
  opacity = 0.85,
  position = 'right',
}) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let width = mount.clientWidth || window.innerWidth
    let height = mount.clientHeight || window.innerHeight
    const staticMode = prefersReducedOrLowPower()

    // ── Renderer / scene / camera ──────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0x0a0f1e, 1) // dark space background
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200)

    const group = new THREE.Group() // earth + overlay; rotates as a unit
    scene.add(group)

    // ── Starfield ────────────────────────────────────────────────────────────────
    const starCount = 1400
    const starPos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      // Random points on a large shell behind the globe.
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
      color: 0xffffff,
      size: 0.12,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    })
    const stars = new THREE.Points(starGeo, starMat)
    scene.add(stars)

    // ── Earth ──────────────────────────────────────────────────────────────────────
    const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 96, 96)
    const earthMat = new THREE.MeshBasicMaterial({ color: 0x0b2034 }) // fallback tint
    const earth = new THREE.Mesh(earthGeo, earthMat)
    group.add(earth)

    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    let earthTex = null
    loader.load(
      EARTH_TEXTURE_URL,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
        earthTex = tex
        earthMat.color.set(0xffffff)
        earthMat.map = tex
        earthMat.needsUpdate = true
        if (staticMode) renderOnce()
      },
      undefined,
      () => {/* keep dark fallback tint on network/CORS failure */ if (staticMode) renderOnce() },
    )

    // ── Heat-map data overlay (slightly larger sphere) ────────────────────────────
    const heatTex = makeHeatOverlayTexture()
    const overlayGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.004, 96, 96)
    const overlayMat = new THREE.MeshBasicMaterial({
      map: heatTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.9,
    })
    const overlay = new THREE.Mesh(overlayGeo, overlayMat)
    group.add(overlay)

    // ── Atmosphere limb glow ──────────────────────────────────────────────────────
    const atmoGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.18, 96, 96)
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: ATMOSPHERE_VERT,
      fragmentShader: ATMOSPHERE_FRAG,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    })
    const atmosphere = new THREE.Mesh(atmoGeo, atmoMat)
    atmosphere.renderOrder = -1
    scene.add(atmosphere)

    // ── Orbital ring (equatorial torus, tilted ~15°) ──────────────────────────────
    const ringGeo = new THREE.TorusGeometry(GLOBE_RADIUS * 1.32, 0.006, 16, 220)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x009bff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2 + THREE.MathUtils.degToRad(15)
    scene.add(ring)

    // ── Layout / sizing ────────────────────────────────────────────────────────────
    function frameCamera() {
      camera.aspect = width / height
      const vFov = THREE.MathUtils.degToRad(camera.fov)
      const dist = GLOBE_RADIUS / (VIEWPORT_FRACTION * Math.tan(vFov / 2))
      camera.position.set(0, 0, dist)
      camera.lookAt(0, 0, 0)

      const shift = position === 'right' ? GLOBE_RADIUS * 0.55 : 0
      group.position.x = shift
      atmosphere.position.x = shift
      ring.position.x = shift

      camera.updateProjectionMatrix()
    }
    frameCamera()

    // ── Rotation + render ────────────────────────────────────────────────────────────
    let idleAngle = 0
    let currentY = 0
    const clock = new THREE.Clock()

    function scrollProgress() {
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (max <= 0) return 0
      return Math.min(1, Math.max(0, window.scrollY / max))
    }

    function renderOnce() {
      renderer.render(scene, camera)
    }

    let raf = 0
    function animate() {
      raf = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.05)
      idleAngle += idleSpeed * dt
      // Scroll down → clockwise from above (negative Y). Flip via rotationSpeed sign.
      const target = -(scrollProgress() * TWO_PI * rotationSpeed) - idleAngle
      currentY += (target - currentY) * LERP
      group.rotation.y = currentY
      renderer.render(scene, camera)
    }

    if (staticMode) {
      group.rotation.y = -0.5 // a pleasant fixed angle
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
      if (staticMode) renderOnce()
    }
    window.addEventListener('resize', onResize)

    // ── Cleanup ────────────────────────────────────────────────────────────────────
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      earthGeo.dispose(); earthMat.dispose(); if (earthTex) earthTex.dispose()
      overlayGeo.dispose(); overlayMat.dispose(); heatTex.dispose()
      atmoGeo.dispose(); atmoMat.dispose()
      ringGeo.dispose(); ringMat.dispose()
      starGeo.dispose(); starMat.dispose()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  }, [rotationSpeed, idleSpeed, position])

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
