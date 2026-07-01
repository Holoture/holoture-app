'use client'

import { useEffect, useRef } from 'react'

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
      "Before the market opens every morning, Holoture's algorithm runs a full sweep across hundreds of stocks simultaneously. It starts with price action — analyzing candlestick patterns, support and resistance levels, moving average crossovers, RSI, MACD, and Bollinger Bands to identify technically significant setups. It then layers in volume confirmation, because a breakout without volume is just noise. From there it pulls fundamental data — revenue growth, earnings trends, P/E relative to sector, free cash flow, and debt levels — to separate genuinely strong companies from ones that just look good on a chart.",
      "It doesn't stop there. The algorithm cross-references real-time news sentiment, weighing the ratio of bullish to bearish coverage for each stock in the past seven days. It checks whether any corporate insiders — CEOs, CFOs, board members — have recently bought shares with their own personal money, one of the most historically reliable signals in the market. It also checks congressional trading disclosures to see whether any members of Congress have recently taken positions in the same name. Each of these factors gets scored independently, then combined into a single weighted composite score that determines whether a stock becomes a BUY, WATCH, or SHORT signal — and exactly how confident we are in it.",
    ],
  },
  {
    num: '02',
    title: 'You get actionable signals',
    body: [
      "Every signal that clears Holoture's quality threshold lands on your dashboard with everything you need to make a real decision — not just a ticker and a direction. Each one comes with a precise entry zone showing you the exact price range where the setup makes sense to enter, so you're not chasing a move that already happened or buying at the wrong level. Below that sits your price target — where the algorithm expects the stock to reach based on technical resistance levels, historical patterns, and the strength of the underlying thesis. And directly beside it, your stop loss — the exact price where the thesis breaks down and you should exit to protect your capital.",
      "Every signal also carries a confidence score precise to one decimal place, calculated directly from the weighted composite of all the factors the algorithm scored — not a guess, not a vibe, a real number that reflects how strongly the data aligns. Next to it you'll see the upside percentage, showing you the potential gain from entry to target so you can instantly compare opportunities and size your positions accordingly. And underneath all of it sits the full written thesis — a plain English explanation of exactly why this signal was generated, what the main risk is, and what catalyst or price level to watch. You know the reasoning before you risk a dollar.",
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
        className="relative overflow-hidden rounded-2xl p-6 sm:p-10 transition-shadow duration-300"
        style={{
          backgroundColor: 'rgba(20,20,20,0.85)',
          borderTop: '1px solid rgba(0,155,255,0.18)',
          borderRight: '1px solid rgba(0,155,255,0.18)',
          borderBottom: '1px solid rgba(0,155,255,0.18)',
          borderLeft: '3px solid #009BFF',
          boxShadow: '0 0 0 rgba(0,155,255,0)',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLDivElement).style.boxShadow =
            '0 0 32px rgba(0,155,255,0.12), inset 0 0 0 1px rgba(0,155,255,0.25)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 rgba(0,155,255,0)'
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
          {/* Small step label */}
          <p
            className="font-mono font-bold text-sm tracking-widest mb-3"
            style={{ color: '#009BFF', letterSpacing: '0.15em' }}
          >
            {step.num}
          </p>

          <h3
            className="font-black text-white mb-6"
            style={{ fontSize: 'clamp(22px, 3vw, 30px)', lineHeight: 1.2 }}
          >
            {step.title}
          </h3>

          <div className="space-y-5">
            {step.body.map((para, i) => (
              <p
                key={i}
                className="leading-relaxed"
                style={{ color: '#CCCCCC', fontSize: 'clamp(15px, 1.5vw, 18px)', lineHeight: 1.8 }}
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
    <section className="relative z-10 py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="term-label mb-3">// HOW_IT_WORKS<span className="term-cursor" /></p>
          <h2 className="text-3xl sm:text-4xl font-black text-white">How Holoture Works</h2>
          <p className="mt-4 text-lg" style={{ color: '#CCCCCC' }}>
            From raw market data to your next trade — in three steps
          </p>
        </div>

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
