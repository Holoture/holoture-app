'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Landing-page background — a single time-axis lattice.
 *
 * Concept: the product's claim is "we scan the market every morning before
 * the open." Scroll position maps to a trading session — as the visitor
 * scrolls, the lattice drifts horizontally, and three brighter verticals
 * (open / midday / close) pass through the viewport like session boundaries
 * on a real chart's time axis. One idea, executed once — no globe, no
 * particles, no candlesticks, no rings, no decorative glow.
 *
 * Gridlines are irregularly spaced (the way real chart axes are — session
 * opens, gaps) using a deterministic PRNG so server and client render the
 * same layout with no hydration mismatch.
 *
 * Modes (decided client-side after mount):
 *   full   — lattice + horizontal scroll drift (desktop)
 *   static — lattice only, no scroll listener (mobile / low-power)
 *   off    — reduced motion: static, identical to `static`
 */

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const LATTICE_WIDTH = 1300 // > 100vw so horizontal drift never exposes an edge
const LATTICE_HEIGHT = 1000
const REGULAR_LINE = 'rgba(255,255,255,0.035)'
const BOUNDARY_LINE = 'rgba(255,255,255,0.14)'

type VLine = { x: number; boundary: boolean }

function buildVerticalLines(): VLine[] {
  const r = rng(20260716)
  const lines: VLine[] = []
  let x = -40
  while (x < LATTICE_WIDTH + 40) {
    lines.push({ x, boundary: false })
    // Irregular spacing: denser near "open"/"close" activity, sparser midday —
    // and occasional wider gaps, the way a session actually trades.
    const gap = r() < 0.12 ? 60 + r() * 70 : 22 + r() * 46
    x += gap
  }
  // Mark three lines as session boundaries: open, midday, close.
  const openIdx = Math.floor(lines.length * 0.18)
  const midIdx = Math.floor(lines.length * 0.5)
  const closeIdx = Math.floor(lines.length * 0.82)
  for (const i of [openIdx, midIdx, closeIdx]) {
    if (lines[i]) lines[i].boundary = true
  }
  return lines
}

function buildHorizontalLines(): number[] {
  const r = rng(918273645)
  const lines: number[] = []
  let y = 20
  while (y < LATTICE_HEIGHT) {
    lines.push(y)
    // Tighter spacing mid-range (price clusters), wider toward the extremes.
    const mid = Math.abs(y - LATTICE_HEIGHT / 2) < LATTICE_HEIGHT * 0.3
    y += (mid ? 34 : 58) + r() * 30
  }
  return lines
}

const V_LINES = buildVerticalLines()
const H_LINES = buildHorizontalLines()

export default function ScrollBackground() {
  const [mode, setMode] = useState<'off' | 'static' | 'full'>('full')
  const latticeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const small = window.matchMedia('(max-width: 768px)').matches
    const lowPower =
      typeof navigator !== 'undefined' &&
      typeof navigator.hardwareConcurrency === 'number' &&
      navigator.hardwareConcurrency > 0 &&
      navigator.hardwareConcurrency <= 4
    setMode(reduce ? 'off' : small || lowPower ? 'static' : 'full')
  }, [])

  useEffect(() => {
    if (mode !== 'full') return

    let raf = 0
    let y = window.scrollY

    const apply = () => {
      raf = 0
      if (latticeRef.current) {
        latticeRef.current.style.transform = `translate3d(${-y * 0.15}px, 0, 0)`
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

  return (
    <div aria-hidden className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <div
        ref={latticeRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{ willChange: mode === 'full' ? 'transform' : undefined }}
      >
        <svg
          viewBox={`0 0 ${LATTICE_WIDTH} ${LATTICE_HEIGHT}`}
          className="w-[130%] h-full"
          preserveAspectRatio="xMidYMid slice"
        >
          {H_LINES.map((y, i) => (
            <line key={`h${i}`} x1="0" y1={y} x2={LATTICE_WIDTH} y2={y} stroke={REGULAR_LINE} strokeWidth="1" />
          ))}
          {V_LINES.map((v, i) => (
            <line
              key={`v${i}`}
              x1={v.x}
              y1="0"
              x2={v.x}
              y2={LATTICE_HEIGHT}
              stroke={v.boundary ? BOUNDARY_LINE : REGULAR_LINE}
              strokeWidth={v.boundary ? 1.5 : 1}
            />
          ))}
        </svg>
      </div>

      {/* Readability layer — a plain top-to-mid fade, not a decorative glow,
          so hero text stays legible over the lattice. */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(15,15,15,0.35) 0%, rgba(15,15,15,0.12) 45%, transparent 75%)',
        }}
      />
    </div>
  )
}
