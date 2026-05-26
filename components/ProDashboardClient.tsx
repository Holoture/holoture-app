'use client'

import { useState } from 'react'
import SignalCard, { Signal } from './SignalCard'

const LARGE_CAP = new Set([
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AVGO', 'QCOM', 'AMD',
  'JPM', 'BAC', 'GS', 'V', 'MA', 'JNJ', 'UNH', 'LLY', 'PFE', 'XOM',
  'CVX', 'WMT', 'MCD', 'NFLX', 'CRM', 'CAT', 'BA', 'UBER',
])

type FilterKey = 'all' | 'large-cap' | 'small-cap' | 'long-term' | 'swing-trade' | 'momentum'

function isLongTerm(h: string): boolean {
  const lower = h.toLowerCase()
  if (lower.includes('year')) return true
  if (lower.includes('month')) {
    const m = lower.match(/(\d+)/)
    if (m && parseInt(m[1]) >= 3) return true
  }
  return false
}

function isSwingTrade(h: string): boolean {
  const lower = h.toLowerCase()
  return lower.includes('day') || lower.includes('week')
}

function matchesFilter(s: Signal, f: FilterKey): boolean {
  if (f === 'all') return true
  if (f === 'large-cap') return LARGE_CAP.has(s.ticker)
  if (f === 'small-cap') return !LARGE_CAP.has(s.ticker)
  if (f === 'long-term') return isLongTerm(String(s.timeHorizon))
  if (f === 'swing-trade') return isSwingTrade(String(s.timeHorizon))
  if (f === 'momentum') return s.signalType === 'BUY' && s.confidence >= 75
  return true
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'large-cap', label: 'Large Cap' },
  { key: 'small-cap', label: 'Small Cap' },
  { key: 'long-term', label: 'Long Term' },
  { key: 'swing-trade', label: 'Swing Trade' },
  { key: 'momentum', label: 'Momentum' },
]

export default function ProDashboardClient({ signals }: { signals: Signal[] }) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const filtered = signals.filter((s) => matchesFilter(s, filter))

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

      {filtered.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <p className="font-semibold text-white">No signals match this filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((s) => (
            <SignalCard key={s.id} signal={s} />
          ))}
        </div>
      )}
    </div>
  )
}
