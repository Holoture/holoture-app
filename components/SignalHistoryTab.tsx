'use client'

import { useState, useEffect } from 'react'
import {
  ChevronDown, ChevronUp, Lock, TrendingUp, TrendingDown, Minus,
  Loader2, Clock,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface HistoricalSignal {
  id: string
  ticker: string
  companyName: string
  signalType: string
  entryZoneLow: number
  entryZoneHigh: number
  targetPrice: number
  stopLoss: number
  confidence: number
  timeHorizon: string
  thesis: string
  aiSummary: string
  sector: string
  signalDate: string
  isObscured: boolean
}

interface DateGroup {
  date: string
  label: string
  signals: HistoricalSignal[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) { return `$${n.toFixed(2)}` }

function SignalTypeBadge({ type }: { type: string }) {
  const t = type.toUpperCase()
  const [bg, color, Icon] =
    t === 'BUY'   ? ['rgba(29,158,117,0.15)', '#1D9E75', TrendingUp]   :
    t === 'SHORT' ? ['rgba(226,75,74,0.15)',  '#E24B4A', TrendingDown] :
                    ['rgba(186,117,23,0.15)', '#BA7517', Minus]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold shrink-0"
      style={{ backgroundColor: bg, color, border: `1px solid ${color}44` }}
    >
      <Icon className="w-2.5 h-2.5" />{t}
    </span>
  )
}

function HistoricalSignalRow({ s }: { s: HistoricalSignal }) {
  const [expanded, setExpanded] = useState(false)

  const confColor =
    s.confidence >= 75 ? '#1D9E75' : s.confidence >= 55 ? '#BA7517' : '#E24B4A'

  if (s.isObscured) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-1" style={{ color: 'var(--text-w25)', width: 90 }}>
          <Lock className="w-3 h-3" />
          <span className="text-sm font-semibold">PRO</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surf-w5)', color: 'var(--text-w30)' }}>
          Unlock with Pro
        </span>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-w25)' }}>••••</span>
      </div>
    )
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Ticker */}
        <div style={{ width: 80, flexShrink: 0 }}>
          <p className="text-sm font-bold text-white">{s.ticker}</p>
          <p className="text-xs truncate" style={{ color: 'var(--text-w40)', maxWidth: 78 }}>{s.sector}</p>
        </div>

        {/* Badge */}
        <div style={{ width: 72, flexShrink: 0 }}>
          <SignalTypeBadge type={s.signalType} />
        </div>

        {/* Confidence */}
        <div style={{ width: 60, flexShrink: 0 }}>
          <span className="text-sm font-bold" style={{ color: confColor }}>
            {s.confidence.toFixed(1)}%
          </span>
        </div>

        {/* Prices — hidden on mobile */}
        <div className="hidden sm:flex flex-1 items-center gap-4 text-xs" style={{ color: 'var(--text-w55)' }}>
          <span>Entry {fmt(s.entryZoneLow)}–{fmt(s.entryZoneHigh)}</span>
          <span style={{ color: '#1D9E75' }}>▲ {fmt(s.targetPrice)}</span>
          <span style={{ color: '#E24B4A' }}>▼ {fmt(s.stopLoss)}</span>
        </div>

        {/* Outcome badge */}
        <div className="flex items-center gap-1 ml-auto shrink-0" style={{ color: 'var(--text-w40)', fontSize: 11 }}>
          <Clock className="w-3 h-3" />
          <span>Pending</span>
        </div>

        {/* Expand chevron */}
        <ChevronDown
          className="w-4 h-4 shrink-0 transition-transform"
          style={{ color: 'var(--text-w30)', transform: expanded ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {expanded && (
        <div
          className="px-4 py-4 space-y-3"
          style={{ backgroundColor: 'var(--surf-w3)', borderTop: '1px solid var(--border)' }}
        >
          {/* Mobile price grid */}
          <div className="grid grid-cols-3 gap-3 sm:hidden">
            {[
              { label: 'Entry', value: `${fmt(s.entryZoneLow)}–${fmt(s.entryZoneHigh)}`, color: 'var(--text-w80)' },
              { label: 'Target', value: fmt(s.targetPrice), color: '#1D9E75' },
              { label: 'Stop', value: fmt(s.stopLoss), color: '#E24B4A' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg p-2.5 text-center" style={{ backgroundColor: 'var(--bg-surface)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-w40)' }}>{label}</p>
                <p className="text-xs font-semibold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Confidence bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs" style={{ color: 'var(--text-w40)' }}>Confidence</span>
              <span className="text-xs font-bold" style={{ color: confColor }}>{s.confidence.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--surf-w8)' }}>
              <div className="h-full rounded-full" style={{ width: `${s.confidence}%`, backgroundColor: confColor }} />
            </div>
          </div>

          {/* Time horizon */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-w40)' }}>Horizon:</span>
            <span className="text-xs font-semibold text-white">{s.timeHorizon}</span>
          </div>

          {/* AI Summary */}
          {s.aiSummary && (
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-w60)' }}>
              {s.aiSummary}
            </p>
          )}

          {/* Thesis */}
          {s.thesis && (
            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-surface)' }}>
              <p className="text-xs font-semibold text-white mb-1">Thesis</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-w70)' }}>{s.thesis}</p>
            </div>
          )}

          <div className="flex items-center gap-1" style={{ color: 'var(--text-w35)', fontSize: 11 }}>
            <Clock className="w-3 h-3" />
            <span>Outcome pending — comparison requires historical price data</span>
          </div>
        </div>
      )}
    </div>
  )
}

function DateGroupSection({ group }: { group: DateGroup }) {
  const [open, setOpen] = useState(true)
  const visibleCount  = group.signals.filter(s => !s.isObscured).length
  const obscuredCount = group.signals.filter(s =>  s.isObscured).length

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      {/* Date header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-white text-sm">{group.label}</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ backgroundColor: 'rgba(0,155,255,0.1)', color: '#009BFF' }}
          >
            {group.signals.length} signals
          </span>
          {obscuredCount > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-w35)' }}>
              {visibleCount} visible · {obscuredCount} locked
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-w40)' }} />
          : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-w40)' }} />
        }
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {group.signals.map(s => <HistoricalSignalRow key={s.id} s={s} />)}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SignalHistoryTab({ tier }: { tier: 'free' | 'pro' | 'max' }) {
  const [groups, setGroups]   = useState<DateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays]       = useState(7)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/signals/history?days=${days}`)
      .then(r => r.json())
      .then(data => setGroups(data.groups ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  return (
    <div className="space-y-4">
      {/* Range selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-w40)' }}>Show:</span>
        {[7, 14, 30].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={
              days === d
                ? { backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.4)' }
                : { backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-w55)', border: '1px solid var(--border)' }
            }
          >
            Last {d} days
          </button>
        ))}
      </div>

      {/* Access note for free users */}
      {tier === 'free' && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'rgba(0,155,255,0.07)', border: '1px solid rgba(0,155,255,0.2)', color: 'var(--text-w60)' }}
        >
          <span className="font-semibold text-white">Free plan:</span>
          {' '}You can see your 5 daily picks historically. Upgrade to Pro to access the full signal history.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-w40)' }} />
        </div>
      ) : groups.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <p className="font-semibold text-white">No history found</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-w40)' }}>Signal history builds up as signals are generated daily.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(g => <DateGroupSection key={g.date} group={g} />)}
        </div>
      )}
    </div>
  )
}
