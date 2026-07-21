'use client'

import { useState, useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'

export type MoverRow = {
  ticker: string
  companyName: string | null
  extendedLastPrice: number
  pctChange: number
  dollarChange: number
}

type SortDir = 'desc' | 'asc'

export default function MoversTable({ rows }: { rows: MoverRow[] }) {
  // This section's own sort control — separate from the main dashboard's
  // sort/filter, which only applies to the signal board.
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    const arr = [...rows]
    arr.sort((a, b) => (sortDir === 'desc' ? b.pctChange - a.pctChange : a.pctChange - b.pctChange))
    return arr
  }, [rows, sortDir])

  if (rows.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-2">
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
          <div className="text-xs font-semibold" style={{ width: 130, flexShrink: 0, color: 'var(--text-w40)' }}>Ticker</div>
          <div className="text-xs font-semibold" style={{ flex: 1, minWidth: 0, color: 'var(--text-w40)' }}>Company</div>
          <div className="text-xs font-semibold text-right" style={{ width: 100, flexShrink: 0, color: 'var(--text-w40)' }}>Price</div>
          <div className="text-xs font-semibold text-right" style={{ width: 90, flexShrink: 0, color: 'var(--text-w40)' }}>$ Change</div>
          <div className="text-xs font-semibold text-right" style={{ width: 90, flexShrink: 0, color: 'var(--text-w40)' }}>% Change</div>
        </div>

        {sorted.map((m, idx) => {
          const isUp = m.pctChange >= 0
          const color = isUp ? '#4ade80' : '#f87171'
          return (
            <div
              key={m.ticker}
              className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-4 py-3"
              style={{
                borderBottom: idx < sorted.length - 1 ? '1px solid var(--border)' : 'none',
                backgroundColor: idx % 2 === 0 ? 'var(--surf-w18)' : 'transparent',
              }}
            >
              <div className="flex items-center gap-2 sm:block" style={{ width: 130, flexShrink: 0 }}>
                <span className="font-bold text-white font-data" style={{ fontSize: 16 }}>{m.ticker}</span>
                <span className="sm:hidden text-xs" style={{ color: 'var(--text-w40)' }}>{m.companyName ?? ''}</span>
              </div>
              <div className="hidden sm:block truncate text-sm text-white" style={{ flex: 1, minWidth: 0, opacity: 0.75 }}>
                {m.companyName ?? '—'}
              </div>
              <div className="text-sm font-data text-white sm:text-right" style={{ width: 100, flexShrink: 0 }}>
                {formatCurrency(m.extendedLastPrice)}
              </div>
              <div className="font-data font-bold text-sm sm:text-right" style={{ width: 90, flexShrink: 0, color }}>
                {isUp ? '+' : ''}{formatCurrency(m.dollarChange)}
              </div>
              <div className="font-data font-bold text-sm sm:text-right" style={{ width: 90, flexShrink: 0, color }}>
                {isUp ? '+' : ''}{m.pctChange.toFixed(2)}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
