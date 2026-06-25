'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus, Lock, Zap, ChevronRight } from 'lucide-react'
import type { PreviewData } from '@/lib/preview-data'

// ── Tabs ───────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'signals',    label: 'Signals' },
  { key: 'news',       label: 'News' },
  { key: 'trends',     label: 'Trends' },
  { key: 'calendar',   label: 'Calendar' },
  { key: 'politician', label: 'Politician Scanner' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 3600)  return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

function formatCalDate(d: string): string {
  const [, m, day] = d.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}`
}

// ── Shared badges ──────────────────────────────────────────────────────────────

function SignalBadge({ type }: { type: string }) {
  const t = type.toUpperCase()
  const [bg, color, Icon] =
    t === 'BUY'   ? ['rgba(74,222,128,0.15)',  '#4ade80', TrendingUp]   :
    t === 'WATCH' ? ['rgba(251,191,36,0.15)',  '#fbbf24', Minus]        :
                    ['rgba(248,113,113,0.15)', '#f87171', TrendingDown]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold shrink-0"
      style={{ backgroundColor: bg, color, border: `1px solid ${color}40` }}
    >
      <Icon className="w-2.5 h-2.5" />
      {t === 'SHORT' ? 'SHORT' : t}
    </span>
  )
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const s = sentiment.toLowerCase()
  const [bg, color, label] =
    s === 'bullish' ? ['rgba(74,222,128,0.15)',  '#4ade80', 'Bullish'] :
    s === 'bearish' ? ['rgba(248,113,113,0.15)', '#f87171', 'Bearish'] :
                      ['rgba(251,191,36,0.15)',  '#fbbf24', 'Neutral']
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold shrink-0"
      style={{ backgroundColor: bg, color, border: `1px solid ${color}40` }}
    >
      {label}
    </span>
  )
}

function ImpactBadge({ rating }: { rating: string }) {
  const r = rating.toLowerCase()
  const [bg, color] =
    r === 'high'   ? ['rgba(248,113,113,0.15)', '#f87171'] :
    r === 'medium' ? ['rgba(251,191,36,0.15)',  '#fbbf24'] :
                     ['var(--surf-w8)', 'var(--text-w40)']
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-bold shrink-0" style={{ backgroundColor: bg, color }}>
      {rating}
    </span>
  )
}

function PartyBadge({ party }: { party: string }) {
  const isDem = party === 'Democrat' || party === 'D'
  const isRep = party === 'Republican' || party === 'R'
  const [bg, color, label] =
    isDem ? ['rgba(96,165,250,0.15)',  '#60a5fa', 'DEM'] :
    isRep ? ['rgba(248,113,113,0.15)', '#f87171', 'REP'] :
            ['rgba(167,139,250,0.15)', '#a78bfa', 'IND']
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-bold shrink-0" style={{ backgroundColor: bg, color }}>
      {label}
    </span>
  )
}

function ConfBar({ value }: { value: number }) {
  const color = value >= 80 ? '#4ade80' : value >= 60 ? '#fbbf24' : '#f87171'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full" style={{ backgroundColor: 'var(--surf-w8)' }}>
        <div className="h-1.5 rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>{value}%</span>
    </div>
  )
}

function PreviewCTA({ href = '/sign-up', label = 'Sign up free to access this' }: { href?: string; label?: string }) {
  return (
    <div className="pt-5 text-center">
      <Link
        href={href}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
        style={{ backgroundColor: '#009BFF', color: 'white' }}
      >
        {label}
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  )
}

// ── Panel: Signals ─────────────────────────────────────────────────────────────

function SignalsPanel({ signals, totalSignals }: { signals: PreviewData['signals']; totalSignals: number }) {
  const largeCap = signals.filter((s) => s.signalCategory === 'large_cap').slice(0, 2)
  const smallCap = signals.filter((s) => s.signalCategory !== 'large_cap').slice(0, 1)
  const visible = [...largeCap, ...smallCap]
  const visibleIds = new Set(visible.map((s) => s.id))
  const blurred = signals.filter((s) => !visibleIds.has(s.id)).slice(0, 3)

  if (signals.length === 0) {
    return (
      <div className="py-12 text-center" style={{ color: 'var(--text-w40)' }}>
        <p className="text-sm">Signal data refreshes daily — check back soon.</p>
        <PreviewCTA />
      </div>
    )
  }

  function SignalRow({ s, blur = false }: { s: PreviewData['signals'][0]; blur?: boolean }) {
    return (
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
        style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          filter: blur ? 'blur(4px)' : 'none',
          userSelect: blur ? 'none' : 'auto',
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-white text-sm font-data">{s.ticker}</span>
            <SignalBadge type={s.signalType} />
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-w40)' }}>
            {s.companyName}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <ConfBar value={s.confidence} />
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-w35)' }}>{s.timeHorizon}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {largeCap.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-w28)' }}>
            Large Cap
          </p>
          <div className="space-y-1.5">
            {largeCap.map((s) => <SignalRow key={s.id} s={s} />)}
          </div>
        </div>
      )}

      {smallCap.length > 0 && (
        <div className="mb-1.5">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-w28)' }}>
            Small Cap
          </p>
          <div className="space-y-1.5">
            {smallCap.map((s) => <SignalRow key={s.id} s={s} />)}
          </div>
        </div>
      )}

      {/* Blurred rows + upgrade overlay */}
      {blurred.length > 0 && (
        <div className="relative mt-1.5">
          <div className="space-y-1.5 pointer-events-none">
            {blurred.map((s) => <SignalRow key={s.id} s={s} blur />)}
          </div>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-xl text-center px-4"
            style={{ background: 'linear-gradient(to bottom, rgba(15,15,15,0.2) 0%, rgba(15,15,15,0.98) 55%)' }}
          >
            <Lock className="w-4 h-4 mb-2" style={{ color: '#009BFF' }} />
            <p className="text-sm font-bold text-white">
              Upgrade to see all {totalSignals} signals today
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-w40)' }}>
              Pro members get the full board
            </p>
          </div>
        </div>
      )}

      <PreviewCTA />
    </div>
  )
}

// ── Panel: News ────────────────────────────────────────────────────────────────

function NewsPanel({ news }: { news: PreviewData['news'] }) {
  if (news.length === 0) {
    return (
      <div className="py-12 text-center" style={{ color: 'var(--text-w40)' }}>
        <p className="text-sm">News updates every 30 minutes — check back soon.</p>
        <PreviewCTA />
      </div>
    )
  }

  return (
    <div>
      <div className="space-y-2">
        {news.map((n) => (
          <div
            key={n.id}
            className="flex items-start gap-3 p-3 rounded-xl"
            style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }}
          >
            <SentimentBadge sentiment={n.sentiment} />
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-semibold text-white leading-snug"
                style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}
              >
                {n.headline}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-w35)' }}>
                {n.source} · {timeAgo(n.publishedAt)}
              </p>
            </div>
          </div>
        ))}
      </div>
      <PreviewCTA />
    </div>
  )
}

// ── Panel: Trends ──────────────────────────────────────────────────────────────

function TrendsPanel({ sectors, marketSummary }: { sectors: PreviewData['sectors']; marketSummary: string | null }) {
  const maxAbs = Math.max(...sectors.map((s) => Math.abs(s.change)), 0.01)

  if (sectors.length === 0) {
    return (
      <div className="py-12 text-center" style={{ color: 'var(--text-w40)' }}>
        <p className="text-sm">Sector data refreshes every 30 minutes.</p>
        <PreviewCTA />
      </div>
    )
  }

  return (
    <div>
      {marketSummary && (
        <div
          className="p-3 rounded-xl mb-5 text-xs leading-relaxed"
          style={{ backgroundColor: 'rgba(0,155,255,0.07)', border: '1px solid rgba(0,155,255,0.2)', color: 'var(--text-w70)' }}
        >
          <span className="font-bold" style={{ color: '#009BFF' }}>Market Summary ·</span>
          {marketSummary.length > 220 ? `${marketSummary.slice(0, 220)}…` : marketSummary}
        </div>
      )}

      <div className="space-y-3">
        {sectors.map((s) => {
          const positive = s.change >= 0
          const color = positive ? '#4ade80' : '#f87171'
          const pct = (Math.abs(s.change) / maxAbs) * 100
          return (
            <div key={s.id} className="flex items-center gap-3">
              <span
                className="text-xs font-semibold shrink-0 text-right"
                style={{ width: 110, color: 'var(--text-w55)' }}
              >
                {s.sector}
              </span>
              <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: 'var(--surf-w6)' }}>
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.85 }}
                />
              </div>
              <span className="text-xs font-bold shrink-0 tabular-nums w-14 text-right" style={{ color }}>
                {positive ? '+' : ''}{s.change.toFixed(2)}%
              </span>
            </div>
          )
        })}
      </div>

      <PreviewCTA />
    </div>
  )
}

// ── Panel: Calendar ────────────────────────────────────────────────────────────

function CalendarPanel({ calendar }: { calendar: PreviewData['calendar'] }) {
  if (calendar.length === 0) {
    return (
      <div className="py-12 text-center" style={{ color: 'var(--text-w40)' }}>
        <p className="text-sm">Earnings calendar updates daily.</p>
        <PreviewCTA />
      </div>
    )
  }

  function hourLabel(h: string) {
    if (h === 'amc') return 'After close'
    if (h === 'bmo') return 'Before open'
    return h || null
  }

  return (
    <div>
      <div className="space-y-2">
        {calendar.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-white text-sm font-data">{entry.symbol}</span>
                <ImpactBadge rating={entry.impactRating} />
              </div>
              {entry.epsEstimate != null && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-w40)' }}>
                  EPS est: ${entry.epsEstimate.toFixed(2)}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold text-white">{formatCalDate(entry.date)}</p>
              {hourLabel(entry.hour) && (
                <p className="text-xs" style={{ color: 'var(--text-w35)' }}>
                  {hourLabel(entry.hour)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      <PreviewCTA />
    </div>
  )
}

// ── Panel: Politician Scanner ──────────────────────────────────────────────────

function PoliticianPanel({ trades }: { trades: PreviewData['trades'] }) {
  if (trades.length === 0) {
    return (
      <div className="py-12 text-center" style={{ color: 'var(--text-w40)' }}>
        <p className="text-sm">Congressional trade disclosures update daily.</p>
        <PreviewCTA label="Upgrade to Max to access this" href="/pricing" />
      </div>
    )
  }

  const [visible] = [trades.slice(0, 1)]
  const locked = trades.slice(1)

  function TradeRow({ t, blur = false }: { t: PreviewData['trades'][0]; blur?: boolean }) {
    const isBuy = /purchase|buy/i.test(t.tradeType)
    return (
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
        style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          filter: blur ? 'blur(5px)' : 'none',
          userSelect: blur ? 'none' : 'auto',
        }}
      >
        <PartyBadge party={t.party} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{t.politicianName}</p>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-w40)' }}>
            {t.ticker} · {t.companyName}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: isBuy ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
              color: isBuy ? '#4ade80' : '#f87171',
            }}
          >
            {isBuy ? 'Purchase' : 'Sale'}
          </span>
          <p className="text-xs mt-1" style={{ color: 'var(--text-w40)' }}>{t.amountRange}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="space-y-2">
        {visible.map((t) => <TradeRow key={t.id} t={t} />)}

        {locked.length > 0 && (
          <div className="relative">
            <div className="space-y-2 pointer-events-none">
              {locked.slice(0, 3).map((t) => <TradeRow key={t.id} t={t} blur />)}
            </div>
            <div
              className="absolute inset-0 flex flex-col items-center justify-center rounded-xl text-center px-4"
              style={{ background: 'linear-gradient(to bottom, rgba(15,15,15,0.3) 0%, rgba(15,15,15,0.97) 45%)' }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mb-2 shrink-0"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
              >
                <Zap className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm font-black text-white">Max Exclusive</p>
              <p className="text-xs mt-1 mb-3" style={{ color: 'var(--text-w50)' }}>
                Real-time Congress trade disclosures with AI commentary &amp; significance ratings
              </p>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white' }}
              >
                <Zap className="w-3 h-3" />
                Upgrade to Max — $25/mo
              </Link>
            </div>
          </div>
        )}
      </div>

      <PreviewCTA label="Start free — Max plan from $25/mo" href="/pricing" />
    </div>
  )
}

// ── Root component ─────────────────────────────────────────────────────────────

export default function ProductPreview({ data }: { data: PreviewData }) {
  const [activeTab, setActiveTab] = useState('signals')

  return (
    <section className="py-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5"
            style={{ backgroundColor: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: '#4ade80', animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
            />
            Live data
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            See exactly what you&apos;re getting
          </h2>
          <p className="mt-4" style={{ color: 'var(--text-w55)' }}>
            Click through each feature to see a live preview
          </p>
        </div>

        {/* Tab bar — horizontally scrollable on mobile */}
        <div
          className="flex gap-2 mb-5 pb-1"
          style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap"
              style={{
                backgroundColor: activeTab === tab.key ? '#009BFF' : 'var(--bg-surface)',
                color: activeTab === tab.key ? 'white' : 'var(--text-w55)',
                border: activeTab === tab.key ? '1px solid #009BFF' : '1px solid var(--border)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div
          className="rounded-2xl p-5 sm:p-6"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            minHeight: 400,
          }}
        >
          {activeTab === 'signals' && (
            <SignalsPanel signals={data.signals} totalSignals={data.totalSignals} />
          )}
          {activeTab === 'news' && <NewsPanel news={data.news} />}
          {activeTab === 'trends' && (
            <TrendsPanel sectors={data.sectors} marketSummary={data.marketSummary} />
          )}
          {activeTab === 'calendar' && <CalendarPanel calendar={data.calendar} />}
          {activeTab === 'politician' && <PoliticianPanel trades={data.trades} />}
        </div>

      </div>
    </section>
  )
}
