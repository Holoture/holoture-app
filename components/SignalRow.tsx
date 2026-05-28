'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { ChevronDown, Lock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Signal } from './SignalCard'

const SignalChart = dynamic(() => import('./SignalChart'), { ssr: false })

interface StockDetails {
  companyName: string | null
  exchange: string | null
  industry: string | null
  marketCap: number | null
  currentPrice: number | null
  todayVolume: number | null
  peRatio: number | null
  week52High: number | null
  week52Low: number | null
  avgVolume: number | null
  beta: number | null
  dividendYield: number | null
}

function formatMarketCap(mc: number | null): string {
  if (mc == null) return 'N/A'
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(1)}T`
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(1)}M`
  return `$${mc.toFixed(0)}`
}

function formatVolume(v: number | null): string {
  if (v == null) return 'N/A'
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return String(Math.round(v))
}

function SignalBadge({ type }: { type: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    BUY: { bg: 'rgba(29,158,117,0.15)', color: '#1D9E75', border: 'rgba(29,158,117,0.45)' },
    WATCH: { bg: 'rgba(186,117,23,0.15)', color: '#BA7517', border: 'rgba(186,117,23,0.45)' },
    SHORT: { bg: 'rgba(226,75,74,0.15)', color: '#E24B4A', border: 'rgba(226,75,74,0.45)' },
    SELL: { bg: 'rgba(226,75,74,0.15)', color: '#E24B4A', border: 'rgba(226,75,74,0.45)' },
  }
  const s = styles[type] ?? styles.WATCH
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {type}
    </span>
  )
}

function Blurred({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="select-none pointer-events-none"
      style={{ filter: 'blur(5px)', color: 'rgba(255,255,255,0.5)' }}
      aria-hidden="true"
    >
      {children}
    </span>
  )
}

function StockDetailsGrid({ signal, details }: { signal: Signal; details: StockDetails | null }) {
  const rows = [
    { label: 'Company', value: details?.companyName ?? signal.companyName },
    { label: 'Exchange', value: details?.exchange ?? 'N/A' },
    { label: 'Market Cap', value: formatMarketCap(details?.marketCap ?? null) },
    { label: 'P/E Ratio', value: details?.peRatio != null ? details.peRatio.toFixed(1) : 'N/A' },
    { label: '52W High', value: details?.week52High != null ? formatCurrency(details.week52High) : 'N/A' },
    { label: '52W Low', value: details?.week52Low != null ? formatCurrency(details.week52Low) : 'N/A' },
    { label: 'Avg Volume', value: formatVolume(details?.avgVolume ?? null) },
    { label: "Today's Volume", value: formatVolume(details?.todayVolume ?? null) },
    { label: 'Sector', value: signal.sector },
    { label: 'Industry', value: details?.industry ?? 'N/A' },
    { label: 'Beta', value: details?.beta != null ? details.beta.toFixed(2) : 'N/A' },
    { label: 'Dividend Yield', value: details?.dividendYield != null ? `${details.dividendYield.toFixed(2)}%` : 'None' },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {rows.map(({ label, value }) => (
        <div
          key={label}
          className="rounded-lg p-3"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</div>
          <div className="text-sm font-semibold text-white truncate">{value}</div>
        </div>
      ))}
    </div>
  )
}

interface Props {
  signal: Signal
  tier: 'free' | 'pro' | 'max'
  isEven: boolean
}

export default function SignalRow({ signal, tier, isEven }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [details, setDetails] = useState<StockDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [thesisExpanded, setThesisExpanded] = useState(false)

  const isLocked = tier === 'free'
  const confidenceColor =
    signal.confidence >= 75 ? '#1D9E75' : signal.confidence >= 55 ? '#BA7517' : '#E24B4A'
  const rowBg = isEven ? 'rgba(255,255,255,0.018)' : 'transparent'

  async function handleToggle() {
    const opening = !expanded
    setExpanded(opening)
    if (opening && !details && !isLocked) {
      setDetailsLoading(true)
      try {
        const res = await fetch(`/api/signals/${signal.ticker}/details`)
        if (res.ok) setDetails(await res.json())
      } catch {
        // silent — details grid shows N/A fallbacks
      } finally {
        setDetailsLoading(false)
      }
    }
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* ── CLICKABLE ROW ── */}
      <button
        onClick={handleToggle}
        className="w-full text-left transition-colors"
        style={{ backgroundColor: rowBg }}
      >
        {/* Desktop layout */}
        <div className="hidden sm:flex items-center gap-3 px-4 py-3 hover:bg-white/[0.025]">
          {/* Ticker + sector */}
          <div style={{ width: 130, flexShrink: 0 }}>
            <div className="font-bold text-white leading-tight" style={{ fontSize: 18 }}>
              {signal.ticker}
            </div>
            <div className="truncate" style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              {signal.sector}
            </div>
          </div>

          {/* Badge */}
          <div style={{ width: 72, flexShrink: 0 }}>
            <SignalBadge type={signal.signalType} />
          </div>

          {/* Confidence */}
          <div style={{ width: 68, flexShrink: 0 }}>
            {isLocked ? (
              <Blurred>99%</Blurred>
            ) : (
              <span className="text-sm font-bold" style={{ color: confidenceColor }}>
                {signal.confidence}%
              </span>
            )}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>Confidence</div>
          </div>

          {/* Entry Zone */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {isLocked ? (
              <Blurred>$000.00 – $000.00</Blurred>
            ) : (
              <span className="text-sm text-white">
                {formatCurrency(signal.entryZoneLow)} – {formatCurrency(signal.entryZoneHigh)}
              </span>
            )}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>Entry Zone</div>
          </div>

          {/* Target */}
          <div style={{ width: 104, flexShrink: 0 }}>
            {isLocked ? (
              <Blurred>↑ $000.00</Blurred>
            ) : (
              <span className="text-sm font-semibold" style={{ color: '#1D9E75' }}>
                ↑ {formatCurrency(signal.targetPrice)}
              </span>
            )}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>Target</div>
          </div>

          {/* Stop Loss */}
          <div style={{ width: 104, flexShrink: 0 }}>
            {isLocked ? (
              <Blurred>↓ $000.00</Blurred>
            ) : (
              <span className="text-sm font-semibold" style={{ color: '#E24B4A' }}>
                ↓ {formatCurrency(signal.stopLoss)}
              </span>
            )}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>Stop Loss</div>
          </div>

          {/* Timeframe */}
          <div style={{ width: 90, flexShrink: 0 }}>
            <span className="text-sm text-white">{signal.timeHorizon}</span>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>Timeframe</div>
          </div>

          {/* Chevron */}
          <ChevronDown
            className="w-4 h-4 shrink-0 transition-transform duration-200"
            style={{
              color: 'rgba(255,255,255,0.35)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </div>

        {/* Mobile layout */}
        <div className="flex flex-col sm:hidden px-4 py-3 gap-2 hover:bg-white/[0.025]">
          {/* Line 1: ticker + sector chip + badge + chevron */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-white" style={{ fontSize: 18 }}>{signal.ticker}</span>
            <span className="text-xs truncate flex-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {signal.sector}
            </span>
            <SignalBadge type={signal.signalType} />
            <ChevronDown
              className="w-4 h-4 shrink-0 transition-transform duration-200"
              style={{
                color: 'rgba(255,255,255,0.35)',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </div>

          {/* Line 2: confidence + entry zone */}
          <div className="flex items-center gap-5">
            <div>
              {isLocked ? <Blurred>99%</Blurred> : (
                <span className="text-sm font-bold" style={{ color: confidenceColor }}>
                  {signal.confidence}%
                </span>
              )}
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Confidence</div>
            </div>
            <div>
              {isLocked ? <Blurred>$000 – $000</Blurred> : (
                <span className="text-sm text-white">
                  {formatCurrency(signal.entryZoneLow)} – {formatCurrency(signal.entryZoneHigh)}
                </span>
              )}
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Entry Zone</div>
            </div>
          </div>

          {/* Line 3: target + stop loss + timeframe */}
          <div className="flex items-center gap-5">
            <div>
              {isLocked ? <Blurred>↑ $000</Blurred> : (
                <span className="text-sm font-semibold" style={{ color: '#1D9E75' }}>
                  ↑ {formatCurrency(signal.targetPrice)}
                </span>
              )}
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Target</div>
            </div>
            <div>
              {isLocked ? <Blurred>↓ $000</Blurred> : (
                <span className="text-sm font-semibold" style={{ color: '#E24B4A' }}>
                  ↓ {formatCurrency(signal.stopLoss)}
                </span>
              )}
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Stop Loss</div>
            </div>
            <div>
              <span className="text-sm text-white">{signal.timeHorizon}</span>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Timeframe</div>
            </div>
          </div>
        </div>
      </button>

      {/* ── EXPANDED CONTENT ── */}
      {expanded && (
        <div
          className="px-4 sm:px-6 py-5 space-y-6"
          style={{ backgroundColor: 'var(--bg-surface-2)', borderTop: '1px solid var(--border)' }}
        >
          {isLocked ? (
            /* Locked state for free users */
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(0,155,255,0.15)', border: '1px solid rgba(0,155,255,0.3)' }}
              >
                <Lock className="w-6 h-6" style={{ color: '#009BFF' }} />
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Upgrade to Pro to see full details</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Get entry zones, targets, stop losses, confidence scores, live charts, and more.
                </p>
              </div>
              <a
                href="/pricing"
                className="px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#009BFF', color: 'white' }}
              >
                Upgrade to Pro
              </a>
            </div>
          ) : (
            <>
              {/* Section A — Summary */}
              <section>
                <h4 className="text-sm font-bold text-white mb-2">Summary</h4>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {signal.aiSummary}
                </p>
                <button
                  onClick={e => { e.stopPropagation(); setThesisExpanded(v => !v) }}
                  className="mt-2 text-sm font-medium hover:opacity-75 transition-opacity"
                  style={{ color: '#009BFF' }}
                >
                  {thesisExpanded ? 'Hide Full Thesis ↑' : 'View Full Thesis →'}
                </button>
                {thesisExpanded && (
                  <p
                    className="mt-3 text-sm leading-relaxed"
                    style={{
                      color: 'rgba(255,255,255,0.65)',
                      borderLeft: '2px solid rgba(0,155,255,0.3)',
                      paddingLeft: 12,
                    }}
                  >
                    {signal.thesis}
                  </p>
                )}
              </section>

              {/* Section B — Stock Details */}
              <section>
                <h4 className="text-sm font-bold text-white mb-3">Stock Details</h4>
                {detailsLoading ? (
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border-2 animate-spin"
                      style={{ borderColor: '#009BFF', borderTopColor: 'transparent' }}
                    />
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Loading from Finnhub…
                    </span>
                  </div>
                ) : (
                  <StockDetailsGrid signal={signal} details={details} />
                )}
              </section>

              {/* Section C — Price Chart */}
              <section>
                <h4 className="text-sm font-bold text-white mb-3">Price Chart — Last 6 Months</h4>
                <SignalChart
                  ticker={signal.ticker}
                  entryZoneLow={signal.entryZoneLow}
                  entryZoneHigh={signal.entryZoneHigh}
                  targetPrice={signal.targetPrice}
                  stopLoss={signal.stopLoss}
                />
                <div className="flex items-center gap-5 mt-2 flex-wrap" style={{ fontSize: 11 }}>
                  <span style={{ color: 'rgba(186,117,23,0.85)' }}>– – Entry Zone</span>
                  <span style={{ color: '#1D9E75' }}>– – Target</span>
                  <span style={{ color: '#E24B4A' }}>– – Stop Loss</span>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  )
}
