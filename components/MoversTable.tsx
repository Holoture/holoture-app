'use client'

import { useState, useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import { useLiveQuotes } from '@/lib/useLiveQuotes'
import LiveIndicator from './LiveIndicator'

export type MoverRow = {
  ticker: string
  companyName: string | null
  extendedLastPrice: number
  pctChange: number
  dollarChange: number
  /** Reference price the change is measured against — needed to recompute $/% change from a fresher live quote between cron snapshots. */
  referencePrice: number
}

type SortDir = 'desc' | 'asc'

export default function MoversTable({ rows, isLive = false }: { rows: MoverRow[]; isLive?: boolean }) {
  // This section's own sort control — separate from the main dashboard's
  // sort/filter, which only applies to the signal board.
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Overlay the server-cached live quote on top of the last cron snapshot —
  // reads LiveQuoteCache via /api/live/quotes, never Schwab directly.
  //
  // GATED ON isLive (added 2026-08-10). Two things had to be true for this
  // overlay to be correct, and neither was:
  //   1. referencePrice must be TODAY'S REGULAR CLOSE, not the live price.
  //      cron/movers-snapshot previously stored quote.lastPrice as the
  //      after-hours reference — but that field IS the live extended price,
  //      so (live.price - reference) collapsed to ~0.00% (measured live:
  //      PAYC 0.00 while the raw snapshot read +41.69%). Fixed at the
  //      source: the reference column now holds regularMarketLastPrice.
  //   2. The panel's session must be the one currently trading. A closed
  //      "Last session" panel kept recomputing against a live cache that
  //      updates during the OTHER session, so yesterday's after-hours rows
  //      silently drifted once premarket opened. Frozen panels now render
  //      the stored snapshot verbatim.
  const tickers = useMemo(() => (isLive ? rows.map((r) => r.ticker) : []), [rows, isLive])
  const liveQuotes = useLiveQuotes(tickers, 12_000)

  const merged = useMemo(() => {
    return rows.map((r) => {
      const live = isLive ? liveQuotes[r.ticker] : undefined
      if (!live || r.referencePrice <= 0) return { ...r, liveUpdatedAt: null as string | null }
      const dollarChange = live.price - r.referencePrice
      const pctChange = (dollarChange / r.referencePrice) * 100
      return { ...r, extendedLastPrice: live.price, dollarChange, pctChange, liveUpdatedAt: live.lastUpdated }
    })
  }, [rows, liveQuotes, isLive])

  const sorted = useMemo(() => {
    const arr = [...merged]
    arr.sort((a, b) => (sortDir === 'desc' ? b.pctChange - a.pctChange : a.pctChange - b.pctChange))
    return arr
  }, [merged, sortDir])

  if (rows.length === 0) return null

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2 mb-2">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-w40)' }}>Sort:</span>
        <button
          onClick={() => setSortDir('desc')}
          className="text-xs font-semibold rounded-lg px-3 py-1 transition-colors"
          style={
            sortDir === 'desc'
              ? { backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.4)' }
              : { backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-w60)', border: '1px solid var(--border)' }
          }
        >
          Biggest Gainers
        </button>
        <button
          onClick={() => setSortDir('asc')}
          className="text-xs font-semibold rounded-lg px-3 py-1 transition-colors"
          style={
            sortDir === 'asc'
              ? { backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.4)' }
              : { backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-w60)', border: '1px solid var(--border)' }
          }
        >
          Biggest Losers
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div
          className="hidden sm:flex items-center gap-3 px-4 py-2"
          style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface-2)' }}
        >
          <div className="text-xs font-semibold flex-1" style={{ color: 'var(--text-w40)' }}>Ticker</div>
          <div className="text-xs font-semibold text-right" style={{ width: 100, flexShrink: 0, color: 'var(--text-w40)' }}>Price</div>
          <div className="text-xs font-semibold text-right" style={{ width: 90, flexShrink: 0, color: 'var(--text-w40)' }}>$ Change</div>
          <div className="text-xs font-semibold text-right" style={{ width: 90, flexShrink: 0, color: 'var(--text-w40)' }}>% Change</div>
          <div className="text-xs font-semibold text-right" style={{ width: 80, flexShrink: 0, color: 'var(--text-w40)' }}>Status</div>
        </div>

        {sorted.map((m, idx) => {
          const isUp = m.pctChange >= 0
          const color = isUp ? '#4ade80' : '#f87171'
          const rowStyle = {
            borderBottom: idx < sorted.length - 1 ? '1px solid var(--border)' : 'none',
            backgroundColor: idx % 2 === 0 ? 'var(--surf-w18)' : 'transparent',
          }
          return (
            <div key={m.ticker}>
              {/* Mobile — two compact lines, no fixed-width columns */}
              <div className="flex sm:hidden flex-col gap-1 px-4 py-3" style={rowStyle}>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white font-data" style={{ fontSize: 15 }}>{m.ticker}</span>
                </div>
                <div className="flex items-center gap-4 text-sm font-data">
                  <span className="text-white">{formatCurrency(m.extendedLastPrice)}</span>
                  <span className="font-bold" style={{ color }}>
                    {isUp ? '+' : ''}{formatCurrency(m.dollarChange)}
                  </span>
                  <span className="font-bold" style={{ color }}>
                    {isUp ? '+' : ''}{m.pctChange.toFixed(2)}%
                  </span>
                </div>
                <LiveIndicator lastUpdated={m.liveUpdatedAt} />
              </div>

              {/* Desktop — fixed-width columns matching the header row */}
              <div className="hidden sm:flex sm:items-center gap-3 px-4 py-3" style={rowStyle}>
                <div className="flex-1">
                  <span className="font-bold text-white font-data" style={{ fontSize: 16 }}>{m.ticker}</span>
                </div>
                <div className="text-sm font-data text-white text-right" style={{ width: 100, flexShrink: 0 }}>
                  {formatCurrency(m.extendedLastPrice)}
                </div>
                <div className="font-data font-bold text-sm text-right" style={{ width: 90, flexShrink: 0, color }}>
                  {isUp ? '+' : ''}{formatCurrency(m.dollarChange)}
                </div>
                <div className="font-data font-bold text-sm text-right" style={{ width: 90, flexShrink: 0, color }}>
                  {isUp ? '+' : ''}{m.pctChange.toFixed(2)}%
                </div>
                <div className="flex justify-end" style={{ width: 80, flexShrink: 0 }}>
                  <LiveIndicator lastUpdated={m.liveUpdatedAt} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
