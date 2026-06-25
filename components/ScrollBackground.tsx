'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Interactive landing-page background.
 *
 * Two parallax layers drift at different speeds as the page scrolls:
 *  1. A trading-terminal grid (slow parallax) for depth.
 *  2. A stylized chart line + candlesticks (faster parallax + gentle drift).
 *
 * Performance notes:
 *  - Only compositor-friendly `transform`s are animated, coalesced via rAF.
 *  - The scroll listener is passive and does no layout reads.
 *  - On small/touch screens or when `prefers-reduced-motion` is set, the
 *    heaviest effects are disabled and a static, low-opacity layer is shown.
 */
export default function ScrollBackground() {
  const gridRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  // 'off' = no animation (reduced motion / SSR), 'lite' = static visual on
  // mobile, 'full' = parallax + drift on capable desktops.
  const [mode, setMode] = useState<'off' | 'lite' | 'full'>('off')

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isSmall = window.matchMedia('(max-width: 768px)').matches
    const lowPower =
      typeof navigator !== 'undefined' &&
      typeof navigator.hardwareConcurrency === 'number' &&
      navigator.hardwareConcurrency > 0 &&
      navigator.hardwareConcurrency <= 4

    if (reduceMotion) {
      setMode('off')
      return
    }
    if (isSmall || lowPower) {
      setMode('lite')
      return
    }
    setMode('full')
  }, [])

  useEffect(() => {
    if (mode !== 'full') return

    let raf = 0
    let latestY = window.scrollY

    const update = () => {
      raf = 0
      if (gridRef.current) {
        gridRef.current.style.transform = `translate3d(0, ${latestY * 0.12}px, 0)`
      }
      if (chartRef.current) {
        chartRef.current.style.transform = `translate3d(0, ${latestY * 0.32}px, 0)`
      }
    }

    const onScroll = () => {
      latestY = window.scrollY
      if (!raf) raf = requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [mode])

  // The DOM structure is identical for every mode (avoids hydration mismatch);
  // only the parallax transforms (applied in the effect) and the drift animation
  // differ. Reduced motion → fully static; mobile/low-power → static but visible.
  const willChange = mode === 'full' ? 'transform' : undefined

  return (
    <div aria-hidden className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <div ref={gridRef} className="absolute inset-x-0 -top-1/4 h-[150%]" style={{ willChange }}>
        <GridLayer />
      </div>

      <div ref={chartRef} className="absolute inset-0" style={{ willChange }}>
        <ChartLayer animate={mode === 'full'} />
      </div>
    </div>
  )
}

function GridLayer() {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:
          'linear-gradient(rgba(0,155,255,0.05) 1px, transparent 1px),' +
          'linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '46px 46px',
        // Fade the grid out toward the bottom so it never competes with copy.
        maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.15) 70%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.15) 70%, transparent 100%)',
      }}
    />
  )
}

function ChartLayer({ animate }: { animate: boolean }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ opacity: 0.55 }}
    >
      <svg
        viewBox="0 0 1440 600"
        preserveAspectRatio="xMidYMid slice"
        className={animate ? 'sb-drift' : undefined}
        style={{ width: '120%', height: '100%' }}
      >
        <defs>
          <linearGradient id="sb-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#009BFF" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#009BFF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area under the chart line */}
        <path
          d="M0,440 L120,400 L240,420 L360,350 L480,380 L600,300 L720,330 L840,250 L960,290 L1080,200 L1200,240 L1320,160 L1440,200 L1440,600 L0,600 Z"
          fill="url(#sb-area)"
        />
        {/* Chart line */}
        <polyline
          points="0,440 120,400 240,420 360,350 480,380 600,300 720,330 840,250 960,290 1080,200 1200,240 1320,160 1440,200"
          fill="none"
          stroke="#009BFF"
          strokeOpacity="0.4"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* A scattering of candlesticks */}
        {CANDLES.map((c, i) => (
          <g key={i} stroke={c.up ? '#4ade80' : '#f87171'} strokeOpacity="0.3">
            <line x1={c.x} y1={c.high} x2={c.x} y2={c.low} strokeWidth="1.5" />
            <rect
              x={c.x - 5}
              y={c.bodyTop}
              width="10"
              height={c.bodyH}
              fill={c.up ? '#4ade80' : '#f87171'}
              fillOpacity="0.12"
            />
          </g>
        ))}
      </svg>
    </div>
  )
}

const CANDLES = [
  { x: 160,  high: 470, low: 520, bodyTop: 482, bodyH: 26, up: false },
  { x: 420,  high: 360, low: 410, bodyTop: 372, bodyH: 28, up: true },
  { x: 700,  high: 300, low: 360, bodyTop: 318, bodyH: 30, up: true },
  { x: 980,  high: 250, low: 305, bodyTop: 262, bodyH: 24, up: false },
  { x: 1260, high: 180, low: 240, bodyTop: 196, bodyH: 30, up: true },
]
