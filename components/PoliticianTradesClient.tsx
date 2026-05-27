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

const PARTY_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  Democrat:    { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  Republican:  { bg: 'rgba(239,68,68,0.15)',   text: '#f87171', border: 'rgba(239,68,68,0.3)' },
  Independent: { bg: 'rgba(168,85,247,0.15)',  text: '#c084fc', border: 'rgba(168,85,247,0.3)' },
}

const SIG_COLOR: Record<string, string> = {
  High:   '#f87171',
  Medium: '#fbbf24',
  Low:    '#64748b',
}

function isBuy(tradeType: string) {
  return tradeType.toUpperCase() === 'BUY' || tradeType.toLowerCase().includes('purchase')
}

function TradeCard({ trade }: { trade: Trade }) {
  const party = PARTY_STYLE[trade.party] ?? { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8', border: 'rgba(148,163,184,0.3)' }
  const buy = isBuy(trade.tradeType)
  const sigColor = SIG_COLOR[trade.significance] ?? '#64748b'
  const tradeDate = new Date(trade.tradedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const filedDate = new Date(trade.filedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Left: politician + trade info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-bold text-white">{trade.politicianName}</span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: party.bg, color: party.text, border: `1px solid ${party.border}` }}
            >
              {trade.party}
            </span>
            <span className="text-xs text-white opacity-50">{trade.chamber}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xl font-black text-white tracking-tight">{trade.ticker}</span>
            {trade.companyName && (
              <span className="text-sm text-white opacity-70 truncate max-w-[200px]">{trade.companyName}</span>
            )}
            <span
              className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
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

          {trade.aiCommentary && (
            <p className="text-sm text-white leading-relaxed" style={{ opacity: 0.8 }}>{trade.aiCommentary}</p>
          )}
        </div>

        {/* Right: metadata */}
        <div className="flex sm:flex-col gap-4 sm:gap-2 shrink-0 sm:items-end">
          <div className="sm:text-right">
            <p className="text-xs text-white opacity-50">Amount</p>
            <p className="text-sm font-semibold text-white">{trade.amountRange}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs text-white opacity-50">Traded</p>
            <p className="text-sm text-white">{tradeDate}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs text-white opacity-50">Filed</p>
            <p className="text-sm text-white">{filedDate}</p>
          </div>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full self-start sm:self-auto"
            style={{ backgroundColor: `${sigColor}20`, color: sigColor, border: `1px solid ${sigColor}40` }}
          >
            {trade.significance}
          </span>
        </div>
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

      {/* Trade list */}
      {displayed.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-white font-semibold">No trades match this filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((t) => <TradeCard key={t.id} trade={t} />)}
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
