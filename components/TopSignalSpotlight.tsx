'use client'

import { useState } from 'react'
import { ChevronDown, TrendingUp, TrendingDown } from 'lucide-react'

export type SpotlightSignal = {
  ticker: string
  companyName: string
  signalType: string
  confidence: number
  entryZoneLow: number
  entryZoneHigh: number
  targetPrice: number
  stopLoss: number
  timeHorizon: string
  thesis: string
}

/**
 * Today's highest-confidence active signal, expand-on-click. Follows the
 * same local-state expand/collapse interaction SignalRow.tsx already
 * establishes on the real dashboard (useState boolean, chevron rotate,
 * reveal-below) rather than inventing a new interaction pattern — but
 * deliberately does NOT replicate SignalRow's live-price /details fetch,
 * obscure-for-free-tier logic, or zone-distance calc. Every field shown
 * here (thesis, entry zone, stop loss) is already on the Signal row from
 * the initial query, so no extra request is needed to expand.
 */
export default function TopSignalSpotlight({ signal }: { signal: SpotlightSignal }) {
  const [expanded, setExpanded] = useState(false)
  const isShort = signal.signalType === 'SHORT' || signal.signalType === 'SELL'

  return (
    <div className="mb-3" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {isShort
            ? <TrendingDown className="w-4 h-4 shrink-0" style={{ color: 'var(--short)' }} />
            : <TrendingUp className="w-4 h-4 shrink-0" style={{ color: 'var(--buy)' }} />}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="data-label" style={{ color: 'var(--text-dim)' }}>Top Signal</span>
              <span className="font-data font-bold text-sm" style={{ color: 'var(--text-high)' }}>{signal.ticker}</span>
              <span className="text-xs truncate" style={{ color: 'var(--text-w40)' }}>{signal.companyName}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-data text-xs" style={{ color: 'var(--text-w50)' }}>Target ${signal.targetPrice.toFixed(2)}</span>
          <span className="font-data text-sm font-bold" style={{ color: '#009BFF' }}>{signal.confidence.toFixed(0)}%</span>
          <ChevronDown
            className="w-4 h-4 transition-transform"
            style={{ color: 'var(--text-w40)', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="grid grid-cols-3 gap-3 mt-3 mb-3">
            <div>
              <p className="data-label mb-0.5" style={{ color: 'var(--text-dim)' }}>Entry Zone</p>
              <p className="font-data text-sm font-semibold" style={{ color: 'var(--text-high)' }}>
                ${signal.entryZoneLow.toFixed(2)}–${signal.entryZoneHigh.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="data-label mb-0.5" style={{ color: 'var(--text-dim)' }}>Stop Loss</p>
              <p className="font-data text-sm font-semibold" style={{ color: 'var(--short)' }}>${signal.stopLoss.toFixed(2)}</p>
            </div>
            <div>
              <p className="data-label mb-0.5" style={{ color: 'var(--text-dim)' }}>Horizon</p>
              <p className="font-data text-sm font-semibold" style={{ color: 'var(--text-high)' }}>{signal.timeHorizon}</p>
            </div>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-w60)' }}>{signal.thesis}</p>
        </div>
      )}
    </div>
  )
}
