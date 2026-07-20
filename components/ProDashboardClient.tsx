'use client'

import { useState } from 'react'
import SignalCard, { Signal } from './SignalCard'

const LARGE_CAP = new Set([
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AVGO', 'AMD', 'QCOM',
  'INTC', 'TXN', 'MU', 'AMAT', 'ADBE', 'CRM', 'ORCL', 'JPM', 'BAC', 'GS',
  'V', 'MA', 'C', 'WFC', 'MS', 'BLK', 'AXP', 'SCHW', 'JNJ', 'UNH',
  'LLY', 'PFE', 'ABT', 'TMO', 'ISRG', 'MDT', 'AMGN', 'GILD', 'XOM', 'CVX',
  'COP', 'EOG', 'SLB', 'WMT', 'COST', 'MCD', 'SBUX', 'TGT', 'KO', 'PEP',
  'NKE', 'CAT', 'HON', 'RTX', 'LMT', 'GE', 'NFLX', 'DIS', 'CMCSA', 'T', 'VZ',
])

// Note: this component is currently unused (not imported anywhere in the
// app) — fixed for consistency with SignalBoardClient.tsx's removal of the
// same fake Momentum tab, in case it's ever wired up.
type FilterKey = 'all' | 'large-cap' | 'small-cap' | 'long-term' | 'swing-trade'

function isLargeCapTicker(s: Signal): boolean {
  return s.signalCategory === 'large_cap' || LARGE_CAP.has(s.ticker)
}

function isLongTerm(s: Signal): boolean {
  return s.timeframeCategory === 'long_term'
}

function isSwingTrade(s: Signal): boolean {
  return s.timeframeCategory === 'swing' || !s.timeframeCategory
}

function matchesFilter(s: Signal, f: FilterKey): boolean {
  if (f === 'all') return true
  if (f === 'large-cap') return isLargeCapTicker(s)
  if (f === 'small-cap') return !isLargeCapTicker(s)
  if (f === 'long-term') return isLongTerm(s)
  if (f === 'swing-trade') return isSwingTrade(s)
  return true
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'large-cap', label: 'Large Cap' },
  { key: 'small-cap', label: 'Small Cap' },
  { key: 'long-term', label: 'Long Term' },
  { key: 'swing-trade', label: 'Swing Trade' },
]

export default function ProDashboardClient({
  signals,
}: {
  signals: Signal[]
  tier: 'pro' | 'max'
}) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const displayed = signals.filter((s) => matchesFilter(s, filter))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => {
          const count = f.key === 'all' ? signals.length : signals.filter((s) => matchesFilter(s, f.key)).length
          const active = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={
                active
                  ? { backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.4)' }
                  : { backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
              }
            >
              {f.label}
              <span className="ml-1 opacity-60">({count})</span>
            </button>
          )
        })}
      </div>

      {displayed.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <p className="font-semibold text-white">No signals match this filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayed.map((s) => (
            <SignalCard key={s.id} signal={s} />
          ))}
        </div>
      )}
    </div>
  )
}
