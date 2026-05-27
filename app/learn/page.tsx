'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import { BookOpen, Target, BarChart3, Shield, Clock, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react'

type Article = {
  id: string
  icon: React.ElementType
  title: string
  summary: string
  readTime: string
  sections: { heading: string; body: string }[]
}

const ARTICLES: Article[] = [
  {
    id: 'reading-signals',
    icon: Target,
    title: 'How to Read a Trading Signal',
    summary: 'Learn the anatomy of a Holoture signal and what each data point means for your trading decisions.',
    readTime: '4 min',
    sections: [
      {
        heading: 'What is a Signal?',
        body: 'A signal is a curated trade idea with a clear setup: ticker, direction (BUY/SELL/HOLD/SHORT), entry price range, a target, and a stop-loss. Think of it as a structured hypothesis — not a guarantee, but a high-probability setup identified by our data engine.',
      },
      {
        heading: 'Signal Types',
        body: 'BUY signals expect price appreciation over the stated time horizon. SELL/SHORT signals anticipate a decline and are suited for bearish strategies. HOLD signals indicate existing positions should be maintained. WATCH signals flag stocks worth monitoring before committing capital.',
      },
      {
        heading: 'Acting on a Signal',
        body: "Never enter the full position at once. Use the entry zone to scale in — buying partial size at the low end and adding if price confirms. Set your stop-loss as a hard rule, not a suggestion. If price breaks the stop, the thesis is likely invalidated and capital should be preserved.",
      },
    ],
  },
  {
    id: 'confidence-scores',
    icon: BarChart3,
    title: 'Understanding Confidence Scores',
    summary: 'Confidence scores tell you how strongly the data model backs a signal. Here is what each range means in practice.',
    readTime: '3 min',
    sections: [
      {
        heading: 'What the Score Measures',
        body: 'The confidence score (0–100%) is a composite of technical setup quality, fundamental backing, sector momentum, and historical pattern strength. Higher scores mean more convergent evidence — not a certain outcome.',
      },
      {
        heading: 'Score Ranges',
        body: '80–100% (High): Strong conviction — multiple indicators aligned. Size normally.\n60–79% (Medium): Solid setup with some uncertainty. Consider half-size positions.\nBelow 60% (Low): Exploratory idea with notable risk. Small size or paper-trade only.',
      },
      {
        heading: 'Using Confidence with Position Sizing',
        body: 'A simple rule: position size % = (confidence score / 100) × your max single-stock allocation. If your max per trade is 5% of the portfolio and the score is 80%, that is a 4% allocation.',
      },
    ],
  },
  {
    id: 'entry-zones',
    icon: Shield,
    title: 'Entry Zones & Stop-Losses Explained',
    summary: 'Entry zones and stop-losses define your risk before you ever place a trade. Master these and you have mastered risk management.',
    readTime: '5 min',
    sections: [
      {
        heading: 'Why a Zone, Not a Price',
        body: 'Markets rarely hit a single price precisely. An entry zone (e.g., $145–$150) gives you a practical range to work within. Entering at the low end of the zone improves your risk/reward; entering near the high end tightens it.',
      },
      {
        heading: 'The Stop-Loss is Your Exit Plan',
        body: 'A stop-loss is the price at which the trade thesis is wrong. It is not about emotion — it is a pre-defined rule. When price hits your stop, exit the position and accept the small loss rather than ride it into a large one.',
      },
      {
        heading: 'Calculating Risk/Reward',
        body: 'Risk = entry price − stop-loss. Reward = target price − entry price. A 3:1 reward-to-risk ratio means you profit $3 for every $1 at risk. Aim for setups with at least 2:1 — this lets you be right only 40% of the time and still be profitable overall.',
      },
    ],
  },
  {
    id: 'time-horizons',
    icon: Clock,
    title: 'Time Horizons & How to Use Them',
    summary: 'Matching the right time horizon to your trading style prevents one of the most common investing mistakes.',
    readTime: '3 min',
    sections: [
      {
        heading: 'Short-Term (1–14 days)',
        body: 'These signals are driven by technical patterns, momentum, and near-term catalysts like earnings or macro data. They require active monitoring and tight stops. Suitable for swing traders comfortable with daily chart volatility.',
      },
      {
        heading: 'Medium-Term (2 weeks – 3 months)',
        body: 'The sweet spot for most investors. These signals combine technicals and fundamentals — a company with improving earnings inside a bullish sector trend, for example. Check weekly rather than daily.',
      },
      {
        heading: 'Long-Term (3–12 months)',
        body: 'Thesis-driven positions based on structural changes: new products, market share gains, or industry tailwinds. These can absorb more short-term volatility. Review monthly and only exit if the core thesis changes.',
      },
    ],
  },
]

export default function LearnPage() {
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)

  function toggleComplete(id: string) {
    setCompleted((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const progress = Math.round((completed.size / ARTICLES.length) * 100)

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <BookOpen className="w-6 h-6" style={{ color: '#009BFF' }} />
              <h1 className="text-2xl font-black text-white">Learn</h1>
            </div>
            <p className="text-sm text-white">Master the fundamentals of signal-based trading</p>
          </div>
          <div className="shrink-0">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div>
                <p className="text-xs font-semibold text-white">Progress</p>
                <p className="text-xs text-white">{completed.size}/{ARTICLES.length} completed</p>
              </div>
              <div className="relative w-10 h-10">
                <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border-subtle)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.5" fill="none" stroke="#009BFF" strokeWidth="3"
                    strokeDasharray={`${progress} 100`} strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">{progress}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {ARTICLES.map((article) => {
            const Icon = article.icon
            const isOpen = expanded === article.id
            const isDone = completed.has(article.id)

            return (
              <div key={article.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', border: `1px solid ${isDone ? 'rgba(0,155,255,0.4)' : 'var(--border)'}` }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : article.id)}
                  className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/5 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: isDone ? 'rgba(0,155,255,0.2)' : 'var(--border-faint)' }}>
                    <Icon className="w-5 h-5" style={{ color: isDone ? '#009BFF' : 'var(--text-primary)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white">{article.title}</h3>
                    <p className="text-xs text-white mt-0.5">{article.readTime} read · {article.sections.length} sections</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isDone && <CheckCircle2 className="w-4 h-4" style={{ color: '#009BFF' }} />}
                    {isOpen ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-white" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5">
                    <p className="text-sm text-white mb-6">{article.summary}</p>
                    <div className="space-y-5">
                      {article.sections.map((sec) => (
                        <div key={sec.heading}>
                          <h4 className="font-semibold text-white mb-2">{sec.heading}</h4>
                          {sec.body.split('\n').map((line, i) => (
                            <p key={i} className="text-sm text-white leading-relaxed mb-1">{line}</p>
                          ))}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => toggleComplete(article.id)}
                      className="mt-6 px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                      style={{
                        backgroundColor: isDone ? 'var(--bg-surface-2)' : '#009BFF',
                        color: isDone ? 'var(--text-primary)' : 'white',
                        border: isDone ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      {isDone ? 'Mark as Incomplete' : 'Mark as Complete'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
