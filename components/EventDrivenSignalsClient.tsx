'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import SignalRow from './SignalRow'
import type { Signal } from './SignalCard'
import { useLiveQuotes } from '@/lib/useLiveQuotes'

type TypeFilter = 'all' | 'BUY' | 'WATCH' | 'SHORT'

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'all',   label: 'All' },
  { key: 'BUY',   label: 'BUY' },
  { key: 'WATCH', label: 'WATCH' },
  { key: 'SHORT', label: 'SHORT' },
]

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
      style={
        active
          ? { backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.4)' }
          : { backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-w60)', border: '1px solid var(--border)' }
      }
    >
      {label}
    </button>
  )
}

function renderColumnHeaders() {
  return (
    <div
      className="hidden sm:flex items-center gap-3 px-4 py-2"
      style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surf-w2)' }}
    >
      {[
        { label: 'Ticker',     w: 130 },
        { label: 'Upside',     w: 76 },
        { label: 'Signal',     w: 72 },
        { label: 'Confidence', w: 68 },
        { label: 'Entry Zone', flex: true },
        { label: 'Price',      w: 110 },
        { label: 'Target',     w: 104 },
        { label: 'Stop Loss',  w: 104 },
        { label: 'Timeframe',  w: 90 },
      ].map(col => (
        <div
          key={col.label}
          className="text-xs font-semibold"
          style={{
            ...(col.flex ? { flex: 1, minWidth: 0 } : { width: col.w, flexShrink: 0 }),
            color: 'var(--text-w35)',
          }}
        >
          {col.label}
        </div>
      ))}
    </div>
  )
}

/**
 * Standalone "Catalyst-Driven" signals page (component name kept as-is,
 * internal only) — real, fully-vetted signals
 * (Signal.catalystType != null, filtered server-side before this component
 * ever sees them), rendered with the exact same SignalRow card format as
 * the main dashboard. This is a real filtered view of vetted signals, NOT
 * the separate unvetted News Catalyst Alerts feature.
 *
 * Deliberately lighter than SignalBoardClient — no category tabs (this
 * page IS the category), no session chips. Type filter + tracker wiring
 * mirror the same patterns from there for consistency.
 */
export default function EventDrivenSignalsClient({ signals, tier }: { signals: Signal[]; tier: 'free' | 'pro' | 'max' }) {
  const isFree = tier === 'free'
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [trackedMap, setTrackedMap] = useState<Map<string, string>>(new Map())

  const allTickers = useMemo(() => [...new Set(signals.map(s => s.ticker))], [signals])
  const liveQuotes = useLiveQuotes(isFree ? [] : allTickers, 12_000)

  useEffect(() => {
    fetch('/api/tracker')
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; signalId: string }[]) => {
        setTrackedMap(new Map(data.map(t => [t.signalId, t.id])))
      })
      .catch(() => {})
  }, [])

  const handleTrackToggle = useCallback((signalId: string, newTrackedId: string | null) => {
    setTrackedMap(prev => {
      const next = new Map(prev)
      if (newTrackedId) next.set(signalId, newTrackedId)
      else next.delete(signalId)
      return next
    })
  }, [])

  const filtered = useMemo(() => {
    const list = typeFilter === 'all' ? signals : signals.filter(s => s.signalType === typeFilter)
    return [...list].sort((a, b) => b.confidence - a.confidence)
  }, [signals, typeFilter])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {TYPE_FILTERS.map(f => (
          <FilterChip key={f.key} label={f.label} active={typeFilter === f.key} onClick={() => setTypeFilter(f.key)} />
        ))}
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm" style={{ color: 'var(--text-w35)' }}>
              No catalyst-driven setups cleared today&apos;s threshold.
            </p>
          </div>
        ) : (
          <>
            {renderColumnHeaders()}
            {filtered.map((s, idx) => {
              const isSTLocked = isFree && (s.timeframeCategory === 'intraday' || s.timeframeCategory === 'days_1_3')
              return (
                <SignalRow
                  key={s.id}
                  signal={s}
                  tier={tier}
                  isEven={idx % 2 === 0}
                  isFreePick={false}
                  trackedId={trackedMap.get(s.id) ?? null}
                  onTrackToggle={handleTrackToggle}
                  isShortTermLocked={isSTLocked}
                  timeframeBadge={s.timeframeCategory === 'intraday' ? 'intraday' : s.timeframeCategory === 'days_1_3' ? '1-3days' : null}
                  livePrice={liveQuotes[s.ticker]?.price ?? null}
                  liveUpdatedAt={liveQuotes[s.ticker]?.lastUpdated ?? null}
                />
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
