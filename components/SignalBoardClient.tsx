'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { ChevronDown, Search, TrendingUp, History, RefreshCw, Clock, Zap, Lock } from 'lucide-react'
import Link from 'next/link'
import SignalRow from './SignalRow'
import SignalHistoryTab from './SignalHistoryTab'
import OptionsDashboardClient from './OptionsDashboardClient'
import type { Signal } from './SignalCard'

// ─── OptionsSignal type ───────────────────────────────────────────────────────

type OptionsSignal = {
  id: string
  ticker: string
  companyName: string
  contractType: string
  strikePrice: number
  expirationDate: string
  premiumEstimate: number
  confidence: number
  reasoning: string
  summary: string
  riskLevel: string
  createdAt: string
}

// Placeholder options shown blurred for non-max users when no real data is available
const MOCK_OPTIONS: OptionsSignal[] = [
  { id: 'm1', ticker: 'NVDA', companyName: 'NVIDIA Corporation', contractType: 'CALL', strikePrice: 125, expirationDate: '2026-07-18', premiumEstimate: 4.20, confidence: 82.3, reasoning: '', summary: 'Strong AI momentum play with technical breakout above key resistance.', riskLevel: 'Medium', createdAt: new Date().toISOString() },
  { id: 'm2', ticker: 'TSLA', companyName: 'Tesla Inc', contractType: 'PUT', strikePrice: 240, expirationDate: '2026-07-11', premiumEstimate: 3.75, confidence: 71.5, reasoning: '', summary: 'Bearish technical setup with distribution pattern on the daily chart.', riskLevel: 'High', createdAt: new Date().toISOString() },
  { id: 'm3', ticker: 'META', companyName: 'Meta Platforms Inc', contractType: 'CALL', strikePrice: 580, expirationDate: '2026-07-25', premiumEstimate: 8.50, confidence: 78.1, reasoning: '', summary: 'Strong ad revenue growth catalyst ahead of earnings season.', riskLevel: 'Low', createdAt: new Date().toISOString() },
]

// ─── category helpers ─────────────────────────────────────────────────────────

const LARGE_CAP = new Set([
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AVGO', 'AMD', 'QCOM',
  'INTC', 'TXN', 'MU', 'AMAT', 'ADBE', 'CRM', 'ORCL', 'JPM', 'BAC', 'GS',
  'V', 'MA', 'C', 'WFC', 'MS', 'BLK', 'AXP', 'SCHW', 'JNJ', 'UNH',
  'LLY', 'PFE', 'ABT', 'TMO', 'ISRG', 'MDT', 'AMGN', 'GILD', 'XOM', 'CVX',
  'COP', 'EOG', 'SLB', 'WMT', 'COST', 'MCD', 'SBUX', 'TGT', 'KO', 'PEP',
  'NKE', 'CAT', 'HON', 'RTX', 'LMT', 'GE', 'NFLX', 'DIS', 'CMCSA', 'T', 'VZ',
  'PLTR', 'COIN', 'AXON', 'UBER', 'SOFI', 'AFRM', 'SNOW', 'CRWD', 'DDOG',
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
function isMomentum(s: Signal): boolean {
  return s.signalType === 'BUY' && s.confidence >= 75
}
function isIntraday(h: string): boolean {
  return /intraday|hour/i.test(h)
}
function is1to3Days(h: string): boolean {
  return /1[-–]3\s*day|1-3\s*day/i.test(h)
}
function isShortTermSignal(s: Signal): boolean {
  const h = String(s.timeHorizon)
  return isIntraday(h) || is1to3Days(h)
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
    sorted.filter(s => !isLargeCapTicker(s) && !isMomentum(s)),
    sorted.filter(s => isSwingTrade(String(s.timeHorizon))),
    sorted.filter(s => isLongTerm(String(s.timeHorizon))),
    sorted.filter(s => isMomentum(s)),
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

type CategoryTab = 'all' | 'large-cap' | 'small-cap' | 'swing-trade' | 'long-term' | 'momentum' | 'options' | 'history'
type TypeFilter = 'all' | 'BUY' | 'WATCH' | 'SHORT'
type TimeframeFilter = 'all' | 'intraday' | '1-3days' | 'swing' | 'long'
type SortKey = 'confidence-desc' | 'confidence-asc' | 'ticker-asc' | 'recent' | 'time-sensitivity'

const CATEGORY_TABS: { key: CategoryTab; label: string; maxOnly?: boolean }[] = [
  { key: 'all',        label: 'All Signals' },
  { key: 'large-cap',  label: 'Large Cap' },
  { key: 'small-cap',  label: 'Small Cap' },
  { key: 'swing-trade', label: 'Swing Trade' },
  { key: 'long-term',  label: 'Long Term' },
  { key: 'momentum',   label: 'Momentum' },
  { key: 'options',    label: 'Options', maxOnly: true },
  { key: 'history',    label: 'History' },
]

// Sections for "All Signals" tab — first-match-wins, time-priority order
const ALL_SECTIONS: { key: string; label: string; match: (s: Signal) => boolean }[] = [
  { key: 'intraday',    label: 'Intraday',    match: (s) => isIntraday(String(s.timeHorizon)) },
  { key: '1-3-days',   label: '1–3 Days',    match: (s) => is1to3Days(String(s.timeHorizon)) },
  { key: 'momentum',   label: 'Momentum',    match: isMomentum },
  { key: 'large-cap',  label: 'Large Cap',   match: isLargeCapTicker },
  { key: 'small-cap',  label: 'Small Cap',   match: (s) => !isLargeCapTicker(s) },
  { key: 'swing-trade', label: 'Swing Trade', match: (s) => isSwingTrade(String(s.timeHorizon)) },
  { key: 'long-term',  label: 'Long Term',   match: (s) => isLongTerm(String(s.timeHorizon)) },
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
  optionsSignals = [],
  isAdmin   = false,
  isYesterday = false,
  lastGenerated = null,
  initialTab = 'all',
}: {
  signals: Signal[]
  tier: 'free' | 'pro' | 'max'
  optionsSignals?: OptionsSignal[]
  isAdmin?:      boolean
  isYesterday?:  boolean
  lastGenerated?: string | null
  initialTab?:   CategoryTab
}) {
  const [activeTab, setActiveTab]             = useState<CategoryTab>(initialTab)
  const [refreshing, setRefreshing]           = useState(false)
  const [typeFilter, setTypeFilter]           = useState<TypeFilter>('all')
  const [timeframeFilter, setTimeframeFilter] = useState<TimeframeFilter>('all')
  const [sortKey, setSortKey]                 = useState<SortKey>('confidence-desc')
  const [search, setSearch]                   = useState('')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [trackedMap, setTrackedMap]           = useState<Map<string, string>>(new Map())
  const [marketOpen, setMarketOpen]           = useState(false)
  const [afterClose, setAfterClose]           = useState(false)

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
    return signals.filter(s => !isIntraday(String(s.timeHorizon)))
  }, [signals, afterClose])

  // Time-sensitivity score for sorting
  function timeSensitivityScore(s: Signal): number {
    const h = String(s.timeHorizon)
    if (isIntraday(h)) return 0
    if (is1to3Days(h)) return 1
    if (isMomentum(s)) return 2
    if (isSwingTrade(h)) return 3
    return 4
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
      if (timeframeFilter === 'intraday' && !isIntraday(String(s.timeHorizon))) return false
      if (timeframeFilter === '1-3days'  && !is1to3Days(String(s.timeHorizon))) return false
      if (timeframeFilter === 'swing'    && !isSwingTrade(String(s.timeHorizon))) return false
      if (timeframeFilter === 'long'     && !isLongTerm(String(s.timeHorizon))) return false
      return true
    })
  }, [activeSignals, typeFilter, search, timeframeFilter, isFree])

  const sorted = useMemo(() => {
    if (isFree) return filtered
    const arr = [...filtered]
    if (sortKey === 'time-sensitivity') {
      return arr.sort((a, b) => {
        const diff = timeSensitivityScore(a) - timeSensitivityScore(b)
        return diff !== 0 ? diff : b.confidence - a.confidence
      })
    }
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
    if (activeTab === 'all' || activeTab === 'options' || activeTab === 'history') return []
    const matchFns: Partial<Record<CategoryTab, (s: Signal) => boolean>> = {
      'large-cap':  isLargeCapTicker,
      'small-cap':  s => !isLargeCapTicker(s),
      'swing-trade': s => isSwingTrade(String(s.timeHorizon)),
      'long-term':  s => isLongTerm(String(s.timeHorizon)),
      'momentum':   isMomentum,
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

  const updatedLabel = lastGenerated
    ? new Date(lastGenerated).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York',
      }) + ' EST'
    : null

  // ─── renderers ──────────────────────────────────────────────────────────────

  function renderColumnHeaders() {
    return (
      <div
        className="hidden sm:flex items-center gap-3 px-4 py-2"
        style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surf-w2)' }}
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
    )
  }

  function renderSignalRows(sigs: Signal[], catKey: string) {
    const isMom = catKey === 'momentum'
    const momentumHidden = isMom && tier === 'pro' ? Math.max(0, sigs.length - PRO_MOMENTUM_LIMIT) : 0
    const shown = isMom && tier === 'pro' ? sigs.slice(0, PRO_MOMENTUM_LIMIT) : sigs

    return (
      <>
        {shown.map((s, idx) => {
          const h = String(s.timeHorizon)
          const badge: 'intraday' | '1-3days' | null =
            isIntraday(h) ? 'intraday' : is1to3Days(h) ? '1-3days' : null
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
      </>
    )
  }

  function renderSection(sec: { key: string; label: string; signals: Signal[] }) {
    const isCollapsed = collapsedSections.has(sec.key)
    const isIntradaySec = sec.key === 'intraday'
    const is1to3Sec = sec.key === '1-3-days'

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
            {isIntradaySec && <Clock className="w-4 h-4 shrink-0" style={{ color: '#f97316' }} />}
            <span className="font-bold text-white">{sec.label}</span>

            {isIntradaySec && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}
              >
                INTRADAY
              </span>
            )}
            {is1to3Sec && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}
              >
                1–3 DAYS
              </span>
            )}
            {isIntradaySec && marketOpen && (
              <span className="inline-flex items-center gap-1">
                <span className="relative flex w-2 h-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#4ade80' }} />
                  <span className="relative inline-flex rounded-full w-2 h-2" style={{ backgroundColor: '#22c55e' }} />
                </span>
                <span className="text-xs font-bold" style={{ color: '#4ade80' }}>LIVE</span>
              </span>
            )}
            {(isIntradaySec || is1to3Sec) && !marketOpen && (
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
          {isAdmin && activeTab !== 'history' && activeTab !== 'options' && (
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
          {updatedLabel && !isAdmin && activeTab !== 'history' && activeTab !== 'options' && (
            <span className="text-xs" style={{ color: 'var(--text-w35)' }}>
              {isYesterday ? 'Yesterday · ' : ''}{updatedLabel}
            </span>
          )}
        </div>
      </div>

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && <SignalHistoryTab tier={tier} />}

      {/* ── OPTIONS TAB ── */}
      {activeTab === 'options' && (
        tier === 'max' ? (
          <OptionsDashboardClient signals={optionsSignals} />
        ) : (
          <div className="relative">
            {/* Blurred preview */}
            <div className="pointer-events-none select-none" style={{ filter: 'blur(7px)', opacity: 0.55 }}>
              <OptionsDashboardClient
                signals={optionsSignals.length > 0 ? optionsSignals.slice(0, 3) : MOCK_OPTIONS}
              />
            </div>
            {/* Upgrade overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="rounded-2xl p-8 flex flex-col items-center gap-4 text-center mx-4"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid rgba(234,179,8,0.4)',
                  maxWidth: 380,
                }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(234,179,8,0.1))' }}
                >
                  <Zap className="w-7 h-7" style={{ color: '#eab308' }} />
                </div>
                <div>
                  <p className="font-bold text-white text-lg">Options Signals</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-w60)' }}>
                    Options signals are exclusive to Holoture Max — $25/month
                  </p>
                </div>
                <Link
                  href="/pricing"
                  className="px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white' }}
                >
                  Upgrade to Max
                </Link>
              </div>
            </div>
          </div>
        )
      )}

      {/* ── SIGNAL TABS (All + category tabs) ── */}
      {activeTab !== 'history' && activeTab !== 'options' && (
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
                <FilterChip label="All"      active={timeframeFilter === 'all'}     onClick={() => setTimeframeFilter('all')} />
                <FilterChip label="Intraday" active={timeframeFilter === 'intraday'} onClick={() => setTimeframeFilter('intraday')} />
                <FilterChip label="1-3 Days" active={timeframeFilter === '1-3days'} onClick={() => setTimeframeFilter('1-3days')} />
                <FilterChip label="Swing"    active={timeframeFilter === 'swing'}   onClick={() => setTimeframeFilter('swing')} />
                <FilterChip label="Long Term" active={timeframeFilter === 'long'}   onClick={() => setTimeframeFilter('long')} />
                <select
                  value={sortKey}
                  onChange={e => setSortKey(e.target.value as SortKey)}
                  className="ml-auto text-xs rounded-lg px-3 py-1.5 outline-none cursor-pointer"
                  style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-w80)', border: '1px solid var(--border)' }}
                >
                  <option value="confidence-desc">Confidence ↓</option>
                  <option value="confidence-asc">Confidence ↑</option>
                  <option value="ticker-asc">Ticker A–Z</option>
                  <option value="recent">Most Recent</option>
                  <option value="time-sensitivity">Time Sensitivity</option>
                </select>
              </div>
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
