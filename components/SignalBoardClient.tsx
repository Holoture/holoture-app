'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { ChevronDown, Search, TrendingUp, History, RefreshCw, Clock, SlidersHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import SignalRow from './SignalRow'
import SignalHistoryTab from './SignalHistoryTab'
import type { Signal } from './SignalCard'
import { signalUpside } from '@/lib/signal-upside'

// ─── category helpers ─────────────────────────────────────────────────────────

// Trusts the server-assigned signalCategory only — it's now computed from a
// real live market-cap check at signal-creation time (see
// lib/marketCapClassification.ts), not a hardcoded ticker list. A second,
// independent hardcoded list here used to mask some misclassifications
// (e.g. mega-caps) while leaving others (anything not on either list)
// wrong; removed rather than kept as a redundant, driftable source of truth.
function isLargeCapTicker(s: Signal): boolean {
  return s.signalCategory === 'large_cap'
}
// Server-assigned timeframeCategory (lib/timeframe.ts), not parsed from
// timeHorizon text — the regex classifiers this replaced orphaned real
// signals (e.g. "1-3 months" matched none of them). Falls back to 'swing'
// only for pre-migration rows that predate the backfill.
function isLongTerm(s: Signal): boolean {
  return s.timeframeCategory === 'long_term'
}
function isSwingTrade(s: Signal): boolean {
  return s.timeframeCategory === 'swing' || !s.timeframeCategory
}
function isIntraday(s: Signal): boolean {
  return s.timeframeCategory === 'intraday'
}
function is1to3Days(s: Signal): boolean {
  return s.timeframeCategory === 'days_1_3'
}
function isShortTermSignal(s: Signal): boolean {
  return isIntraday(s) || is1to3Days(s)
}
// Display/filter-only union — the stored timeframeCategory enum values
// (intraday, days_1_3, momentum) are untouched; this just groups them
// under one "Momentum" tab since all three are short-fuse, high-risk
// setups from the user's perspective. Real spike-scanner signals
// (timeframeCategory === 'momentum') previously had no matching section
// on the "All Signals" tab at all — this also fixes that gap.
function isMomentumGroup(s: Signal): boolean {
  return isIntraday(s) || is1to3Days(s) || s.timeframeCategory === 'momentum'
}

// ─── market hours helpers ─────────────────────────────────────────────────────

function checkMarketOpen(): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false,
    }).formatToParts(new Date())
    const weekday = parts.find(p => p.type === 'weekday')?.value ?? ''
    if (weekday === 'Sat' || weekday === 'Sun') return false
    const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10)
    const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10)
    const mins = h * 60 + m
    return mins >= 9 * 60 + 30 && mins < 16 * 60
  } catch { return false }
}

function checkAfterClose(): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour: 'numeric', hour12: false,
    }).formatToParts(new Date())
    return parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10) >= 16
  } catch { return false }
}

// ─── daily free picks ─────────────────────────────────────────────────────────

const FREE_SIGNAL_COUNT = 5

function getDailyFreePickIds(signals: Signal[]): Set<string> {
  // Intraday and 1-3 day signals are Pro/Max only — exclude from free picks
  const eligible = signals.filter(s => !isShortTermSignal(s))
  if (eligible.length === 0) return new Set()
  if (eligible.length <= FREE_SIGNAL_COUNT) return new Set(eligible.map(s => s.id))

  const today = new Date().toISOString().slice(0, 10)
  let hash = 5381
  for (const c of today) hash = ((hash << 5) + hash + c.charCodeAt(0)) >>> 0

  const sorted = [...eligible].sort((a, b) => a.id.localeCompare(b.id))
  const pools: Signal[][] = [
    sorted.filter(s => isLargeCapTicker(s) && s.signalType === 'BUY'),
    sorted.filter(s => !isLargeCapTicker(s)),
    sorted.filter(s => isSwingTrade(s)),
    sorted.filter(s => isLongTerm(s)),
  ]

  const picked = new Set<string>()
  for (let i = 0; i < pools.length && picked.size < FREE_SIGNAL_COUNT; i++) {
    const available = pools[i].filter(s => !picked.has(s.id))
    if (available.length > 0) picked.add(available[(hash + i * 1013) % available.length].id)
  }
  for (const s of sorted) {
    if (picked.size >= FREE_SIGNAL_COUNT) break
    picked.add(s.id)
  }
  return picked
}

// ─── types ────────────────────────────────────────────────────────────────────

// 'options' tab removed — options signals now live at their own /options
// route (see app/options/page.tsx), not on the main dashboard.
type CategoryTab = 'all' | 'large-cap' | 'small-cap' | 'swing-trade' | 'long-term' | 'momentum' | 'history'
type TypeFilter = 'all' | 'BUY' | 'WATCH' | 'SHORT'
type TimeframeFilter = 'all' | 'momentum' | 'swing' | 'long'
type SortKey = 'confidence-desc' | 'confidence-asc' | 'ticker-asc' | 'recent' | 'time-sensitivity' | 'upside-desc' | 'upside-asc'

const CATEGORY_TABS: { key: CategoryTab; label: string; maxOnly?: boolean }[] = [
  { key: 'all',         label: 'All Signals' },
  { key: 'large-cap',   label: 'Large Cap' },
  { key: 'small-cap',   label: 'Small Cap' },
  { key: 'swing-trade', label: 'Swing Trade' },
  { key: 'long-term',   label: 'Long Term' },
  { key: 'momentum',    label: 'Momentum' },
  { key: 'history',     label: 'History' },
]

// Sections for "All Signals" tab — first-match-wins, time-priority order
const ALL_SECTIONS: { key: string; label: string; match: (s: Signal) => boolean }[] = [
  { key: 'momentum',    label: 'Momentum',    match: isMomentumGroup },
  { key: 'large-cap',  label: 'Large Cap',   match: isLargeCapTicker },
  { key: 'small-cap',  label: 'Small Cap',   match: (s) => !isLargeCapTicker(s) },
  { key: 'swing-trade', label: 'Swing Trade', match: isSwingTrade },
  { key: 'long-term',  label: 'Long Term',   match: isLongTerm },
]

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

function EmptyFilter() {
  return (
    <div className="rounded-xl p-10 text-center"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <p className="font-semibold text-white">No signals match this filter</p>
      <p className="text-sm mt-1" style={{ color: 'var(--text-w40)' }}>Try clearing your filters</p>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function SignalBoardClient({
  signals,
  tier,
  isAdmin   = false,
  isYesterday = false,
  lastGenerated = null,
  volumeByTicker = {},
}: {
  signals: Signal[]
  tier: 'free' | 'pro' | 'max'
  isAdmin?:      boolean
  isYesterday?:  boolean
  lastGenerated?: string | null
  /** ticker -> real avg 10-day dollar volume, from TickerUniverse (weekly screen). Missing for signals sourced outside the screened universe — those show "—" and are never dropped by a volume filter unless one is explicitly set. */
  volumeByTicker?: Record<string, number>
}) {
  const [activeTab, setActiveTab]             = useState<CategoryTab>('all')
  const [refreshing, setRefreshing]           = useState(false)
  const [typeFilter, setTypeFilter]           = useState<TypeFilter>('all')
  const [timeframeFilter, setTimeframeFilter] = useState<TimeframeFilter>('all')
  const [sortKey, setSortKey]                 = useState<SortKey>('confidence-desc')
  const [search, setSearch]                   = useState('')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [trackedMap, setTrackedMap]           = useState<Map<string, string>>(new Map())
  const [marketOpen, setMarketOpen]           = useState(false)
  const [afterClose, setAfterClose]           = useState(false)

  // ── Filter panel state (separate from the Sort dropdown and the tab bar) ──
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [priceMin, setPriceMin]               = useState('')
  const [priceMax, setPriceMax]               = useState('')
  const [capBands, setCapBands]               = useState<Set<'large_cap' | 'small_cap'>>(new Set())
  const [volMin, setVolMin]                   = useState('')
  const [volMax, setVolMax]                   = useState('')
  const [sectorFilter, setSectorFilter]       = useState<Set<string>>(new Set())

  useEffect(() => {
    setMarketOpen(checkMarketOpen())
    setAfterClose(checkAfterClose())
  }, [])

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

  const isFree = tier === 'free'
  const freePickIds = useMemo(() => (isFree ? getDailyFreePickIds(signals) : new Set<string>()), [signals, isFree])

  // Hide intraday signals after market close (4pm EST) — no longer actionable
  const activeSignals = useMemo(() => {
    if (!afterClose) return signals
    return signals.filter(s => !isIntraday(s))
  }, [signals, afterClose])

  // Time-sensitivity score for sorting
  function timeSensitivityScore(s: Signal): number {
    if (isIntraday(s)) return 0
    if (is1to3Days(s)) return 1
    if (isSwingTrade(s)) return 2
    return 3
  }

  // Representative price for the price filter — Signal has no standalone
  // "current price" field, so the entry-zone midpoint is the closest real
  // number available (not fabricated — both bounds come from the AI-set
  // entry zone Schwab-priced at generation time).
  function signalPrice(s: Signal): number {
    return (s.entryZoneLow + s.entryZoneHigh) / 2
  }

  // Sectors available to filter by — derived from what's actually on the
  // board right now, not a hardcoded list.
  const sectorOptions = useMemo(() => {
    return [...new Set(activeSignals.map(s => s.sector).filter(Boolean))].sort()
  }, [activeSignals])

  const activeFilterCount =
    (priceMin !== '' || priceMax !== '' ? 1 : 0) +
    (capBands.size > 0 ? 1 : 0) +
    (volMin !== '' || volMax !== '' ? 1 : 0) +
    (sectorFilter.size > 0 ? 1 : 0)

  function clearAllFilters() {
    setPriceMin(''); setPriceMax('')
    setCapBands(new Set())
    setVolMin(''); setVolMax('')
    setSectorFilter(new Set())
  }

  const filtered = useMemo(() => {
    if (isFree) return activeSignals
    return activeSignals.filter(s => {
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
      if (timeframeFilter === 'momentum' && !isMomentumGroup(s)) return false
      if (timeframeFilter === 'swing'    && !isSwingTrade(s)) return false
      if (timeframeFilter === 'long'     && !isLongTerm(s)) return false

      // Price range (entry-zone midpoint)
      if (priceMin !== '' || priceMax !== '') {
        const price = signalPrice(s)
        if (priceMin !== '' && price < Number(priceMin)) return false
        if (priceMax !== '' && price > Number(priceMax)) return false
      }

      // Market-cap band — real signalCategory from TickerUniverse-driven
      // classification, not a fabricated numeric range.
      if (capBands.size > 0) {
        if (!s.signalCategory || !capBands.has(s.signalCategory as 'large_cap' | 'small_cap')) return false
      }

      // Avg dollar volume — only known for tickers currently in the
      // screened universe. A signal missing this data fails an explicitly
      // set volume filter (can't be verified to pass) but is never dropped
      // when no volume filter is active.
      if (volMin !== '' || volMax !== '') {
        const vol = volumeByTicker[s.ticker]
        if (vol == null) return false
        if (volMin !== '' && vol < Number(volMin)) return false
        if (volMax !== '' && vol > Number(volMax)) return false
      }

      // Sector multi-select
      if (sectorFilter.size > 0 && !sectorFilter.has(s.sector)) return false

      return true
    })
  }, [activeSignals, typeFilter, search, timeframeFilter, isFree, priceMin, priceMax, capBands, volMin, volMax, sectorFilter, volumeByTicker])

  const sorted = useMemo(() => {
    if (isFree) return filtered
    const arr = [...filtered]
    if (sortKey === 'time-sensitivity') {
      return arr.sort((a, b) => {
        const diff = timeSensitivityScore(a) - timeSensitivityScore(b)
        return diff !== 0 ? diff : b.confidence - a.confidence
      })
    }
    if (sortKey === 'upside-desc')     return arr.sort((a, b) => signalUpside(b) - signalUpside(a))
    if (sortKey === 'upside-asc')      return arr.sort((a, b) => signalUpside(a) - signalUpside(b))
    if (sortKey === 'confidence-desc') return arr.sort((a, b) => b.confidence - a.confidence)
    if (sortKey === 'confidence-asc')  return arr.sort((a, b) => a.confidence - b.confidence)
    if (sortKey === 'ticker-asc')      return arr.sort((a, b) => a.ticker.localeCompare(b.ticker))
    return arr.sort((a, b) => new Date(b.signalDate).getTime() - new Date(a.signalDate).getTime())
  }, [filtered, sortKey, isFree])

  // Sections for the "All Signals" tab (first-match-wins)
  const allSections = useMemo(() => {
    const used = new Set<string>()
    return ALL_SECTIONS.map(sec => {
      const sigs = sorted.filter(s => !used.has(s.id) && sec.match(s))
      sigs.forEach(s => used.add(s.id))
      return { ...sec, signals: sigs }
    }).filter(sec => sec.signals.length > 0)
  }, [sorted])

  // Signals for a specific category tab
  const categorySignals = useMemo(() => {
    if (activeTab === 'all' || activeTab === 'history') return []
    const matchFns: Partial<Record<CategoryTab, (s: Signal) => boolean>> = {
      'large-cap':  isLargeCapTicker,
      'small-cap':  s => !isLargeCapTicker(s),
      'swing-trade': isSwingTrade,
      'long-term':  isLongTerm,
      'momentum':   isMomentumGroup,
    }
    const fn = matchFns[activeTab]
    if (!fn) return sorted
    return [...sorted.filter(fn)].sort((a, b) => {
      const diff = timeSensitivityScore(a) - timeSensitivityScore(b)
      return diff !== 0 ? diff : 0
    })
  }, [sorted, activeTab])

  function toggleSection(key: string) {
    setCollapsedSections(prev => {
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
    } catch { } finally { setRefreshing(false) }
  }

  // ─── renderers ──────────────────────────────────────────────────────────────

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
    )
  }

  function renderSignalRows(sigs: Signal[], catKey: string) {
    return (
      <>
        {sigs.map((s, idx) => {
          const badge: 'intraday' | '1-3days' | null =
            isIntraday(s) ? 'intraday' : is1to3Days(s) ? '1-3days' : null
          const isSTLocked = isFree && isShortTermSignal(s)
          return (
            <SignalRow
              key={s.id}
              signal={s}
              tier={tier}
              isEven={idx % 2 === 0}
              isFreePick={isFree && freePickIds.has(s.id) && !isShortTermSignal(s)}
              trackedId={trackedMap.get(s.id) ?? null}
              onTrackToggle={handleTrackToggle}
              isShortTermLocked={isSTLocked}
              timeframeBadge={badge}
              isMarketOpen={marketOpen}
            />
          )
        })}
      </>
    )
  }

  function renderSection(sec: { key: string; label: string; signals: Signal[] }) {
    const isCollapsed = collapsedSections.has(sec.key)
    const isMomentumSec = sec.key === 'momentum'

    return (
      <div
        key={sec.key}
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        {/* Section header */}
        <button
          onClick={() => toggleSection(sec.key)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2 flex-wrap">
            {isMomentumSec && <Clock className="w-4 h-4 shrink-0" style={{ color: '#f97316' }} />}
            <span className="font-bold text-white">{sec.label}</span>

            {isMomentumSec && marketOpen && (
              <span className="inline-flex items-center gap-1">
                <span className="relative flex w-2 h-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#4ade80' }} />
                  <span className="relative inline-flex rounded-full w-2 h-2" style={{ backgroundColor: '#22c55e' }} />
                </span>
                <span className="text-xs font-bold" style={{ color: '#4ade80' }}>LIVE</span>
              </span>
            )}
            {isMomentumSec && !marketOpen && (
              <span className="text-xs" style={{ color: 'var(--text-w35)' }}>Time sensitive</span>
            )}

            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: 'rgba(0,155,255,0.1)', color: '#009BFF' }}
            >
              {sec.signals.length}
            </span>
          </div>
          <ChevronDown
            className="w-4 h-4 shrink-0 transition-transform duration-200"
            style={{ color: 'var(--text-w40)', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          />
        </button>

        {!isCollapsed && (
          <div>
            {renderColumnHeaders()}
            {renderSignalRows(sec.signals, sec.key)}
          </div>
        )}
      </div>
    )
  }

  // ─── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── TAB BAR ── */}
      <div
        className="flex items-center gap-0 border-b overflow-x-auto"
        style={{ borderColor: 'var(--border)' }}
      >
        {CATEGORY_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors relative whitespace-nowrap shrink-0"
            style={{
              color: activeTab === tab.key ? '#009BFF' : 'var(--text-w50)',
              borderBottom: activeTab === tab.key ? '2px solid #009BFF' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab.key === 'history' && <History className="w-3.5 h-3.5" />}
            {tab.label}
            {tab.maxOnly && (
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)' }}
              >
                MAX
              </span>
            )}
          </button>
        ))}

        {/* Admin refresh + timestamp */}
        <div className="ml-auto pl-3 flex items-center gap-2 shrink-0">
          {isAdmin && activeTab !== 'history' && (
            <button
              onClick={handleAdminRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70 disabled:opacity-40"
              style={{ color: 'var(--text-w50)', border: '1px solid var(--border)' }}
              title="Admin: regenerate today's signals"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Generating…' : 'Refresh'}
            </button>
          )}
        </div>
      </div>

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && <SignalHistoryTab tier={tier} />}

      {/* ── SIGNAL TABS (All + category tabs) ── */}
      {activeTab !== 'history' && (
        <>
          {/* Free user — main upgrade banner */}
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
                    {activeSignals.length} signal{activeSignals.length !== 1 ? 's' : ''}
                  </span>
                  {' '}available today — you&apos;re seeing{' '}
                  <span className="font-bold text-white">
                    {Math.min(FREE_SIGNAL_COUNT, activeSignals.filter(s => !isShortTermSignal(s)).length)} free picks.
                  </span>
                  {' '}Upgrade to Pro for the full signal board.
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

          {/* Free user — short-term signals upsell */}
          {isFree && (() => {
            const stCount = activeSignals.filter(isShortTermSignal).length
            if (stCount === 0) return null
            return (
              <div
                className="rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between"
                style={{
                  background: 'linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(249,115,22,0.04) 100%)',
                  border: '1px solid rgba(249,115,22,0.25)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'rgba(249,115,22,0.15)' }}
                  >
                    <Clock className="w-4 h-4" style={{ color: '#f97316' }} />
                  </div>
                  <p className="text-sm text-white">
                    <span className="font-bold" style={{ color: '#f97316' }}>
                      {stCount} short-term signal{stCount !== 1 ? 's' : ''}
                    </span>
                    {' '}available — Intraday &amp; 1–3 day signals require{' '}
                    <span className="font-bold text-white">Pro or Max.</span>
                  </p>
                </div>
                <Link
                  href="/pricing"
                  className="text-xs font-bold px-4 py-2 rounded-lg shrink-0 hover:opacity-90 transition-opacity self-start sm:self-auto"
                  style={{ backgroundColor: '#f97316', color: 'white' }}
                >
                  Upgrade
                </Link>
              </div>
            )
          })()}

          {/* Filter bar (pro/max only) */}
          {!isFree && (
            <div
              className="rounded-xl p-4 space-y-3"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              {/* Row 1: type filters + search */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--text-w40)' }}>Type:</span>
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
                <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--text-w40)' }}>Timeframe:</span>
                <FilterChip label="All"      active={timeframeFilter === 'all'}      onClick={() => setTimeframeFilter('all')} />
                <FilterChip label="Momentum" active={timeframeFilter === 'momentum'} onClick={() => setTimeframeFilter('momentum')} />
                <FilterChip label="Swing"    active={timeframeFilter === 'swing'}    onClick={() => setTimeframeFilter('swing')} />
                <FilterChip label="Long Term" active={timeframeFilter === 'long'}    onClick={() => setTimeframeFilter('long')} />

                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setFilterPanelOpen(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors"
                    style={
                      activeFilterCount > 0
                        ? { backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.4)' }
                        : { backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-w60)', border: '1px solid var(--border)' }
                    }
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Filter
                    {activeFilterCount > 0 && (
                      <span
                        className="text-xs font-bold px-1.5 rounded-full"
                        style={{ backgroundColor: '#009BFF', color: 'white' }}
                      >
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  <select
                    value={sortKey}
                    onChange={e => setSortKey(e.target.value as SortKey)}
                    className="text-xs rounded-lg px-3 py-1.5 outline-none cursor-pointer"
                    style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-w80)', border: '1px solid var(--border)' }}
                  >
                    <option value="confidence-desc">Confidence ↓</option>
                    <option value="confidence-asc">Confidence ↑</option>
                    <option value="upside-desc">Upside ↓</option>
                    <option value="upside-asc">Upside ↑</option>
                    <option value="ticker-asc">Ticker A–Z</option>
                    <option value="recent">Most Recent</option>
                    <option value="time-sensitivity">Time Sensitivity</option>
                  </select>
                </div>
              </div>

              {/* Filter panel — separate control from Sort, combines with tabs/sort/search */}
              {filterPanelOpen && (
                <div
                  className="rounded-lg p-4 space-y-4"
                  style={{ backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Share price */}
                    <div>
                      <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-w40)' }}>Share Price ($)</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number" placeholder="Min" value={priceMin}
                          onChange={e => setPriceMin(e.target.value)}
                          className="w-full text-sm rounded-lg px-2.5 py-1.5 outline-none"
                          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'white' }}
                        />
                        <span style={{ color: 'var(--text-w30)' }}>–</span>
                        <input
                          type="number" placeholder="Max" value={priceMax}
                          onChange={e => setPriceMax(e.target.value)}
                          className="w-full text-sm rounded-lg px-2.5 py-1.5 outline-none"
                          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'white' }}
                        />
                      </div>
                    </div>

                    {/* Avg dollar volume */}
                    <div>
                      <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-w40)' }}>Avg Daily Volume ($)</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number" placeholder="Min" value={volMin}
                          onChange={e => setVolMin(e.target.value)}
                          className="w-full text-sm rounded-lg px-2.5 py-1.5 outline-none"
                          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'white' }}
                        />
                        <span style={{ color: 'var(--text-w30)' }}>–</span>
                        <input
                          type="number" placeholder="Max" value={volMax}
                          onChange={e => setVolMax(e.target.value)}
                          className="w-full text-sm rounded-lg px-2.5 py-1.5 outline-none"
                          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'white' }}
                        />
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-w30)' }}>
                        Only known for tickers in the screened universe — others show &ldquo;—&rdquo;
                      </p>
                    </div>

                    {/* Market cap band */}
                    <div>
                      <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-w40)' }}>Market Cap</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <FilterChip
                          label="Large Cap"
                          active={capBands.has('large_cap')}
                          onClick={() => setCapBands(prev => {
                            const next = new Set(prev)
                            if (next.has('large_cap')) next.delete('large_cap')
                            else next.add('large_cap')
                            return next
                          })}
                        />
                        <FilterChip
                          label="Small/Mid Cap"
                          active={capBands.has('small_cap')}
                          onClick={() => setCapBands(prev => {
                            const next = new Set(prev)
                            if (next.has('small_cap')) next.delete('small_cap')
                            else next.add('small_cap')
                            return next
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sector multi-select */}
                  <div>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-w40)' }}>Sector</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {sectorOptions.map(sec => (
                        <FilterChip
                          key={sec}
                          label={sec}
                          active={sectorFilter.has(sec)}
                          onClick={() => setSectorFilter(prev => {
                            const next = new Set(prev)
                            if (next.has(sec)) next.delete(sec)
                            else next.add(sec)
                            return next
                          })}
                        />
                      ))}
                      {sectorOptions.length === 0 && (
                        <span className="text-xs" style={{ color: 'var(--text-w30)' }}>No sectors available</span>
                      )}
                    </div>
                  </div>

                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearAllFilters}
                      className="flex items-center gap-1 text-xs font-semibold hover:opacity-75 transition-opacity"
                      style={{ color: '#009BFF' }}
                    >
                      <X className="w-3 h-3" /> Clear all filters
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Signal content */}
          {activeTab === 'all' ? (
            allSections.length === 0 ? (
              <EmptyFilter />
            ) : (
              <div className="space-y-4">
                {allSections.map(sec => renderSection(sec))}
              </div>
            )
          ) : (
            /* Category tab — flat list */
            categorySignals.length === 0 ? (
              <EmptyFilter />
            ) : (
              <div
                className="rounded-xl overflow-hidden"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              >
                {renderColumnHeaders()}
                {renderSignalRows(categorySignals, activeTab)}
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
