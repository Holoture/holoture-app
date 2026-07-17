'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Slide = {
  image: string
  title: string
  description: string
  pills: string[]
}

const SLIDES: Slide[] = [
  {
    image: '/screenshots/signals.png',
    title: 'Stock Signals',
    description:
      'Daily curated signals across large cap, small cap, swing, momentum, and intraday timeframes. Every signal includes an entry zone, price target, stop loss, and full data-backed reasoning.',
    pills: ['Entry Zones', 'Price Targets', 'Confidence Scores'],
  },
  {
    image: '/screenshots/options.png',
    title: 'Options Signals',
    description:
      'Actionable options signals with strike selection, expiration, IV analysis, and full strategy reasoning. Built for traders who want more than just stock direction.',
    pills: ['CALL/PUT', 'Strike Price', 'IV Analysis'],
  },
  {
    image: '/screenshots/politician.png',
    title: 'Politician Scanner',
    description:
      'Every stock trade made by members of Congress, tracked automatically. See exactly what your elected officials are buying and selling with their personal money.',
    pills: ['Real-Time Filings', 'Party Breakdown', 'Trade History'],
  },
  {
    image: '/screenshots/insider.png',
    title: 'Insider Buying Scanner',
    description:
      'Track when CEOs, CFOs, and board members buy their own company stock with personal money — one of the most bullish signals in the market.',
    pills: ['Form 4 Filings', 'Significance Score', 'Cluster Buy Detection'],
  },
]

const AUTO_ADVANCE_MS = 6000
const SWIPE_THRESHOLD = 40

export default function EdgeCarousel() {
  const [index, setIndex] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [interacted, setInteracted] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const go = useCallback((next: number, byUser = true) => {
    if (byUser) setInteracted(true)
    setIndex((prev) => (next + SLIDES.length) % SLIDES.length)
  }, [])

  const next = useCallback((byUser = true) => go(index + 1, byUser), [go, index])
  const prev = useCallback(() => go(index - 1, true), [go, index])

  // Auto-advance every 6s until the user interacts; pause on hover.
  useEffect(() => {
    if (interacted || hovered) return
    const t = setTimeout(() => next(false), AUTO_ADVANCE_MS)
    return () => clearTimeout(t)
  }, [index, interacted, hovered, next])

  // Keyboard arrow navigation.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next])

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx < 0) next(true)
      else prev()
    }
    touchStartX.current = null
  }

  const active = SLIDES[index]

  return (
    <section className="relative z-10 py-20" style={{ backgroundColor: 'rgba(15,15,15,0.75)' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="eyebrow mb-3">One platform</p>
          <h2 className="type-h2">One Platform, Four Edges</h2>
          <p className="mt-4 type-subhead">
            Signals, options, and the scanners that show you where the smart money moves.
          </p>
        </div>

        {/* ── Carousel ── */}
        <div
          className="relative"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Screenshot frame */}
          <div
            className="relative rounded-2xl overflow-hidden term-panel"
            style={{
              border: '1px solid rgba(0,155,255,0.35)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.45), 0 0 40px rgba(0,155,255,0.15)',
            }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {/* Sliding track */}
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {SLIDES.map((slide) => (
                <div key={slide.image} className="w-full shrink-0">
                  <SlideImage slide={slide} />
                </div>
              ))}
            </div>

            {/* Arrows */}
            <button
              type="button"
              aria-label="Previous slide"
              onClick={prev}
              className="carousel-arrow absolute left-2 sm:left-4 top-1/2 -translate-y-1/2"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => next(true)}
              className="carousel-arrow absolute right-2 sm:right-4 top-1/2 -translate-y-1/2"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>

          {/* Dots */}
          <div className="flex items-center justify-center gap-2.5 mt-6">
            {SLIDES.map((slide, i) => (
              <button
                key={slide.image}
                type="button"
                aria-label={`Go to ${slide.title}`}
                aria-current={i === index}
                onClick={() => go(i, true)}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === index ? 28 : 9,
                  height: 9,
                  backgroundColor: i === index ? '#009BFF' : 'var(--text-w20)',
                  boxShadow: i === index ? '0 0 10px rgba(0,155,255,0.7)' : 'none',
                }}
              />
            ))}
          </div>

          {/* Details (fade in on slide change) */}
          <div key={index} className="carousel-fade mt-8 text-center max-w-2xl mx-auto">
            <h3 className="mb-3" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-high)' }}>{active.title}</h3>
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.6, color: 'var(--text-body)' }}>
              {active.description}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
              {active.pills.map((pill) => (
                <span
                  key={pill}
                  className="px-3 py-1 rounded-full text-xs"
                  style={{
                    fontWeight: 500,
                    backgroundColor: 'rgba(0,155,255,0.1)',
                    color: '#009BFF',
                    border: '1px solid rgba(0,155,255,0.3)',
                  }}
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SlideImage({ slide }: { slide: Slide }) {
  const [failed, setFailed] = useState(false)

  // Graceful fallback until the real screenshots are captured into
  // /public/screenshots/ — keeps the section presentable rather than broken.
  if (failed) {
    return (
      <div
        className="w-full flex flex-col items-center justify-center"
        style={{
          aspectRatio: '16 / 10',
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(0,155,255,0.12), transparent 60%), var(--bg-primary)',
        }}
      >
        <p className="eyebrow mb-2">Preview pending</p>
        <p style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-high)' }}>{slide.title}</p>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={slide.image}
      alt={`${slide.title} screenshot`}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-full h-auto block"
      style={{ aspectRatio: '16 / 10', objectFit: 'cover', objectPosition: 'top' }}
    />
  )
}
