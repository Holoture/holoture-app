'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'

type Trade = {
  id: string
  politicianName: string
  party: string
  chamber: string
  ticker: string
  companyName: string
  tradeType: string
  amountRange: string
  tradedAt: string
  filedAt: string
  aiCommentary: string
  significance: string
}

const PARTY_STYLE: Record<string, { bg: string; text: string; border: string; avatar: string }> = {
  Democrat:    { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', border: 'rgba(59,130,246,0.3)', avatar: '#3b82f6' },
  Republican:  { bg: 'rgba(239,68,68,0.15)',   text: '#f87171', border: 'rgba(239,68,68,0.3)', avatar: '#ef4444' },
  Independent: { bg: 'rgba(168,85,247,0.15)',  text: '#c084fc', border: 'rgba(168,85,247,0.3)', avatar: '#a855f7' },
}

const SIG_COLOR: Record<string, string> = {
  High:   '#f87171',
  Medium: '#fbbf24',
  Low:    '#64748b',
}

function isBuy(tradeType: string) {
  return tradeType.toUpperCase() === 'BUY' || tradeType.toLowerCase().includes('purchase')
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

function formatRelativeDate(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000
  const dateDay = Math.floor(date.setHours(0, 0, 0, 0) / dayMs)
  const todayDay = Math.floor(new Date(now).setHours(0, 0, 0, 0) / dayMs)
  const diff = todayDay - dateDay

  const time = new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const dateLabel = new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  if (diff === 0) return { time, label: 'Today' }
  if (diff === 1) return { time, label: 'Yesterday' }
  return { time, label: dateLabel }
}

function daysBetween(a: string, b: string) {
  const ms = new Date(b).getTime() - new Date(a).getTime()
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)))
}

function TradeRow({ trade, isLast }: { trade: Trade; isLast: boolean }) {
  const party = PARTY_STYLE[trade.party] ?? { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8', border: 'rgba(148,163,184,0.3)', avatar: '#64748b' }
  const buy = isBuy(trade.tradeType)
  const sigColor = SIG_COLOR[trade.significance] ?? '#64748b'
  const published = formatRelativeDate(trade.filedAt)
  const traded = new Date(trade.tradedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const filedAfter = daysBetween(trade.tradedAt, trade.filedAt)

  return (
    <div
      className="grid grid-cols-[1.6fr_1.6fr_0.9fr_0.9fr_0.7fr_0.7fr_0.8fr_1fr] items-center gap-3 px-4 py-3 text-sm"
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}
    >
      {/* Politician */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ backgroundColor: `${party.avatar}30`, color: party.avatar }}
        >
          {initials(trade.politicianName)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-white truncate">{trade.politicianName}</p>
          <p className="text-xs truncate" style={{ color: party.text, opacity: 0.85 }}>
            {trade.party} | {trade.chamber}
          </p>
        </div>
      </div>

      {/* Traded Issuer */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-w60)', border: '1px solid var(--border)' }}
        >
          {trade.ticker.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-white truncate font-data">{trade.ticker}</p>
          <p className="text-xs truncate" style={{ color: 'var(--text-w50)' }}>{trade.companyName || 'N/A'}</p>
        </div>
      </div>

      {/* Published */}
      <div>
        <p className="font-semibold text-white font-data">{published.time}</p>
        <p className="text-xs" style={{ color: 'var(--text-w50)' }}>{published.label}</p>
      </div>

      {/* Traded */}
      <div>
        <p className="text-white font-data">{traded}</p>
      </div>

      {/* Filed After */}
      <div>
        <p className="text-white font-data">{filedAfter}</p>
        <p className="text-xs" style={{ color: 'var(--text-w50)' }}>days</p>
      </div>

      {/* Type */}
      <div>
        <span
          className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full"
          style={
            buy
              ? { backgroundColor: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }
              : { backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }
          }
        >
          {buy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {buy ? 'BUY' : 'SELL'}
        </span>
      </div>

      {/* Size */}
      <div>
        <p className="text-white whitespace-nowrap font-data">{trade.amountRange}</p>
      </div>

      {/* Significance */}
      <div>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${sigColor}20`, color: sigColor, border: `1px solid ${sigColor}40` }}
        >
          {trade.significance}
        </span>
      </div>
    </div>
  )
}

type Filters = { name: string; ticker: string; party: string; type: string }

const PARTY_OPTIONS = ['all', 'Democrat', 'Republican', 'Independent'] as const
const TYPE_OPTIONS = ['all', 'BUY', 'SELL'] as const

export default function PoliticianTradesClient({
  trades,
  total,
  page,
  totalPages,
  pageSize,
  filters,
}: {
  trades: Trade[]
  total: number
  page: number
  totalPages: number
  pageSize: number
  filters: Filters
}) {
  const router = useRouter()
  const pathname = usePathname()

  // Local state for the text inputs so typing feels instant; navigation is
  // debounced. Selects/pagination navigate immediately.
  const [nameInput, setNameInput] = useState(filters.name)
  const [tickerInput, setTickerInput] = useState(filters.ticker)

  // Keep inputs in sync when the URL changes underneath us (e.g. back button).
  // React's recommended "adjust state during render" pattern — cheaper and
  // safer than a sync effect (no cascading render).
  const [syncedFilters, setSyncedFilters] = useState({ name: filters.name, ticker: filters.ticker })
  if (syncedFilters.name !== filters.name || syncedFilters.ticker !== filters.ticker) {
    setSyncedFilters({ name: filters.name, ticker: filters.ticker })
    setNameInput(filters.name)
    setTickerInput(filters.ticker)
  }

  // Build a URL from a set of filter/page overrides. Any filter change resets
  // to page 1; only an explicit `page` override paginates.
  const buildUrl = useCallback(
    (overrides: Partial<Filters & { page: number }>) => {
      const next = {
        name: filters.name,
        ticker: filters.ticker,
        party: filters.party,
        type: filters.type,
        page: 1,
        ...overrides,
      }
      const params = new URLSearchParams()
      if (next.name) params.set('name', next.name)
      if (next.ticker) params.set('ticker', next.ticker)
      if (next.party && next.party !== 'all') params.set('party', next.party)
      if (next.type && next.type !== 'all' && next.type !== '') params.set('type', next.type)
      if (next.page > 1) params.set('page', String(next.page))
      const qs = params.toString()
      return qs ? `${pathname}?${qs}` : pathname
    },
    [filters, pathname]
  )

  const navigate = useCallback(
    (overrides: Partial<Filters & { page: number }>) => {
      router.push(buildUrl(overrides))
    },
    [router, buildUrl]
  )

  // Debounce text-search navigation (name + ticker).
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const nameChanged = nameInput.trim() !== filters.name
    const tickerChanged = tickerInput.trim().toUpperCase() !== filters.ticker
    if (!nameChanged && !tickerChanged) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      navigate({ name: nameInput.trim(), ticker: tickerInput.trim().toUpperCase(), page: 1 })
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameInput, tickerInput])

  const partyValue = PARTY_OPTIONS.includes(filters.party as typeof PARTY_OPTIONS[number]) ? filters.party : 'all'
  const typeValue = filters.type === 'BUY' || filters.type === 'SELL' ? filters.type : 'all'

  const btnBase = 'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all'
  const btnActive = { backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.4)' }
  const btnInactive = { backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }

  const inputStyle = {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    color: '#ffffff',
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)

  return (
    <div className="space-y-5">
      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {/* Name search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-w35)' }} />
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Search politician…"
              className="pl-9 pr-3 py-1.5 rounded-lg text-xs font-semibold w-52 outline-none focus:border-[#009BFF]"
              style={inputStyle}
            />
          </div>
          {/* Ticker search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-w35)' }} />
            <input
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value)}
              placeholder="Ticker…"
              className="pl-9 pr-3 py-1.5 rounded-lg text-xs font-semibold w-32 outline-none focus:border-[#009BFF] font-data uppercase"
              style={inputStyle}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Trade-type filter */}
          <div className="flex gap-1.5">
            {TYPE_OPTIONS.map((f) => (
              <button
                key={f}
                onClick={() => navigate({ type: f, page: 1 })}
                className={btnBase}
                style={typeValue === f ? btnActive : btnInactive}
              >
                {f === 'all' ? 'All Types' : f === 'BUY' ? '🟢 Buy' : '🔴 Sell'}
              </button>
            ))}
          </div>
          {/* Party filter */}
          <div className="flex gap-1.5">
            {PARTY_OPTIONS.map((p) => {
              const isActive = partyValue === p
              const partyStyle = p === 'Democrat'
                ? { backgroundColor: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.4)' }
                : p === 'Republican'
                ? { backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)' }
                : p === 'Independent'
                ? { backgroundColor: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.4)' }
                : btnActive
              return (
                <button
                  key={p}
                  onClick={() => navigate({ party: p, page: 1 })}
                  className={btnBase}
                  style={isActive ? (p === 'all' ? btnActive : partyStyle) : btnInactive}
                >
                  {p === 'all' ? 'All Parties' : p}
                </button>
              )
            })}
          </div>
          <span className="ml-auto text-xs text-white opacity-50 self-center">
            {total === 0 ? '0 trades' : `Showing ${rangeStart}–${rangeEnd} of ${total} trades`}
          </span>
        </div>
      </div>

      {/* ── Trade table ─────────────────────────────────────────────────── */}
      {trades.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-white font-semibold">No trades match these filters</p>
        </div>
      ) : (
        <div
          className="rounded-xl overflow-x-auto"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <div className="min-w-[860px]">
            {/* Column headers */}
            <div
              className="grid grid-cols-[1.6fr_1.6fr_0.9fr_0.9fr_0.7fr_0.7fr_0.8fr_1fr] gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
              style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-w35)', backgroundColor: 'var(--surf-w2)' }}
            >
              <div>Politician</div>
              <div>Traded Issuer</div>
              <div>Published</div>
              <div>Traded</div>
              <div>Filed After</div>
              <div>Type</div>
              <div>Size</div>
              <div>Significance</div>
            </div>

            {trades.map((t, i) => (
              <TradeRow key={t.id} trade={t} isLast={i === trades.length - 1} />
            ))}
          </div>
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onNavigate={(p) => navigate({ page: p })} />
      )}
    </div>
  )
}

// Compact page-number list with ellipses, e.g. 1 … 4 5 [6] 7 8 … 20
function pageList(page: number, totalPages: number): (number | '…')[] {
  const out: (number | '…')[] = []
  const push = (n: number | '…') => out.push(n)
  const window = 1
  const first = 1
  const last = totalPages
  push(first)
  const start = Math.max(2, page - window)
  const end = Math.min(last - 1, page + window)
  if (start > 2) push('…')
  for (let i = start; i <= end; i++) push(i)
  if (end < last - 1) push('…')
  if (last > 1) push(last)
  return out
}

function Pagination({
  page,
  totalPages,
  onNavigate,
}: {
  page: number
  totalPages: number
  onNavigate: (p: number) => void
}) {
  const arrow = 'inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed'
  const numBase = 'inline-flex items-center justify-center min-w-9 h-9 px-2 rounded-lg text-sm font-semibold transition-all'
  const active = { backgroundColor: '#009BFF', color: 'white', border: '1px solid #009BFF' }
  const inactive = { backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }

  return (
    <div className="flex items-center justify-center gap-1.5 pt-2">
      <button
        onClick={() => onNavigate(page - 1)}
        disabled={page <= 1}
        className={arrow}
        style={inactive}
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {pageList(page, totalPages).map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="px-1 text-sm" style={{ color: 'var(--text-w35)' }}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onNavigate(p)}
            className={numBase}
            style={p === page ? active : inactive}
            aria-current={p === page}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onNavigate(page + 1)}
        disabled={page >= totalPages}
        className={arrow}
        style={inactive}
        aria-label="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
