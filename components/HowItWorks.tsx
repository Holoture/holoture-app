'use client'

import { useEffect, useRef } from 'react'
import SectionHeader from './SectionHeader'

type Step = {
  num: string
  title: string
  body: string[]
}

const STEPS: Step[] = [
  {
    num: '01',
    title: 'We scan the market every day',
    body: [
      "Our algorithm analyzes hundreds of stocks across price action, volume, momentum, fundamentals, news sentiment, insider activity, and congressional trades — running every morning before market open.",
    ],
  },
  {
    num: '02',
    title: 'You get actionable signals',
    body: [
      "Every signal comes with an entry zone, price target, stop loss, confidence score, upside percentage, and the full reasoning behind the pick. No guesswork. No black box.",
    ],
  },
  {
    num: '03',
    title: 'You trade with an edge',
    body: [
      "Know exactly where to enter, where to take profit, and where to cut your loss before you place a single order. The kind of structured intelligence that used to cost hundreds of dollars a month.",
    ],
  },
]

function StepCard({ step, index }: { step: Step; index: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      el.style.opacity = '1'
      el.style.transform = 'none'
      return
    }

    el.style.opacity = '0'
    el.style.transform = 'translateY(20px)'
    el.style.transition = `opacity 0.55s ease ${index * 150}ms, transform 0.55s ease ${index * 150}ms`

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = '1'
          el.style.transform = 'translateY(0)'
          observer.disconnect()
        }
      },
      { threshold: 0.12 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [index])

  return (
    <div ref={ref} className="relative group">
      {/* Card */}
      <div
        className="relative rounded-none p-6 sm:p-10 term-panel"
        style={{
          backgroundColor: 'var(--bg-raised)',
          border: '1px solid var(--line)',
        }}
      >
        {/* Watermark number */}
        <span
          aria-hidden
          className="hidden sm:block absolute right-8 top-1/2 -translate-y-1/2 font-mono font-black leading-none select-none pointer-events-none"
          style={{ fontSize: 120, color: 'rgba(0,155,255,0.07)', letterSpacing: '-4px' }}
        >
          {step.num}
        </span>

        {/* Content */}
        <div className="relative">
          {/* Step index — mono is correct here: an index is machine-produced */}
          <p className="data-label mb-3" style={{ color: '#009BFF' }}>
            {step.num}
          </p>

          <h3
            className="mb-6"
            style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.15, color: 'var(--text-high)' }}
          >
            {step.title}
          </h3>

          <div className="space-y-5">
            {step.body.map((para, i) => (
              <p
                key={i}
                style={{ color: 'var(--text-body)', fontSize: 'clamp(15px, 1.5vw, 16px)', fontWeight: 400, lineHeight: 1.6 }}
              >
                {para}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Connector() {
  return (
    <div className="flex items-center justify-center py-2" aria-hidden>
      <div
        className="w-px"
        style={{
          height: 32,
          background: 'linear-gradient(to bottom, rgba(0,155,255,0.4), rgba(0,155,255,0.1))',
        }}
      />
    </div>
  )
}

export default function HowItWorks() {
  return (
    <section className="relative z-10 py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          index="02"
          eyebrow="How it works"
          title="How Holoture Works"
          subhead="From raw market data to your next trade — in three steps"
        />

        {/* Steps */}
        <div>
          {STEPS.map((step, i) => (
            <div key={step.num}>
              <StepCard step={step} index={i} />
              {i < STEPS.length - 1 && <Connector />}
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p
          className="text-center mt-10 text-xs"
          style={{ color: 'var(--text-w35, rgba(255,255,255,0.35))' }}
        >
          Free tier gets 5 signals daily. Pro gets the full board. Max adds options, futures, and forex.
        </p>
      </div>
    </section>
  )
}
