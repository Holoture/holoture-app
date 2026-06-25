'use client'

/**
 * GlobeBackground — an animated 3D heat-map globe for use as a fixed page
 * background. Self-contained: generates its own procedural texture, needs no
 * props, and cleans up all GPU resources on unmount.
 *
 * Props (all optional):
 *   rotationSpeed  number  full globe turns per one full page scroll      (default 1)
 *   idleSpeed      number  idle auto-rotation in radians/second           (default 0.03)
 *   opacity        number  overall canvas opacity 0–1                     (default 0.85)
 *   position       string  'center' | 'right'                             (default 'right')
 */

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const TWO_PI = Math.PI * 2

// City nodes: [name, latitude, longitude, percentChange]
const CITIES = [
  { name: 'New York',  lat: 40.71, lon: -74.0,  pct: '+0.72%', off: [-150, -34] },
  { name: 'London',    lat: 51.51, lon: -0.13,  pct: '+0.38%', off: [40, -90] },
  { name: 'Frankfurt', lat: 50.11, lon: 8.68,   pct: '+0.27%', off: [120, -50] },
  { name: 'Tokyo',     lat: 35.68, lon: 139.65, pct: '+1.25%', off: [140, -10] },
  { name: 'Hong Kong', lat: 22.32, lon: 114.17, pct: '+0.81%', off: [120, 60] },
]

const GLOBE_RADIUS = 1
const VIEWPORT_FRACTION = 0.78 // globe diameter ≈ 78% of viewport height
const LERP = 0.07              // rotation easing toward target

// ── Procedural heat-map texture (green/red glowing tiles + faint grid) ──────────
function makeHeatTexture() {
  const w = 2048
  const h = 1024
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d')

  // Base
  ctx.fillStyle = '#03070f'
  ctx.fillRect(0, 0, w, h)

  // Faint lat/long grid (wireframe feel)
  ctx.strokeStyle = 'rgba(0,155,255,0.10)'
  ctx.lineWidth = 1
  const cols = 48
  const rows = 24
  for (let c = 0; c <= cols; c++) {
    const x = (c / cols) * w
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let r = 0; r <= rows; r++) {
    const y = (r / rows) * h
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }

  // Scattered glowing heat tiles
  const cellW = w / cols
  const cellH = h / rows
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      // Thin out toward the poles so it doesn't smear at the top/bottom.
      const polar = Math.sin((r / rows) * Math.PI)
      if (Math.random() > 0.22 * polar + 0.04) continue

      const up = Math.random() > 0.5
      const fill = up ? '29,158,117' : '226,75,74'      // #1D9E75 / #E24B4A
      const a = 0.35 + Math.random() * 0.5
      const pad = 2
      const x = c * cellW + pad
      const y = r * cellH + pad
      const tw = cellW - pad * 2
      const th = cellH - pad * 2

      ctx.fillStyle = `rgba(${fill},${a})`
      ctx.fillRect(x, y, tw, th)
      // Glowing edge
      ctx.strokeStyle = `rgba(${fill},${Math.min(1, a + 0.35)})`
      ctx.lineWidth = 1.5
      ctx.strokeRect(x + 0.5, y + 0.5, tw - 1, th - 1)
    }
  }

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

// lat/long (degrees) → position on a sphere of the given radius
function latLonToVec3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
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

    // ── Renderer / scene / camera ──────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)

    const group = new THREE.Group() // holds globe + ring + nodes; rotates as a unit
    scene.add(group)

    // ── Globe ────────────────────────────────────────────────────────────────────
    const heatTex = makeHeatTexture()
    const globeGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 96, 96)
    const globeMat = new THREE.MeshBasicMaterial({ map: heatTex })
    const globe = new THREE.Mesh(globeGeo, globeMat)
    group.add(globe)

    // ── Atmosphere edge glow ──────────────────────────────────────────────────────
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
    scene.add(atmosphere) // not in group → glow stays put as globe spins

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

    // ── City nodes (small bright spheres, parented to the globe so they spin) ──────
    const nodeGeo = new THREE.SphereGeometry(0.018, 16, 16)
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0x66ccff })
    const nodeMeshes = CITIES.map((city) => {
      const m = new THREE.Mesh(nodeGeo, nodeMat)
      m.position.copy(latLonToVec3(city.lat, city.lon, GLOBE_RADIUS * 1.01))
      group.add(m)
      return m
    })

    // ── HTML overlay: connector lines (SVG) + labels ──────────────────────────────
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;'
    mount.appendChild(overlay)

    const svgNS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(svgNS, 'svg')
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;'
    overlay.appendChild(svg)

    const labelEls = CITIES.map((city) => {
      const line = document.createElementNS(svgNS, 'line')
      line.setAttribute('stroke', 'rgba(255,255,255,0.55)')
      line.setAttribute('stroke-width', '1')
      svg.appendChild(line)

      const label = document.createElement('div')
      label.style.cssText =
        'position:absolute;transform:translate(-50%,-50%);white-space:nowrap;' +
        'font-family:var(--font-mono-data),ui-monospace,monospace;font-size:12px;' +
        'line-height:1.25;text-shadow:0 1px 4px rgba(0,0,0,0.9);'
      label.innerHTML =
        `<div style="color:#fff;font-weight:600">${city.name}</div>` +
        `<div style="color:#1D9E75">${city.pct}</div>`
      overlay.appendChild(label)

      return { line, label }
    })

    // ── Layout / sizing ────────────────────────────────────────────────────────────
    function frameCamera() {
      camera.aspect = width / height
      // Distance so the globe's diameter spans VIEWPORT_FRACTION of view height.
      const vFov = THREE.MathUtils.degToRad(camera.fov)
      const dist = (GLOBE_RADIUS) / (VIEWPORT_FRACTION * Math.tan(vFov / 2))
      camera.position.set(0, 0, dist)
      camera.lookAt(0, 0, 0)

      // Shift everything left so the globe sits right-of-centre (in world units,
      // a fraction of the radius reads well across sizes).
      const shift = position === 'right' ? GLOBE_RADIUS * 0.55 : 0
      group.position.x = shift
      atmosphere.position.x = shift
      ring.position.x = shift

      camera.updateProjectionMatrix()
    }
    frameCamera()

    // ── Rotation state ──────────────────────────────────────────────────────────────
    let idleAngle = 0
    let currentY = 0
    const clock = new THREE.Clock()
    const tmp = new THREE.Vector3()

    function scrollProgress() {
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (max <= 0) return 0
      return Math.min(1, Math.max(0, window.scrollY / max))
    }

    // ── Animation loop ───────────────────────────────────────────────────────────────
    let raf = 0
    function animate() {
      raf = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.05)

      idleAngle += idleSpeed * dt
      // Scroll down → rotate clockwise from above (negative Y). Flip via rotationSpeed sign.
      const target = -(scrollProgress() * TWO_PI * rotationSpeed) - idleAngle
      currentY += (target - currentY) * LERP
      group.rotation.y = currentY

      renderer.render(scene, camera)

      // Project nodes → screen for labels/connectors
      for (let i = 0; i < nodeMeshes.length; i++) {
        const node = nodeMeshes[i]
        node.getWorldPosition(tmp)
        // Near-side test: is the node facing the camera?
        const toCam = tmp.clone().sub(camera.position)
        const facing = tmp.clone().sub(group.position).normalize().dot(toCam.normalize()) < 0
        tmp.project(camera)
        const sx = (tmp.x * 0.5 + 0.5) * width
        const sy = (-tmp.y * 0.5 + 0.5) * height
        const { line, label } = labelEls[i]
        const visible = facing && tmp.z < 1
        if (!visible) {
          line.style.display = 'none'
          label.style.display = 'none'
          continue
        }
        line.style.display = ''
        label.style.display = ''
        const [dx, dy] = CITIES[i].off
        const lx = sx + dx
        const ly = sy + dy
        line.setAttribute('x1', sx); line.setAttribute('y1', sy)
        line.setAttribute('x2', lx); line.setAttribute('y2', ly)
        label.style.left = `${lx}px`
        label.style.top = `${ly}px`
      }
    }
    animate()

    // ── Resize ───────────────────────────────────────────────────────────────────────
    function onResize() {
      width = mount.clientWidth || window.innerWidth
      height = mount.clientHeight || window.innerHeight
      renderer.setSize(width, height)
      frameCamera()
    }
    window.addEventListener('resize', onResize)

    // ── Cleanup ────────────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      globeGeo.dispose(); globeMat.dispose(); heatTex.dispose()
      atmoGeo.dispose(); atmoMat.dispose()
      ringGeo.dispose(); ringMat.dispose()
      nodeGeo.dispose(); nodeMat.dispose()
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
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
        backgroundColor: '#000000',
      }}
    />
  )
}
