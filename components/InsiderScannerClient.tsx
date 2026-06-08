'use client'

import { useState, useMemo } from 'react'
import {
  TrendingUp, Search, Filter, ExternalLink,
  Users, Flame, Zap, ChevronDown, ChevronUp,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SerializedInsiderTrade {
  id: string
  companyName: string
  ticker: string
  insiderName: string
  insiderTitle: string
  tradeType: string
  shares: number
  pricePerShare: number
  totalValue: number
  filingDate: string
  tradeDate: string
  secLink: string
  aiSignificance: string
  aiCommentary: string
  createdAt: string
  hasActiveSignal?: boolean
}

interface Props {
  trades: SerializedInsiderTrade[]
  tier: 'free' | 'pro' | 'max'
  isPreview?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SIGNIFICANCE_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 }

type SignificanceFilter = 'all' | 'HIGH' | 'MEDIUM' | 'LOW'
type SortKey = 'date' | 'value' | 'significance'

const TITLE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  CEO:       { label: 'CEO',      color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  CFO:       { label: 'CFO',      color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  COO:       { label: 'COO',      color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  President: { label: 'PRES',     color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
  Director:  { label: 'DIR',      color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  Officer:   { label: 'OFFICER',  color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)' },
  Owner:     { label: 'OWNER',    color: '#c084fc', bg: 'rgba(192,132,252,0.12)' },
}

function getTitleBadge(title: string) {
  const t = title.toUpperCase()
  if (t.includes('CEO') || t.includes('CHIEF EXEC')) return TITLE_BADGE.CEO
  if (t.includes('CFO') || t.includes('CHIEF FIN')) return TITLE_BADGE.CFO
  if (t.includes('COO') || t.includes('CHIEF OPER')) return TITLE_BADGE.COO
  if (t.includes('PRESIDENT')) return TITLE_BADGE.President
  if (t.includes('DIRECTOR') || t.includes('DIR.')) return TITLE_BADGE.Director
  if (t.includes('10%') || t.includes('BENEFICIAL') || t.includes('OWNER')) return TITLE_BADGE.Owner
  return TITLE_BADGE.Officer
}

function formatValue(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`
  return `$${val.toFixed(0)}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

// ─── Cluster detection ────────────────────────────────────────────────────────

function detectClusters(trades: SerializedInsiderTrade[]): Set<string> {
  // Returns set of tickers where 2+ insiders bought within 7 days of each other
  const clusterTickers = new Set<string>()
  const byTicker: Record<string, SerializedInsiderTrade[]> = {}

  for (const t of trades) {
    if (!byTicker[t.ticker]) byTicker[t.ticker] = []
    byTicker[t.ticker].push(t)
  }

  for (const [ticker, tickerTrades] of Object.entries(byTicker)) {
    if (tickerTrades.length < 2) continue
    // Sort by trade date
    const sorted = [...tickerTrades].sort(
      (a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime()
    )
    for (let i = 0; i < sorted.length - 1; i++) {
      const diff =
        (new Date(sorted[i + 1].tradeDate).getTime() - new Date(sorted[i].tradeDate).getTime()) /
        (1000 * 60 * 60 * 24)
      if (diff <= 7) {
        clusterTickers.add(ticker)
        break
      }
    }
  }
  return clusterTickers
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SignificanceBadge({ value }: { value: string }) {
  const cfg = {
    HIGH:   { label: 'HIGH',   color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
    MEDIUM: { label: 'MEDIUM', color: '#facc15', bg: 'rgba(250,204,21,0.10)', border: 'rgba(250,204,21,0.25)' },
    LOW:    { label: 'LOW',    color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
  }[value] ?? { label: value, color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' }

  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ color: cfg.color, backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  )
}

function TradeRow({
  trade,
  isCluster,
  showSignalBadge,
  defaultExpanded = false,
}: {
  trade: SerializedInsiderTrade
  isCluster: boolean
  showSignalBadge: boolean
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const titleBadge = getTitleBadge(trade.insiderTitle)
  const age = daysAgo(trade.filingDate)

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: 'var(--card-bg)',
        border: isCluster
          ? '1px solid rgba(249,115,22,0.35)'
          : '1px solid var(--border-color)',
      }}
    >
      {/* Main row */}
      <button
        className="w-full text-left px-5 py-4 flex items-center gap-4"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Ticker + company */}
        <div className="flex-shrink-0 w-28">
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-white">{trade.ticker}</span>
            {isCluster && (
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                style={{ color: '#f97316', backgroundColor: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)' }}
              >
                <Flame className="w-3 h-3" />
                Cluster
              </span>
            )}
            {showSignalBadge && trade.hasActiveSignal && (
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                style={{ color: '#009BFF', backgroundColor: 'rgba(0,155,255,0.12)', border: '1px solid rgba(0,155,255,0.3)' }}
              >
                <Zap className="w-3 h-3" />
                Signal
              </span>
            )}
          </div>
          <div className="text-xs mt-0.5 truncate max-w-[7rem]" style={{ color: 'var(--text-muted)' }}>
            {trade.companyName}
          </div>
        </div>

        {/* Insider */}
        <div className="hidden sm:flex flex-col flex-1 min-w-0">
          <span className="text-sm font-semibold text-white truncate">{trade.insiderName}</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ color: titleBadge.color, backgroundColor: titleBadge.bg }}
            >
              {titleBadge.label}
            </span>
            <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {trade.insiderTitle}
            </span>
          </div>
        </div>

        {/* Value */}
        <div className="flex-shrink-0 text-right w-24">
          <div className="text-base font-black" style={{ color: '#4ade80' }}>
            {formatValue(trade.totalValue)}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {trade.shares.toLocaleString()} sh @ ${trade.pricePerShare.toFixed(2)}
          </div>
        </div>

        {/* Significance */}
        <div className="hidden md:flex flex-col items-end flex-shrink-0 w-24 gap-1">
          <SignificanceBadge value={trade.aiSignificance} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {age === 0 ? 'Today' : age === 1 ? '1d ago' : `${age}d ago`}
          </span>
        </div>

        {/* Chevron */}
        <div className="flex-shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="px-5 pb-5 pt-1 border-t"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Trade Date</div>
              <div className="text-sm font-semibold text-white">{formatDate(trade.tradeDate)}</div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Filing Date</div>
              <div className="text-sm font-semibold text-white">{formatDate(trade.filingDate)}</div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Form Type</div>
              <div className="text-sm font-semibold text-white">Form 4</div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Title</div>
              <div className="text-sm font-semibold text-white truncate">{trade.insiderTitle}</div>
            </div>
          </div>

          {trade.aiCommentary && (
            <div
              className="rounded-lg p-3 mb-4"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="text-xs font-bold mb-1" style={{ color: '#009BFF' }}>AI Analysis</div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {trade.aiCommentary}
              </p>
            </div>
          )}

          {trade.secLink && (
            <a
              href={trade.secLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
              style={{ color: '#009BFF' }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View SEC Filing
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InsiderScannerClient({ trades, tier, isPreview = false }: Props) {
  const [search, setSearch] = useState('')
  const [sigFilter, setSigFilter] = useState<SignificanceFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [showFilters, setShowFilters] = useState(false)

  const clusterTickers = useMemo(() => detectClusters(trades), [trades])
  const isMax = tier === 'max'

  const filtered = useMemo(() => {
    let result = [...trades]

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.ticker.toLowerCase().includes(q) ||
          t.companyName.toLowerCase().includes(q) ||
          t.insiderName.toLowerCase().includes(q)
      )
    }

    // Significance filter
    if (sigFilter !== 'all') {
      result = result.filter((t) => t.aiSignificance === sigFilter)
    }

    // Sort
    result.sort((a, b) => {
      if (sortKey === 'date') {
        return new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime()
      }
      if (sortKey === 'value') {
        return b.totalValue - a.totalValue
      }
      if (sortKey === 'significance') {
        const sa = SIGNIFICANCE_ORDER[a.aiSignificance as keyof typeof SIGNIFICANCE_ORDER] ?? 2
        const sb = SIGNIFICANCE_ORDER[b.aiSignificance as keyof typeof SIGNIFICANCE_ORDER] ?? 2
        return sa - sb
      }
      return 0
    })

    return result
  }, [trades, search, sigFilter, sortKey])

  // Summary stats
  const totalValue = trades.reduce((s, t) => s + t.totalValue, 0)
  const highCount = trades.filter((t) => t.aiSignificance === 'HIGH').length
  const clusterCount = clusterTickers.size

  if (isPreview) {
    // Minimal render for blurred preview
    return (
      <div className="space-y-3">
        {trades.map((t) => (
          <TradeRow
            key={t.id}
            trade={t}
            isCluster={clusterTickers.has(t.ticker)}
            showSignalBadge={false}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <TrendingUp className="w-7 h-7" style={{ color: '#009BFF' }} />
            <h1 className="text-3xl font-black text-white">Insider Buying Scanner</h1>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>
            Significant insider purchases filed with the SEC — updated twice daily.
          </p>
        </div>
        {isMax && (
          <div
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ backgroundColor: 'rgba(0,155,255,0.12)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.25)' }}
          >
            MAX — Signal correlation active
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Buys', value: trades.length.toString(), color: '#e2e8f0' },
          { label: 'High Significance', value: highCount.toString(), color: '#f97316' },
          { label: 'Cluster Buys', value: clusterCount.toString(), color: '#f97316' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl p-4 text-center"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
          >
            <div className="text-2xl font-black" style={{ color }}>{value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search ticker, company, or insider…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-500"
            style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((f) => !f)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          style={{
            backgroundColor: showFilters ? 'rgba(0,155,255,0.12)' : 'var(--card-bg)',
            border: showFilters ? '1px solid rgba(0,155,255,0.3)' : '1px solid var(--border-color)',
            color: showFilters ? '#009BFF' : 'var(--text-secondary)',
          }}
        >
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div
          className="rounded-xl p-4 mb-6 flex flex-wrap gap-4"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
        >
          {/* Significance */}
          <div>
            <div className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>SIGNIFICANCE</div>
            <div className="flex gap-2">
              {(['all', 'HIGH', 'MEDIUM', 'LOW'] as SignificanceFilter[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setSigFilter(v)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    backgroundColor: sigFilter === v ? 'rgba(0,155,255,0.15)' : 'rgba(255,255,255,0.05)',
                    color: sigFilter === v ? '#009BFF' : 'var(--text-muted)',
                    border: sigFilter === v ? '1px solid rgba(0,155,255,0.3)' : '1px solid transparent',
                  }}
                >
                  {v === 'all' ? 'All' : v}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <div className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>SORT BY</div>
            <div className="flex gap-2">
              {([
                { key: 'date', label: 'Newest' },
                { key: 'value', label: 'Largest' },
                { key: 'significance', label: 'Significance' },
              ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSortKey(key)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    backgroundColor: sortKey === key ? 'rgba(0,155,255,0.15)' : 'rgba(255,255,255,0.05)',
                    color: sortKey === key ? '#009BFF' : 'var(--text-muted)',
                    border: sortKey === key ? '1px solid rgba(0,155,255,0.3)' : '1px solid transparent',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cluster buy callout */}
      {clusterCount > 0 && (
        <div
          className="rounded-xl p-4 mb-6 flex items-center gap-3"
          style={{ backgroundColor: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)' }}
        >
          <Flame className="w-5 h-5 flex-shrink-0" style={{ color: '#f97316' }} />
          <div>
            <span className="text-sm font-bold" style={{ color: '#f97316' }}>
              {clusterCount} cluster {clusterCount === 1 ? 'buy' : 'buys'} detected —
            </span>
            <span className="text-sm ml-1" style={{ color: 'var(--text-secondary)' }}>
              multiple insiders bought the same stock within 7 days.
              {' '}
              {Array.from(clusterTickers).join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Max signal correlation banner */}
      {isMax && trades.some((t) => t.hasActiveSignal) && (
        <div
          className="rounded-xl p-4 mb-6 flex items-center gap-3"
          style={{ backgroundColor: 'rgba(0,155,255,0.08)', border: '1px solid rgba(0,155,255,0.25)' }}
        >
          <Zap className="w-5 h-5 flex-shrink-0" style={{ color: '#009BFF' }} />
          <div>
            <span className="text-sm font-bold" style={{ color: '#009BFF' }}>Signal correlation — </span>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Tickers marked with a{' '}
              <span className="font-bold" style={{ color: '#009BFF' }}>Signal</span>
              {' '}badge also have an active trade signal on your signal board.
            </span>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} {filtered.length === 1 ? 'trade' : 'trades'} — total value{' '}
          <span className="font-semibold text-white">{formatValue(totalValue)}</span>
        </span>
      </div>

      {/* Trade rows */}
      {filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          No trades match your filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((trade) => (
            <TradeRow
              key={trade.id}
              trade={trade}
              isCluster={clusterTickers.has(trade.ticker)}
              showSignalBadge={isMax}
            />
          ))}
        </div>
      )}
    </div>
  )
}
