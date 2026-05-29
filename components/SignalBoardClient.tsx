'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { ChevronDown, Search, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import SignalRow from './SignalRow'
import type { Signal } from './SignalCard'

// ─── category helpers ─────────────────────────────────────────────────────────

const LARGE_CAP = new Set([
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AVGO', 'AMD', 'QCOM',
  'INTC', 'TXN', 'MU', 'AMAT', 'ADBE', 'CRM', 'ORCL', 'JPM', 'BAC', 'GS',
  'V', 'MA', 'C', 'WFC', 'MS', 'BLK', 'AXP', 'SCHW', 'JNJ', 'UNH',
  'LLY', 'PFE', 'ABT', 'TMO', 'ISRG', 'MDT', 'AMGN', 'GILD', 'XOM', 'CVX',
  'COP', 'EOG', 'SLB', 'WMT', 'COST', 'MCD', 'SBUX', 'TGT', 'KO', 'PEP',
  'NKE', 'CAT', 'HON', 'RTX', 'LMT', 'GE', 'NFLX', 'DIS', 'CMCSA', 'T', 'VZ',
])

function isLargeCapTicker(s: Signal): boolean {
  return s.signalCategory === 'large_cap' || LARGE_CAP.has(s.ticker)
}
function isLongTerm(h: string): boolean {
  const lower = h.toLowerCase()
  if (lower.includes('year')) return true
  if (lower.includes('month')) {
    const m = lower.match(/(\d+)/)
    return m != null && parseInt(m[1]) >= 3
  }
  return false
}
function isSwingTrade(h: string): boolean {
  return h.toLowerCase().includes('week')
}
function isShortTerm(h: string): boolean {
  return h.toLowerCase().includes('day')
}
function isMomentum(s: Signal): boolean {
  return s.signalType === 'BUY' && s.confidence >= 75
}

// ─── daily free pick ──────────────────────────────────────────────────────────

/**
 * Returns a deterministic signal ID for today's free pick.
 * Stable across all users — same pick all day, changes at midnight.
 * Sorted by ID before hashing so the result is independent of fetch order.
 */
function getDailyFreePickId(signals: Signal[]): string | null {
  if (signals.length === 0) return null
  const today = new Date().toISOString().slice(0, 10) // "2026-05-28"
  let hash = 5381
  for (const c of today) hash = ((hash << 5) + hash + c.charCodeAt(0)) >>> 0
  const sorted = [...signals].sort((a, b) => a.id.localeCompare(b.id))
  return sorted[hash % sorted.length].id
}

// ─── filter/sort types ────────────────────────────────────────────────────────

type TypeFilter = 'all' | 'BUY' | 'WATCH' | 'SHORT'
type TimeframeFilter = 'all' | 'short' | 'swing' | 'long'
type SortKey = 'confidence-desc' | 'confidence-asc' | 'ticker-asc' | 'recent'

const CATEGORIES = [
  { key: 'momentum',   label: 'Momentum',   match: isMomentum },
  { key: 'large-cap',  label: 'Large Cap',  match: isLargeCapTicker },
  { key: 'small-cap',  label: 'Small Cap',  match: (s: Signal) => !isLargeCapTicker(s) },
  { key: 'swing-trade', label: 'Swing Trade', match: (s: Signal) => isSwingTrade(String(s.timeHorizon)) },
  { key: 'long-term',  label: 'Long Term',  match: (s: Signal) => isLongTerm(String(s.timeHorizon)) },
]

const PRO_MOMENTUM_LIMIT = 5

// ─── sub-components ───────────────────────────────────────────────────────────

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
      style={
        active
          ? { backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.4)' }
          : { backgroundColor: 'var(--bg-surface-2)', color: 'rgba(255,255,255,0.6)', border: '1px solid var(--border)' }
      }
    >
      {label}
    </button>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function SignalBoardClient({
  signals,
  tier,
}: {
  signals: Signal[]
  tier: 'free' | 'pro' | 'max'
}) {
  const [typeFilter, setTypeFilter]           = useState<TypeFilter>('all')
  const [timeframeFilter, setTimeframeFilter] = useState<TimeframeFilter>('all')
  const [sortKey, setSortKey]                 = useState<SortKey>('confidence-desc')
  const [search, setSearch]                   = useState('')
  const [collapsedCats, setCollapsedCats]     = useState<Set<string>>(new Set())
  // Map of signalId → trackedSignal record ID
  const [trackedMap, setTrackedMap]           = useState<Map<string, string>>(new Map())

  useEffect(() => {
    fetch('/api/tracker')
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; signalId: string }[]) => {
        setTrackedMap(new Map(data.map(t => [t.signalId, t.id])))
      })
      .catch(() => {/* silent */})
  }, [])

  const handleTrackToggle = useCallback((signalId: string, newTrackedId: string | null) => {
    setTrackedMap(prev => {
      const next = new Map(prev)
      if (newTrackedId) next.set(signalId, newTrackedId)
      else next.delete(signalId)
      return next
    })
  }, [])

  const isFree = tier === 'free'

  // Compute the daily free pick once (stable for the day, same for all users)
  const freePickId = useMemo(() => (isFree ? getDailyFreePickId(signals) : null), [signals, isFree])

  // Filtering + sorting — only active for pro/max users
  const filtered = useMemo(() => {
    if (isFree) return signals // free users see all rows (with locking applied in SignalRow)
    return signals.filter(s => {
      if (typeFilter !== 'all') {
        const t = s.signalType
        if (typeFilter === 'SHORT' && t !== 'SHORT' && t !== 'SELL') return false
        if (typeFilter === 'BUY'   && t !== 'BUY')                   return false
        if (typeFilter === 'WATCH' && t !== 'WATCH')                  return false
      }
      if (search) {
        const q = search.toLowerCase()
        if (!s.ticker.toLowerCase().includes(q) && !s.companyName.toLowerCase().includes(q)) return false
      }
      if (timeframeFilter === 'short' && !isShortTerm(String(s.timeHorizon))) return false
      if (timeframeFilter === 'swing' && !isSwingTrade(String(s.timeHorizon))) return false
      if (timeframeFilter === 'long'  && !isLongTerm(String(s.timeHorizon)))   return false
      return true
    })
  }, [signals, typeFilter, search, timeframeFilter, isFree])

  const sorted = useMemo(() => {
    if (isFree) return filtered // free board order matches DB order
    const arr = [...filtered]
    if (sortKey === 'confidence-desc') return arr.sort((a, b) => b.confidence - a.confidence)
    if (sortKey === 'confidence-asc')  return arr.sort((a, b) => a.confidence - b.confidence)
    if (sortKey === 'ticker-asc')      return arr.sort((a, b) => a.ticker.localeCompare(b.ticker))
    return arr.sort((a, b) => new Date(b.signalDate).getTime() - new Date(a.signalDate).getTime())
  }, [filtered, sortKey, isFree])

  const categories = CATEGORIES.map(cat => ({
    key: cat.key,
    label: cat.label,
    signals: sorted.filter(cat.match),
  })).filter(cat => cat.signals.length > 0)

  function toggleCat(key: string) {
    setCollapsedCats(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-5">

      {/* ── FREE USER BANNER ── */}
      {isFree && (
        <div
          className="rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between"
          style={{
            background: 'linear-gradient(135deg, rgba(0,155,255,0.08) 0%, rgba(0,155,255,0.04) 100%)',
            border: '1px solid rgba(0,155,255,0.25)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(0,155,255,0.15)' }}
            >
              <TrendingUp className="w-4 h-4" style={{ color: '#009BFF' }} />
            </div>
            <p className="text-sm text-white">
              <span className="font-bold" style={{ color: '#009BFF' }}>
                {signals.length} signal{signals.length !== 1 ? 's' : ''}
              </span>
              {' '}available today — you&apos;re seeing{' '}
              <span className="font-bold text-white">1 free pick.</span>
              {' '}Upgrade to unlock all.
            </p>
          </div>
          <Link
            href="/pricing"
            className="text-xs font-bold px-4 py-2 rounded-lg shrink-0 hover:opacity-90 transition-opacity self-start sm:self-auto"
            style={{ backgroundColor: '#009BFF', color: 'white' }}
          >
            View Plans
          </Link>
        </div>
      )}

      {/* ── FILTER BAR (pro / max only) ── */}
      {!isFree && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          {/* Row 1: type filters + search */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Type:
            </span>
            <FilterChip label="All"   active={typeFilter === 'all'}   onClick={() => setTypeFilter('all')} />
            <FilterChip label="BUY"   active={typeFilter === 'BUY'}   onClick={() => setTypeFilter('BUY')} />
            <FilterChip label="WATCH" active={typeFilter === 'WATCH'} onClick={() => setTypeFilter('WATCH')} />
            <FilterChip label="SHORT" active={typeFilter === 'SHORT'} onClick={() => setTypeFilter('SHORT')} />
            <div
              className="flex items-center gap-2 ml-auto rounded-lg px-3 py-1.5"
              style={{ backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}
            >
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
              <input
                type="text"
                placeholder="Search ticker…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-sm text-white placeholder:text-white/30 outline-none w-28"
              />
            </div>
          </div>

          {/* Row 2: timeframe filters + sort */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Timeframe:
            </span>
            <FilterChip label="All"       active={timeframeFilter === 'all'}   onClick={() => setTimeframeFilter('all')} />
            <FilterChip label="Swing"     active={timeframeFilter === 'swing'} onClick={() => setTimeframeFilter('swing')} />
            <FilterChip label="Long Term" active={timeframeFilter === 'long'}  onClick={() => setTimeframeFilter('long')} />
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              className="ml-auto text-xs rounded-lg px-3 py-1.5 outline-none cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-surface-2)',
                color: 'rgba(255,255,255,0.8)',
                border: '1px solid var(--border)',
              }}
            >
              <option value="confidence-desc">Confidence ↓</option>
              <option value="confidence-asc">Confidence ↑</option>
              <option value="ticker-asc">Ticker A–Z</option>
              <option value="recent">Most Recent</option>
            </select>
          </div>
        </div>
      )}

      {/* ── CATEGORY SECTIONS ── */}
      {categories.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <p className="font-semibold text-white">No signals match this filter</p>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Try clearing your filters
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map(cat => {
            const isCollapsed = collapsedCats.has(cat.key)
            const isMom = cat.key === 'momentum'
            const momentumHidden =
              isMom && tier === 'pro' ? Math.max(0, cat.signals.length - PRO_MOMENTUM_LIMIT) : 0
            const shown = isMom && tier === 'pro' ? cat.signals.slice(0, PRO_MOMENTUM_LIMIT) : cat.signals

            return (
              <div
                key={cat.key}
                className="rounded-xl overflow-hidden"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              >
                {/* Category header */}
                <button
                  onClick={() => toggleCat(cat.key)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white">{cat.label}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ backgroundColor: 'rgba(0,155,255,0.1)', color: '#009BFF' }}
                    >
                      {cat.signals.length}
                    </span>
                  </div>
                  <ChevronDown
                    className="w-4 h-4 transition-transform duration-200"
                    style={{
                      color: 'rgba(255,255,255,0.4)',
                      transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    }}
                  />
                </button>

                {!isCollapsed && (
                  <div>
                    {/* Column headers — desktop only */}
                    <div
                      className="hidden sm:flex items-center gap-3 px-4 py-2"
                      style={{
                        borderTop: '1px solid var(--border)',
                        borderBottom: '1px solid var(--border)',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                      }}
                    >
                      {[
                        { label: 'Ticker',     w: 130 },
                        { label: 'Signal',     w: 72 },
                        { label: 'Confidence', w: 68 },
                        { label: 'Entry Zone', flex: true },
                        { label: 'Target',     w: 104 },
                        { label: 'Stop Loss',  w: 104 },
                        { label: 'Timeframe',  w: 90 },
                      ].map(col => (
                        <div
                          key={col.label}
                          className="text-xs font-semibold"
                          style={{
                            ...(col.flex ? { flex: 1, minWidth: 0 } : { width: col.w, flexShrink: 0 }),
                            color: 'rgba(255,255,255,0.35)',
                          }}
                        >
                          {col.label}
                        </div>
                      ))}
                      <div style={{ width: 16, flexShrink: 0 }} />
                    </div>

                    {/* Signal rows */}
                    {shown.map((s, idx) => (
                      <SignalRow
                        key={s.id}
                        signal={s}
                        tier={tier}
                        isEven={idx % 2 === 0}
                        isFreePick={isFree && s.id === freePickId}
                        trackedId={trackedMap.get(s.id) ?? null}
                        onTrackToggle={handleTrackToggle}
                      />
                    ))}

                    {/* Pro momentum limit banner */}
                    {momentumHidden > 0 && (
                      <div
                        className="flex items-center justify-between px-4 py-3"
                        style={{ borderTop: '1px solid var(--border)' }}
                      >
                        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {momentumHidden} more Momentum signal{momentumHidden > 1 ? 's' : ''} — Max tier only
                        </span>
                        <Link
                          href="/pricing"
                          className="text-xs font-semibold px-3 py-1 rounded-lg hover:opacity-90 transition-opacity"
                          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white' }}
                        >
                          Upgrade to Max
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
