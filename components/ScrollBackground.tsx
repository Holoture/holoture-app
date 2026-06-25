'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Layered parallax landing-page background.
 *
 *   L1 deep grid      — 0.10x scroll, slow rotate (perspective terminal grid)
 *   L2 candle clusters— ~0.25–0.40x scroll, slight horizontal drift
 *   L3 particle field — ~0.50/0.70x scroll, some with independent pulse
 *   L4 ring accents   — 0.80x scroll (fastest)
 *
 * Performance: only a handful of wrapper elements are transformed (one per
 * parallax speed), coalesced through a single rAF on a passive scroll listener,
 * so a frame does ~7 compositor-only `transform` writes — comfortably 60fps.
 *
 * Modes (decided client-side after mount):
 *   full — all four layers + parallax (desktop)
 *   lite — only L1 + L2 at reduced opacity, no L3/L4 (mobile/low-power)
 *   off  — reduced motion: static, no scroll listener, pulses disabled by CSS
 */

// Deterministic PRNG (mulberry32) so server and client generate identical
// layouts — no hydration mismatch despite "random-looking" placement.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Layer 1 — perspective grid (radial lines + concentric rings) ────────────────
function buildGrid() {
  const lines: { x2: number; y2: number }[] = []
  const R = 1100
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2
    lines.push({ x2: Math.cos(a) * R, y2: Math.sin(a) * R })
  }
  // Geometric ring sizes → denser near the centre vanishing point.
  const rings: number[] = []
  let s = 34
  while (s < 1200) {
    rings.push(s)
    s *= 1.42
  }
  return { lines, rings }
}
const GRID = buildGrid()

// ── Layer 2 — candlestick clusters ──────────────────────────────────────────────
type Candle = { up: boolean; bodyY: number; bodyH: number; wickY: number; wickH: number }
type Cluster = { left: number; top: number; opacity: number; sub: number; candles: Candle[] }

function buildClusters(): Cluster[] {
  const r = rng(20260625)
  const clusters: Cluster[] = []
  for (let c = 0; c < 22; c++) {
    const count = 6 + Math.floor(r() * 3) // 6–8 candles
    const candles: Candle[] = []
    for (let i = 0; i < count; i++) {
      const up = r() > 0.5
      const bodyH = 8 + r() * 26
      const bodyY = 14 + r() * (60 - bodyH)
      const wickH = bodyH + 8 + r() * 16
      const wickY = bodyY - (wickH - bodyH) / 2
      candles.push({ up, bodyY, bodyH, wickY, wickH })
    }
    clusters.push({
      left: r() * 92,
      top: r() * 98,
      opacity: 0.2 + r() * 0.1, // 20%–30%
      sub: c % 3, // assign to one of three parallax sub-layers
      candles,
    })
  }
  return clusters
}
const CLUSTERS = buildClusters()

// ── Layer 3 — particle field ────────────────────────────────────────────────────
type Particle = {
  kind: 'dot' | 'plus' | 'ticker'
  left: number
  top: number
  opacity: number
  sub: number // 0 → 0.5x, 1 → 0.7x
  pulse: boolean
  delay: number
  text?: string
}
const TICKERS = [
  'NVDA +2.4%', 'AAPL -0.8%', 'TSLA +1.2%', 'AMD +3.1%', 'MSFT +0.6%',
  'META -1.4%', 'GOOGL +0.9%', 'AMZN +1.7%', 'PLTR +4.2%', 'SMCI -2.1%',
  'COIN +5.3%', 'HOOD +2.8%',
]
function buildParticles(): Particle[] {
  const r = rng(70707)
  const out: Particle[] = []
  for (let i = 0; i < 135; i++) {
    const roll = r()
    const kind: Particle['kind'] = roll < 0.6 ? 'dot' : roll < 0.82 ? 'plus' : 'ticker'
    out.push({
      kind,
      left: r() * 98,
      top: r() * 98,
      opacity:
        kind === 'dot' ? 0.5 + r() * 0.2 : kind === 'plus' ? 0.25 : 0.18,
      sub: r() > 0.5 ? 1 : 0,
      pulse: r() > 0.65,
      delay: r() * 4,
      text: kind === 'ticker' ? TICKERS[Math.floor(r() * TICKERS.length)] : undefined,
    })
  }
  return out
}
const PARTICLES = buildParticles()

// ── Layer 4 — ring accents ──────────────────────────────────────────────────────
const RINGS = [
  { size: 520, left: 50, top: 12, center: true },  // behind hero headline
  { size: 360, left: 12, top: 28, center: false },
  { size: 440, left: 85, top: 40, center: false },
  { size: 300, left: 70, top: 55, center: false },
  { size: 480, left: 20, top: 70, center: false },
  { size: 340, left: 78, top: 84, center: false },
  { size: 400, left: 45, top: 95, center: false },
]

export default function ScrollBackground() {
  const [mode, setMode] = useState<'off' | 'lite' | 'full'>('full')

  const gridRef = useRef<HTMLDivElement>(null)
  const mid0Ref = useRef<HTMLDivElement>(null)
  const mid1Ref = useRef<HTMLDivElement>(null)
  const mid2Ref = useRef<HTMLDivElement>(null)
  const p0Ref = useRef<HTMLDivElement>(null)
  const p1Ref = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const small = window.matchMedia('(max-width: 768px)').matches
    const lowPower =
      typeof navigator !== 'undefined' &&
      typeof navigator.hardwareConcurrency === 'number' &&
      navigator.hardwareConcurrency > 0 &&
      navigator.hardwareConcurrency <= 4
    setMode(reduce ? 'off' : small || lowPower ? 'lite' : 'full')
  }, [])

  useEffect(() => {
    if (mode === 'off') return

    let raf = 0
    let y = window.scrollY
    const full = mode === 'full'

    const apply = () => {
      raf = 0
      if (gridRef.current)
        gridRef.current.style.transform =
          `translate3d(0, ${y * 0.1}px, 0) rotate(${y * 0.006}deg) scale(1.08)`
      if (mid0Ref.current) mid0Ref.current.style.transform = `translate3d(${y * 0.01}px, ${y * 0.25}px, 0)`
      if (mid1Ref.current) mid1Ref.current.style.transform = `translate3d(${-y * 0.012}px, ${y * 0.32}px, 0)`
      if (mid2Ref.current) mid2Ref.current.style.transform = `translate3d(${y * 0.008}px, ${y * 0.4}px, 0)`
      if (full) {
        if (p0Ref.current) p0Ref.current.style.transform = `translate3d(0, ${y * 0.5}px, 0)`
        if (p1Ref.current) p1Ref.current.style.transform = `translate3d(0, ${y * 0.7}px, 0)`
        if (ringRef.current) ringRef.current.style.transform = `translate3d(0, ${y * 0.8}px, 0)`
      }
    }

    const onScroll = () => {
      y = window.scrollY
      if (!raf) raf = requestAnimationFrame(apply)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    apply()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [mode])

  const showFull = mode === 'full'
  const wc = mode === 'full' ? 'transform' : undefined // will-change only when animating

  return (
    <div aria-hidden className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* L1 — deep perspective grid */}
      <div
        ref={gridRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{ willChange: wc, opacity: mode === 'lite' ? 0.6 : 1 }}
      >
        <svg viewBox="-720 -450 1440 900" className="w-[140%] h-[140%]">
          <g stroke="#009BFF" strokeWidth="1" fill="none" style={{ opacity: 0.12 }}>
            {GRID.lines.map((l, i) => (
              <line key={`gl${i}`} x1="0" y1="0" x2={l.x2} y2={l.y2} />
            ))}
            {GRID.rings.map((s, i) => (
              <rect key={`gr${i}`} x={-s} y={-s * 0.625} width={s * 2} height={s * 1.25} />
            ))}
          </g>
        </svg>
      </div>

      {/* L2 — candlestick clusters across three parallax sub-layers */}
      {[mid0Ref, mid1Ref, mid2Ref].map((ref, sub) => (
        <div
          key={`mid${sub}`}
          ref={ref}
          className="absolute inset-0"
          style={{ willChange: wc, opacity: mode === 'lite' ? 0.6 : 1 }}
        >
          {CLUSTERS.filter((c) => c.sub === sub).map((c, i) => (
            <CandleClusterEl key={`c${sub}-${i}`} cluster={c} />
          ))}
        </div>
      ))}

      {/* L3 — particle field (desktop only) */}
      {showFull &&
        [p0Ref, p1Ref].map((ref, sub) => (
          <div key={`p${sub}`} ref={ref} className="absolute inset-0" style={{ willChange: wc }}>
            {PARTICLES.filter((p) => p.sub === sub).map((p, i) => (
              <ParticleEl key={`p${sub}-${i}`} p={p} />
            ))}
          </div>
        ))}

      {/* L4 — ring accents (desktop only) */}
      {showFull && (
        <div ref={ringRef} className="absolute inset-0" style={{ willChange: wc }}>
          {RINGS.map((r, i) => (
            <div
              key={`ring${i}`}
              className="absolute rounded-full"
              style={{
                width: r.size,
                height: r.size,
                left: `${r.left}%`,
                top: `${r.top}%`,
                transform: 'translate(-50%, -50%)',
                border: '1px solid rgba(0,155,255,0.10)',
              }}
            />
          ))}
        </div>
      )}

      {/* Readability overlay — darkest at centre (behind headline), clear at edges */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 38%, rgba(15,15,15,0.3) 0%, rgba(15,15,15,0.12) 45%, transparent 75%)',
        }}
      />
    </div>
  )
}

function CandleClusterEl({ cluster }: { cluster: Cluster }) {
  const w = cluster.candles.length * 11
  return (
    <div
      className="absolute"
      style={{ left: `${cluster.left}%`, top: `${cluster.top}%`, opacity: cluster.opacity }}
    >
      <svg width={w} height="76">
        {cluster.candles.map((c, i) => {
          const x = i * 11 + 5
          const color = c.up ? '#1D9E75' : '#E24B4A'
          return (
            <g key={i} stroke={color} fill={color}>
              <line x1={x} y1={c.wickY} x2={x} y2={c.wickY + c.wickH} strokeWidth="1" />
              <rect x={x - 3} y={c.bodyY} width="6" height={c.bodyH} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ParticleEl({ p }: { p: Particle }) {
  const cls = p.pulse ? 'sb-pulse' : undefined
  const base: React.CSSProperties = {
    position: 'absolute',
    left: `${p.left}%`,
    top: `${p.top}%`,
    opacity: p.opacity,
    animationDelay: p.pulse ? `${p.delay}s` : undefined,
    // Base opacity for the pulse keyframe to oscillate around (~±10%).
    ...(p.pulse ? ({ ['--sb-o' as string]: p.opacity } as React.CSSProperties) : {}),
  }

  if (p.kind === 'dot') {
    return <span className={cls} style={{ ...base, width: 2, height: 2, borderRadius: 9999, backgroundColor: '#009BFF' }} />
  }
  if (p.kind === 'plus') {
    return (
      <span className={cls} style={{ ...base, color: '#ffffff', fontSize: 8, lineHeight: 1, fontWeight: 700 }}>
        +
      </span>
    )
  }
  return (
    <span
      className={cls}
      style={{
        ...base,
        color: '#ffffff',
        fontSize: 10,
        whiteSpace: 'nowrap',
        fontFamily: 'var(--font-mono-data), ui-monospace, monospace',
      }}
    >
      {p.text}
    </span>
  )
}
