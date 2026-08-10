'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ComponentBreakdown } from '@/lib/sentimentIndex'

export type SentimentDisplayData = {
  score: number
  label: string
  date: string
  breakdown: ComponentBreakdown
}

const LABEL_COLOR: Record<string, string> = {
  'Extreme Fear': 'var(--short)',
  'Fear': '#E24B4A',
  'Neutral': 'var(--watch)',
  'Greed': '#1D9E75',
  'Extreme Greed': 'var(--buy)',
}

function ComponentRow({ name, weight, score, detail }: { name: string; weight: number; score: number; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-xs font-semibold" style={{ color: 'var(--text-high)' }}>{name} <span className="font-data" style={{ color: 'var(--text-w35)' }}>({Math.round(weight * 100)}%)</span></p>
        <p className="text-xs truncate" style={{ color: 'var(--text-w40)' }}>{detail}</p>
      </div>
      <span className="font-data text-sm font-bold shrink-0" style={{ color: 'var(--text-high)' }}>{score}</span>
    </div>
  )
}

/**
 * Holoture Market Sentiment Index — our own composite (see
 * lib/sentimentIndex.ts), NOT a reproduction of CNN's Fear & Greed Index.
 * Expand-on-click reveals the full component breakdown, same "show your
 * work" transparency as a signal's thesis rather than just its confidence
 * number — real interactivity, not decoration.
 */
export default function SentimentGauge({ data }: { data: SentimentDisplayData | null }) {
  const [expanded, setExpanded] = useState(false)
  if (!data) return null

  const { score, label, breakdown } = data
  const accent = LABEL_COLOR[label] ?? 'var(--watch)'

  return (
    <div className="mb-6" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="min-w-0">
          <p className="data-label mb-1" style={{ color: 'var(--text-dim)' }}>Holoture Market Sentiment Index</p>
          <div className="flex items-center gap-2">
            <span className="font-data font-bold" style={{ fontSize: 24, color: accent }}>{score}</span>
            <span className="text-sm font-semibold" style={{ color: accent }}>{label}</span>
          </div>
        </div>
        <ChevronDown
          className="w-4 h-4 shrink-0"
          style={{ color: 'var(--text-w40)', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
        />
      </button>

      {/* Horizontal gauge — fixed fear-to-greed gradient track, single marker at today's score. Not a busy dial. */}
      <div className="px-4 pb-3">
        <div className="relative h-1.5" style={{ background: 'linear-gradient(90deg, var(--short) 0%, var(--watch) 50%, var(--buy) 100%)' }}>
          <div
            className="absolute top-1/2 w-2.5 h-2.5 -translate-y-1/2"
            style={{ left: `calc(${score}% - 5px)`, backgroundColor: 'var(--text-high)', border: '2px solid var(--bg-raised)' }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px]" style={{ color: 'var(--text-w30)' }}>Extreme Fear</span>
          <span className="text-[10px]" style={{ color: 'var(--text-w30)' }}>Extreme Greed</span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="pt-2 divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            <ComponentRow name="Breadth" weight={breakdown.breadth.weight} score={breakdown.breadth.score}
              detail={`${breakdown.breadth.raw.aboveSma50}/${breakdown.breadth.raw.total} tickers above their 50-day average`} />
            <ComponentRow name="Momentum" weight={breakdown.momentum.weight} score={breakdown.momentum.score}
              detail={`SPY ${breakdown.momentum.raw.deviationPct >= 0 ? '+' : ''}${breakdown.momentum.raw.deviationPct}% vs. its 50-day average`} />
            <ComponentRow name="Volatility" weight={breakdown.volatility.weight} score={breakdown.volatility.score}
              detail={`${breakdown.volatility.raw.annualizedVolPct}% annualized (SPY, 20-session)`} />
            <ComponentRow name="Our Signal Mix" weight={breakdown.signalMix.weight} score={breakdown.signalMix.score}
              detail={`${breakdown.signalMix.raw.buyCount} BUY vs. ${breakdown.signalMix.raw.shortCount} SHORT, last 5 sessions`} />
            <ComponentRow name="Safe-Haven Demand" weight={breakdown.safeHaven.weight} score={breakdown.safeHaven.score}
              detail={`HYG ${breakdown.safeHaven.raw.hygReturnPct >= 0 ? '+' : ''}${breakdown.safeHaven.raw.hygReturnPct}% vs. TLT ${breakdown.safeHaven.raw.tltReturnPct >= 0 ? '+' : ''}${breakdown.safeHaven.raw.tltReturnPct}%, 10-session`} />
          </div>
          <p className="text-[10px] mt-2" style={{ color: 'var(--text-w30)' }}>
            Our own composite index, built from real market breadth, SPY momentum/volatility, our own algorithm&apos;s signal mix,
            and a credit-market proxy — not a reproduction of any third-party index. Not financial advice.
          </p>
        </div>
      )}
    </div>
  )
}
