'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { ChevronDown, Search, TrendingUp, History, RefreshCw, Loader2 } from 'lucide-react'
import Link from 'next/link'
import SignalRow from './SignalRow'
import SignalHistoryTab from './SignalHistoryTab'
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

// ─── daily free picks ─────────────────────────────────────────────────────────

const FREE_SIGNAL_COUNT = 5

/**
 * Returns a deterministic Set of 5 signal IDs for today's free picks.
 * Stable across all users — same picks all day, rotate at midnight.
 * Sorted by ID before hashing so the result is independent of fetch order.
 * Picks are spread across categories (large cap, small cap, swing, long-term,
 * high-confidence) for variety rather than clustering in one category.
 */
function getDailyFreePickIds(signals: Signal[]): Set<string> {
  if (signals.length === 0) return new Set()
  if (signals.length <= FREE_SIGNAL_COUNT) return new Set(signals.map(s => s.id))

  const today = new Date().toISOString().slice(0, 10) // "2026-06-04"
  let hash = 5381
  for (const c of today) hash = ((hash << 5) + hash + c.charCodeAt(0)) >>> 0

  const sorted = [...signals].sort((a, b) => a.id.localeCompare(b.id))

  // Category pools — attempt to pick one from each for variety.
  // Pools are ordered by specificity; each pool filters independently.
  const pools: Signal[][] = [
    sorted.filter(s => isLargeCapTicker(s) && s.signalType === 'BUY'),
    sorted.filter(s => !isLargeCapTicker(s) && !isMomentum(s)),   // small/mid-cap
    sorted.filter(s => isSwingTrade(String(s.timeHorizon))),
    sorted.filter(s => isLongTerm(String(s.timeHorizon))),
    sorted.filter(s => isMomentum(s)),
  ]

  const picked = new Set<string>()

  for (let i = 0; i < pools.length && picked.size < FREE_SIGNAL_COUNT; i++) {
    const available = pools[i].filter(s => !picked.has(s.id))
    if (available.length > 0) {
      picked.add(available[(hash + i * 1013) % available.length].id)
    }
  }

  // Top-up from the full sorted list if categories didn't yield enough
  for (const s of sorted) {
    if (picked.size >= FREE_SIGNAL_COUNT) break
    picked.add(s.id)
  }

  return picked
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
          : { backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-w60)', border: '1px solid var(--border)' }
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
  isAdmin   = false,
  isYesterday = false,
  lastGenerated = null,
}: {
  signals: Signal[]
  tier: 'free' | 'pro' | 'max'
  isAdmin?:      boolean
  isYesterday?:  boolean
  lastGenerated?: string | null
}) {
  const [activeTab, setActiveTab]             = useState<'today' | 'history'>('today')
  const [refreshing, setRefreshing]           = useState(false)
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

  // Compute the 5 daily free picks once (stable for the day, same for all users)
  const freePickIds = useMemo(() => (isFree ? getDailyFreePickIds(signals) : new Set<string>()), [signals, isFree])

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

  async function handleAdminRefresh() {
    setRefreshing(true)
    try {
      await fetch('/api/admin/refresh-signals', { method: 'POST' })
      window.location.reload()
    } catch { /* silent */ }
    finally { setRefreshing(false) }
  }

  // Formatted last-generated time
  const updatedLabel = lastGenerated
    ? new Date(lastGenerated).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York',
      }) + ' EST'
    : null

  return (
    <div className="space-y-5">

      {/* ── TAB BAR ── */}
      <div className="flex items-center gap-1 border-b pb-0" style={{ borderColor: 'var(--border)' }}>
        {(['today', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors relative"
            style={{
              color: activeTab === tab ? '#009BFF' : 'var(--text-w50)',
              borderBottom: activeTab === tab ? '2px solid #009BFF' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab === 'history' && <History className="w-3.5 h-3.5" />}
            {tab === 'today' ? 'Today' : 'History'}
          </button>
        ))}

        {/* Admin refresh — right-aligned, only visible to admin */}
        {isAdmin && activeTab === 'today' && (
          <button
            onClick={handleAdminRefresh}
            disabled={refreshing}
            className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ color: 'var(--text-w50)', border: '1px solid var(--border)' }}
            title="Admin: regenerate today's signals"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Generating…' : 'Refresh signals'}
          </button>
        )}

        {/* Updated timestamp */}
        {updatedLabel && activeTab === 'today' && !isAdmin && (
          <span className="ml-auto text-xs" style={{ color: 'var(--text-w35)' }}>
            {isYesterday ? 'Yesterday · ' : ''}{updatedLabel}
          </span>
        )}
      </div>

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <SignalHistoryTab tier={tier} />
      )}

      {/* ── TODAY TAB ── */}
      {activeTab === 'today' && <>

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
              <span className="font-bold text-white">{Math.min(FREE_SIGNAL_COUNT, signals.length)} free picks.</span>
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
            <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--text-w40)' }}>
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
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-w35)' }} />
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
            <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--text-w40)' }}>
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
                color: 'var(--text-w80)',
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
          <p className="text-sm mt-1" style={{ color: 'var(--text-w40)' }}>
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
                      color: 'var(--text-w40)',
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
                        backgroundColor: 'var(--surf-w2)',
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
                            color: 'var(--text-w35)',
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
                        isFreePick={isFree && freePickIds.has(s.id)}
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
                        <span className="text-sm" style={{ color: 'var(--text-w50)' }}>
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

      </> /* end today tab */}
    </div>
  )
}
