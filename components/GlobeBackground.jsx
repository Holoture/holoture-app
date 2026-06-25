'use client'

/**
 * GlobeBackground — flat, technical grid-tile Earth for a fixed page background.
 *
 * Two-colour graphic style: #009BFF continents cut into a uniform lat/long grid
 * of tiles, flat #0a0f1e oceans, faint starfield. No glow, no atmosphere, no
 * ring, no pins/labels. MeshBasicMaterial only (unlit, flat colour).
 *
 * Self-contained: generates its own canvas texture from a land mask, needs no
 * props, and disposes all GPU resources on unmount.
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

const OCEAN = '#0a0f1e'
const LAND = '#009BFF'
const GRID_DEGREES = 4         // tile size in degrees of lat/long
const LAND_LUMA_THRESHOLD = 24 // luminance above which a source pixel is "land"

// Equirectangular dark Earth (gray continents on near-black oceans) — thresholded
// into a land/ocean mask. From the three.js / three-globe examples (CORS-enabled).
const EARTH_MASK_URL = 'https://unpkg.com/three-globe/example/img/earth-dark.jpg'

// ── Grid-tile land/ocean texture ────────────────────────────────────────────────
function buildGlobeTexture(onReady) {
  const w = 2048
  const h = 1024
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  // Immediate ocean fill so something renders before the mask loads.
  ctx.fillStyle = OCEAN
  ctx.fillRect(0, 0, w, h)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4

  function overlayGrid() {
    ctx.strokeStyle = OCEAN
    ctx.lineWidth = 2
    const step = (w * GRID_DEGREES) / 360 // equal px in x and y (2:1 canvas)
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
    const ocean = [10, 15, 30]   // #0a0f1e
    const land = [0, 155, 255]   // #009BFF
    for (let i = 0; i < d.length; i += 4) {
      const luma = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]
      const c = luma > LAND_LUMA_THRESHOLD ? land : ocean
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255
    }
    ctx.putImageData(out, 0, 0)
    overlayGrid()
  }

  // Crude continent fallback if the mask can't be fetched/read (CORS/CSP/offline).
  function drawFallback() {
    ctx.fillStyle = OCEAN
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = LAND
    const blobs = [
      [360, 360, 230, 150], [520, 560, 130, 170],   // Americas
      [1050, 360, 150, 110], [1120, 560, 170, 200],  // Europe / Africa
      [1450, 420, 320, 180], [1650, 720, 130, 90],   // Asia / Oceania
    ]
    for (const [x, y, rx, ry] of blobs) {
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TWO_PI); ctx.fill()
    }
    overlayGrid()
  }

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    try { drawFromMask(img) } catch { drawFallback() }
    tex.needsUpdate = true
    onReady && onReady()
  }
  img.onerror = () => {
    drawFallback()
    tex.needsUpdate = true
    onReady && onReady()
  }
  img.src = EARTH_MASK_URL

  return tex
}

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
    const staticMode = prefersReducedMotion()

    // ── Renderer / scene / camera ──────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0x0a0f1e, 1)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200)

    const group = new THREE.Group()
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
      color: 0xffffff,
      size: 0.12,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    const stars = new THREE.Points(starGeo, starMat)
    scene.add(stars)

    // ── Globe (flat, unlit grid-tile texture) ──────────────────────────────────────
    const renderOnce = () => renderer.render(scene, camera)
    const globeTex = buildGlobeTexture(() => { if (staticMode) renderOnce() })
    const globeGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 96, 96)
    const globeMat = new THREE.MeshBasicMaterial({ map: globeTex })
    const globe = new THREE.Mesh(globeGeo, globeMat)
    group.add(globe)

    // ── Layout / sizing ────────────────────────────────────────────────────────────
    function frameCamera() {
      camera.aspect = width / height
      const vFov = THREE.MathUtils.degToRad(camera.fov)
      const dist = GLOBE_RADIUS / (VIEWPORT_FRACTION * Math.tan(vFov / 2))
      camera.position.set(0, 0, dist)
      camera.lookAt(0, 0, 0)
      group.position.x = position === 'right' ? GLOBE_RADIUS * 0.55 : 0
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
      group.rotation.y = -0.5
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
      globeGeo.dispose(); globeMat.dispose(); globeTex.dispose()
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
