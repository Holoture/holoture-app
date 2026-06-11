'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'

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
          <p className="font-semibold text-white truncate">{trade.ticker}</p>
          <p className="text-xs truncate" style={{ color: 'var(--text-w50)' }}>{trade.companyName || 'N/A'}</p>
        </div>
      </div>

      {/* Published */}
      <div>
        <p className="font-semibold text-white">{published.time}</p>
        <p className="text-xs" style={{ color: 'var(--text-w50)' }}>{published.label}</p>
      </div>

      {/* Traded */}
      <div>
        <p className="text-white">{traded}</p>
      </div>

      {/* Filed After */}
      <div>
        <p className="text-white">{filedAfter}</p>
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
        <p className="text-white whitespace-nowrap">{trade.amountRange}</p>
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

type FilterType = 'all' | 'buy' | 'sell'
type FilterParty = 'all' | 'Democrat' | 'Republican'

const PREVIEW_COUNT = 3

export default function PoliticianTradesClient({
  trades,
  isPreview = false,
}: {
  trades: Trade[]
  isPreview?: boolean
}) {
  const [typeFilter, setTypeFilter] = useState<FilterType>('all')
  const [partyFilter, setPartyFilter] = useState<FilterParty>('all')

  const filtered = trades.filter((t) => {
    if (typeFilter === 'buy' && !isBuy(t.tradeType)) return false
    if (typeFilter === 'sell' && isBuy(t.tradeType)) return false
    if (partyFilter !== 'all' && t.party !== partyFilter) return false
    return true
  })

  const displayed = isPreview ? filtered.slice(0, PREVIEW_COUNT) : filtered

  const btnBase = 'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all'
  const btnActive = { backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.4)' }
  const btnInactive = { backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }

  return (
    <div className="space-y-5">
      {/* Filters */}
      {!isPreview && (
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1.5">
            {(['all', 'buy', 'sell'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={btnBase}
                style={typeFilter === f ? btnActive : btnInactive}
              >
                {f === 'all' ? 'All Types' : f === 'buy' ? '🟢 Buy' : '🔴 Sell'}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {(['all', 'Democrat', 'Republican'] as FilterParty[]).map((p) => {
              const isActive = partyFilter === p
              const partyStyle = p === 'Democrat'
                ? { backgroundColor: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.4)' }
                : p === 'Republican'
                ? { backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)' }
                : btnActive
              return (
                <button
                  key={p}
                  onClick={() => setPartyFilter(p)}
                  className={btnBase}
                  style={isActive ? (p === 'all' ? btnActive : partyStyle) : btnInactive}
                >
                  {p === 'all' ? 'All Parties' : p}
                </button>
              )
            })}
          </div>
          <span className="ml-auto text-xs text-white opacity-50 self-center">
            {filtered.length} trade{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Trade table */}
      {displayed.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-white font-semibold">No trades match this filter</p>
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

            {displayed.map((t, i) => (
              <TradeRow key={t.id} trade={t} isLast={i === displayed.length - 1} />
            ))}
          </div>
        </div>
      )}

      {/* Pro upgrade gate */}
      {isPreview && (
        <div
          className="rounded-xl p-6 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(79,70,229,0.08))',
            border: '1px solid rgba(124,58,237,0.3)',
          }}
        >
          <p className="font-bold text-white mb-1">
            Showing 3 of {trades.length} trades
          </p>
          <p className="text-sm text-white mb-4" style={{ opacity: 0.7 }}>
            Upgrade to Max to unlock all congressional trades, filters, and significance ratings.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white' }}
          >
            Upgrade to Max — $25/month
          </Link>
        </div>
      )}
    </div>
  )
}
