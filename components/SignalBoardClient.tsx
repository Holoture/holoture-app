'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { ChevronDown, Search, TrendingUp, History, RefreshCw, Clock, SlidersHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import SignalRow from './SignalRow'
import SignalHistoryTab from './SignalHistoryTab'
import type { Signal } from './SignalCard'
import { signalUpside } from '@/lib/signal-upside'
import { useLiveQuotes } from '@/lib/useLiveQuotes'
import { getMarketSession, getMarketSessionAt, type MarketSession } from '@/lib/marketSession'

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

// Which session a signal was actually CREATED in — distinct from "is the
// market open right now" (used for the row's live/pulsing badge). This is
// what the Momentum tab's session filter chips slice on, computed honestly
// from signal.createdAt rather than inventing a stored "session" field that
// doesn't exist on the Signal model.
function signalSession(s: Signal): MarketSession {
  return getMarketSessionAt(s.createdAt ? new Date(s.createdAt) : new Date())
}

// ─── market hours helpers ─────────────────────────────────────────────────────

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
// route (see app/options/page.tsx), not on the main dashboard. 'history'
// stays a valid tab value (SignalHistoryTab still renders the same way)
// but is no longer listed in CATEGORY_TABS — it's a demoted link next to
// the tab bar now, not a peer signal-type tab.
type CategoryTab = 'all' | 'large-cap' | 'small-cap' | 'swing-trade' | 'long-term' | 'momentum' | 'history'
type TypeFilter = 'all' | 'BUY' | 'WATCH' | 'SHORT'
type TimeframeFilter = 'all' | 'momentum' | 'swing' | 'long'
type SortKey = 'confidence-desc' | 'confidence-asc' | 'ticker-asc' | 'recent' | 'time-sensitivity' | 'upside-desc' | 'upside-asc'
type SessionFilter = 'all' | 'premarket' | 'regular' | 'afterhours'

const CATEGORY_TABS: { key: CategoryTab; label: string }[] = [
  { key: 'all',         label: 'All Signals' },
  { key: 'momentum',    label: 'Momentum' },
  { key: 'large-cap',   label: 'Large Cap' },
  { key: 'small-cap',   label: 'Small Cap' },
  { key: 'swing-trade', label: 'Swing Trade' },
  { key: 'long-term',   label: 'Long Term' },
]

// Sections for the "All Signals" overview — first-match-wins, Momentum
// leads since it's the most time-sensitive bucket (see IA recommendation:
// signal type is primary nav, Momentum first within it).
const ALL_SECTIONS: { key: string; label: string; match: (s: Signal) => boolean }[] = [
  { key: 'momentum',    label: 'Momentum',    match: isMomentumGroup },
  { key: 'large-cap',  label: 'Large Cap',   match: isLargeCapTicker },
  { key: 'small-cap',  label: 'Small Cap',   match: (s) => !isLargeCapTicker(s) },
  { key: 'swing-trade', label: 'Swing Trade', match: isSwingTrade },
  { key: 'long-term',  label: 'Long Term',   match: isLongTerm },
]

// Capped preview size for the "All Signals" overview — enough to be useful,
// short enough that landing on "All" is no longer a full-stack scroll.
const PREVIEW_CAP = 6

const SESSION_CHIPS: { key: SessionFilter; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'premarket',  label: 'Premarket' },
  { key: 'regular',    label: 'Regular Hours' },
  { key: 'afterhours', label: 'After-Hours' },
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

/** Honest "nothing qualified" message for an empty category or session slice — never hidden, never force-filled. */
function EmptyCategory({ message }: { message: string }) {
  return (
    <div className="px-4 py-6 text-center">
      <p className="text-sm" style={{ color: 'var(--text-w35)' }}>{message}</p>
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
  const [sessionFilter, setSessionFilter]     = useState<SessionFilter>('all')
  const [sortKey, setSortKey]                 = useState<SortKey>('confidence-desc')
  const [search, setSearch]                   = useState('')
  const [trackedMap, setTrackedMap]           = useState<Map<string, string>>(new Map())
  const [afterClose, setAfterClose]           = useState(false)
  const [marketSession, setMarketSessionState] = useState<MarketSession>('closed')

  // ── Filter panel state (Advanced filters — separate from the always-visible Type/Timeframe/Sort row) ──
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [priceMin, setPriceMin]               = useState('')
  const [priceMax, setPriceMax]               = useState('')
  const [capBands, setCapBands]               = useState<Set<'large_cap' | 'small_cap'>>(new Set())
  const [volMin, setVolMin]                   = useState('')
  const [volMax, setVolMax]                   = useState('')
  const [sectorFilter, setSectorFilter]       = useState<Set<string>>(new Set())
  const isFree = tier === 'free'

  useEffect(() => {
    setAfterClose(checkAfterClose())
    setMarketSessionState(getMarketSession())
  }, [])

  // Batched live price poll for every signal on the board — reads the
  // server-side LiveQuoteCache via /api/live/quotes (falls back to an
  // on-demand Schwab fetch there for genuine cache misses, so a row never
  // shows blank). 12s client poll; the cache itself refreshes every 1-5 min
  // depending on session, so this just keeps the UI current with whatever
  // the cache already has — concurrent viewers never multiply upstream
  // Schwab calls beyond the rare cache-miss fallback.
  const allTickers = useMemo(() => {
    return [...new Set(signals.map(s => s.ticker))]
  }, [signals])
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

  // Sections for the "All Signals" overview (first-match-wins) — every
  // section is kept even when empty (never filtered out), so an honest
  // "nothing qualified" message can render instead of silently vanishing.
  const allSections = useMemo(() => {
    const used = new Set<string>()
    return ALL_SECTIONS.map(sec => {
      const sigs = sorted.filter(s => !used.has(s.id) && sec.match(s))
      sigs.forEach(s => used.add(s.id))
      return { ...sec, signals: sigs }
    })
  }, [sorted])

  // Signals for a specific category tab — Momentum additionally honors the
  // session filter chips (classified by each signal's own createdAt session).
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
    let list = sorted.filter(fn)
    if (activeTab === 'momentum' && sessionFilter !== 'all') {
      list = list.filter(s => signalSession(s) === sessionFilter)
    }
    return [...list].sort((a, b) => {
      const diff = timeSensitivityScore(a) - timeSensitivityScore(b)
      return diff !== 0 ? diff : 0
    })
  }, [sorted, activeTab, sessionFilter])

  async function handleAdminRefresh() {
    setRefreshing(true)
    try {
      await fetch('/api/admin/refresh-signals', { method: 'POST' })
      window.location.reload()
    } catch { } finally { setRefreshing(false) }
  }

  // Session-aware badge for Momentum-group rows — replaces the old bare
  // "TIME SENSITIVE" text + separate market-open dot with one label that
  // names the current session explicitly, so it's never confused with the
  // Movers page's own (differently-styled) premarket/after-hours labels.
  function sessionBadgeFor(s: Signal): { label: string; pulsing: boolean } | null {
    if (!isMomentumGroup(s)) return null
    if (marketSession === 'premarket')  return { label: 'PREMARKET SIGNAL', pulsing: false }
    if (marketSession === 'regular')    return { label: 'LIVE NOW', pulsing: true }
    if (marketSession === 'afterhours') return { label: 'AFTER-HOURS SIGNAL', pulsing: false }
    return { label: 'TIME SENSITIVE', pulsing: false }
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
        <div style={{ width: 16, flexShrink: 0 }} />
      </div>
    )
  }

  function renderSignalRows(sigs: Signal[]) {
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
              sessionBadge={sessionBadgeFor(s)}
              livePrice={liveQuotes[s.ticker]?.price ?? null}
              liveUpdatedAt={liveQuotes[s.ticker]?.lastUpdated ?? null}
            />
          )
        })}
      </>
    )
  }

  /** "All Signals" overview — capped preview per category, Momentum first, with a "See all N →" hop to the full tab and an honest empty message when a category has nothing right now. */
  function renderOverviewSection(sec: { key: string; label: string; signals: Signal[] }) {
    const isMomentumSec = sec.key === 'momentum'
    const preview = sec.signals.slice(0, PREVIEW_CAP)
    const remaining = sec.signals.length - preview.length

    return (
      <div
        key={sec.key}
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            {isMomentumSec && <Clock className="w-4 h-4 shrink-0" style={{ color: '#f97316' }} />}
            <span className="font-bold text-white">{sec.label}</span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: 'rgba(0,155,255,0.1)', color: '#009BFF' }}
            >
              {sec.signals.length}
            </span>
          </div>
          {sec.signals.length > 0 && (
            <button
              onClick={() => setActiveTab(sec.key as CategoryTab)}
              className="text-xs font-semibold shrink-0 hover:opacity-75 transition-opacity"
              style={{ color: '#009BFF' }}
            >
              See all {sec.signals.length} →
            </button>
          )}
        </div>

        {sec.signals.length === 0 ? (
          <EmptyCategory message={`No ${sec.label.toLowerCase()} signals qualify right now.`} />
        ) : (
          <div>
            {renderColumnHeaders()}
            {renderSignalRows(preview)}
            {remaining > 0 && (
              <button
                onClick={() => setActiveTab(sec.key as CategoryTab)}
                className="w-full text-center px-4 py-2.5 text-xs font-semibold hover:opacity-75 transition-opacity"
                style={{ color: '#009BFF', borderTop: '1px solid var(--border)' }}
              >
                See {remaining} more {sec.label.toLowerCase()} signal{remaining !== 1 ? 's' : ''} →
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  // ─── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── TAB BAR (signal type — the primary navigation axis) ── */}
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
            {tab.label}
          </button>
        ))}

        {/* History — demoted to a small link/toggle, not a peer signal-type tab */}
        <button
          onClick={() => setActiveTab('history')}
          className="flex items-center gap-1 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          style={{ color: activeTab === 'history' ? '#009BFF' : 'var(--text-w35)' }}
        >
          <History className="w-3.5 h-3.5" />
          History
        </button>

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
          {/* Free user — single combined upsell banner (was two stacked banners) */}
          {isFree && (() => {
            const stCount = activeSignals.filter(isShortTermSignal).length
            return (
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
                    {stCount > 0 && (
                      <>
                        {' '}Plus{' '}
                        <span className="font-bold" style={{ color: '#f97316' }}>
                          {stCount} Momentum signal{stCount !== 1 ? 's' : ''}
                        </span>
                        {' '}locked to Pro/Max.
                      </>
                    )}
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
            )
          })()}

          {/* Filter bar (pro/max only) */}
          {!isFree && (
            <div
              className="rounded-xl p-4 space-y-3"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              {/* Desktop — always-visible Type/Timeframe/Sort rows */}
              <div className="hidden sm:block space-y-3">
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
                      Advanced Filters
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
              </div>

              {/* Mobile — single "Filters" trigger, all controls collapse behind it instead of wrapping across lines */}
              <div className="sm:hidden">
                <button
                  onClick={() => setMobileFiltersOpen(v => !v)}
                  className="w-full flex items-center justify-between text-xs font-semibold rounded-lg px-3 py-2 transition-colors"
                  style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-w70)', border: '1px solid var(--border)' }}
                >
                  <span className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
                  </span>
                  <ChevronDown
                    className="w-3.5 h-3.5 transition-transform duration-200"
                    style={{ transform: mobileFiltersOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </button>

                {mobileFiltersOpen && (
                  <div className="mt-3 space-y-3">
                    <div
                      className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                      style={{ backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}
                    >
                      <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-w35)' }} />
                      <input
                        type="text"
                        placeholder="Search ticker…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="bg-transparent text-sm text-white placeholder:text-white/30 outline-none w-full"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-w40)' }}>Type</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <FilterChip label="All"   active={typeFilter === 'all'}   onClick={() => setTypeFilter('all')} />
                        <FilterChip label="BUY"   active={typeFilter === 'BUY'}   onClick={() => setTypeFilter('BUY')} />
                        <FilterChip label="WATCH" active={typeFilter === 'WATCH'} onClick={() => setTypeFilter('WATCH')} />
                        <FilterChip label="SHORT" active={typeFilter === 'SHORT'} onClick={() => setTypeFilter('SHORT')} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-w40)' }}>Timeframe</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <FilterChip label="All"       active={timeframeFilter === 'all'}      onClick={() => setTimeframeFilter('all')} />
                        <FilterChip label="Momentum"  active={timeframeFilter === 'momentum'} onClick={() => setTimeframeFilter('momentum')} />
                        <FilterChip label="Swing"     active={timeframeFilter === 'swing'}    onClick={() => setTimeframeFilter('swing')} />
                        <FilterChip label="Long Term" active={timeframeFilter === 'long'}     onClick={() => setTimeframeFilter('long')} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-w40)' }}>Sort</p>
                      <select
                        value={sortKey}
                        onChange={e => setSortKey(e.target.value as SortKey)}
                        className="w-full text-xs rounded-lg px-3 py-1.5 outline-none cursor-pointer"
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
                    <button
                      onClick={() => setFilterPanelOpen(v => !v)}
                      className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-75 transition-opacity"
                      style={{ color: '#009BFF' }}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      Advanced Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
                    </button>
                  </div>
                )}
              </div>

              {/* Advanced filters panel — Share Price / Avg Volume / Market Cap / Sector, collapsed by default on every breakpoint */}
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

          {/* Momentum tab only — session filter chips (All / Premarket / Regular Hours / After-Hours), classified honestly by each signal's own createdAt session. Never promoted to a top-level tab — that's exactly the axis collision the IA review flagged. */}
          {!isFree && activeTab === 'momentum' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--text-w40)' }}>Session:</span>
              {SESSION_CHIPS.map(c => (
                <FilterChip key={c.key} label={c.label} active={sessionFilter === c.key} onClick={() => setSessionFilter(c.key)} />
              ))}
            </div>
          )}

          {/* Signal content */}
          {activeTab === 'all' ? (
            <div className="space-y-4">
              {allSections.map(sec => renderOverviewSection(sec))}
            </div>
          ) : (
            /* Category tab — flat list, capped-free (this IS the "see all" destination) */
            <div
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              {categorySignals.length === 0 ? (
                activeTab === 'momentum' && sessionFilter !== 'all' ? (
                  <EmptyCategory message={`No ${SESSION_CHIPS.find(c => c.key === sessionFilter)?.label.toLowerCase()} momentum signals right now.`} />
                ) : (
                  <EmptyFilter />
                )
              ) : (
                <>
                  {renderColumnHeaders()}
                  {renderSignalRows(categorySignals)}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
