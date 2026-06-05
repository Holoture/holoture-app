'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { ChevronDown, Lock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Signal } from './SignalCard'
import TrackerButton from './TrackerButton'

const SignalChart = dynamic(() => import('./SignalChart'), { ssr: false })

// ─── types ────────────────────────────────────────────────────────────────────

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

// ─── formatters ───────────────────────────────────────────────────────────────

function formatMarketCap(mc: number | null): string {
  if (mc == null) return 'N/A'
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(1)}T`
  if (mc >= 1e9)  return `$${(mc / 1e9).toFixed(1)}B`
  if (mc >= 1e6)  return `$${(mc / 1e6).toFixed(1)}M`
  return `$${mc.toFixed(0)}`
}

function formatVolume(v: number | null): string {
  if (v == null) return 'N/A'
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return String(Math.round(v))
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SignalBadge({ type }: { type: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    BUY:   { bg: 'rgba(29,158,117,0.15)',  color: '#1D9E75', border: 'rgba(29,158,117,0.45)' },
    WATCH: { bg: 'rgba(186,117,23,0.15)',  color: '#BA7517', border: 'rgba(186,117,23,0.45)' },
    SHORT: { bg: 'rgba(226,75,74,0.15)',   color: '#E24B4A', border: 'rgba(226,75,74,0.45)' },
    SELL:  { bg: 'rgba(226,75,74,0.15)',   color: '#E24B4A', border: 'rgba(226,75,74,0.45)' },
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

/** Gray placeholder badge shown for locked signals — no real type revealed */
function LockedBadge() {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap"
      style={{
        backgroundColor: 'var(--surf-w5)',
        color: 'var(--text-w18)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      — —
    </span>
  )
}

function Blurred({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="select-none pointer-events-none"
      style={{ filter: 'blur(5px)', color: 'var(--text-w50)' }}
      aria-hidden="true"
    >
      {children}
    </span>
  )
}

function StockDetailsGrid({ signal, details }: { signal: Signal; details: StockDetails | null }) {
  const rows = [
    { label: 'Company',        value: details?.companyName ?? signal.companyName },
    { label: 'Exchange',       value: details?.exchange ?? 'N/A' },
    { label: 'Market Cap',     value: formatMarketCap(details?.marketCap ?? null) },
    { label: 'P/E Ratio',      value: details?.peRatio != null ? details.peRatio.toFixed(1) : 'N/A' },
    { label: '52W High',       value: details?.week52High  != null ? formatCurrency(details.week52High)  : 'N/A' },
    { label: '52W Low',        value: details?.week52Low   != null ? formatCurrency(details.week52Low)   : 'N/A' },
    { label: 'Avg Volume',     value: formatVolume(details?.avgVolume   ?? null) },
    { label: "Today's Volume", value: formatVolume(details?.todayVolume ?? null) },
    { label: 'Sector',         value: signal.sector },
    { label: 'Industry',       value: details?.industry ?? 'N/A' },
    { label: 'Beta',           value: details?.beta != null ? details.beta.toFixed(2) : 'N/A' },
    { label: 'Dividend Yield', value: details?.dividendYield != null ? `${details.dividendYield.toFixed(2)}%` : 'None' },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {rows.map(({ label, value }) => (
        <div
          key={label}
          className="rounded-lg p-3"
          style={{ backgroundColor: 'var(--surf-w4)', border: '1px solid var(--border-faint)' }}
        >
          <div className="text-xs mb-1" style={{ color: 'var(--text-w40)' }}>{label}</div>
          <div className="text-sm font-semibold text-white truncate">{value}</div>
        </div>
      ))}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  signal: Signal
  tier: 'free' | 'pro' | 'max'
  isEven: boolean
  /** True for free users on any of their 5 fully-visible daily picks */
  isFreePick?: boolean
  /** TrackedSignal record ID if this signal is being tracked, else null */
  trackedId?: string | null
  onTrackToggle?: (signalId: string, newTrackedId: string | null) => void
}

export default function SignalRow({
  signal,
  tier,
  isEven,
  isFreePick = false,
  trackedId = null,
  onTrackToggle,
}: Props) {
  const [expanded, setExpanded]           = useState(false)
  const [details, setDetails]             = useState<StockDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [thesisExpanded, setThesisExpanded] = useState(false)

  // isObscured: free user + NOT one of the 5 daily free picks → hide ticker, blur everything
  const isObscured = tier === 'free' && !isFreePick

  const confidenceColor =
    signal.confidence >= 75 ? '#1D9E75' : signal.confidence >= 55 ? '#BA7517' : '#E24B4A'
  const rowBg = isEven ? 'var(--surf-w18)' : 'transparent'

  async function handleToggle() {
    const opening = !expanded
    setExpanded(opening)
    // Only fetch live data for rows the user can actually see
    if (opening && !details && !isObscured) {
      setDetailsLoading(true)
      try {
        const res = await fetch(`/api/signals/${signal.ticker}/details`)
        if (res.ok) setDetails(await res.json())
      } catch {
        // silent — StockDetailsGrid shows N/A fallbacks
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
        {/* ── Desktop layout ── */}
        <div className="hidden sm:flex items-center gap-3 px-4 py-3 hover:bg-white/[0.025]">

          {/* Ticker + sector */}
          <div style={{ width: 130, flexShrink: 0 }}>
            {isObscured ? (
              <>
                <div
                  className="font-bold leading-tight flex items-center gap-1"
                  style={{ fontSize: 16, color: 'var(--text-w25)' }}
                >
                  <Lock className="w-3 h-3 shrink-0" />
                  PRO
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-w20)', marginTop: 2 }}>
                  Upgrade to reveal
                </div>
              </>
            ) : (
              <>
                <div className="font-bold text-white leading-tight" style={{ fontSize: 18 }}>
                  {signal.ticker}
                </div>
                <div className="truncate" style={{ fontSize: 11, color: 'var(--text-w40)', marginTop: 2 }}>
                  {signal.sector}
                </div>
                {isFreePick && (
                  <div
                    className="inline-flex items-center gap-1 mt-1"
                    style={{ fontSize: 10, color: '#1D9E75', fontWeight: 700, letterSpacing: '0.02em' }}
                  >
                    ✦ Free Pick
                  </div>
                )}
              </>
            )}
          </div>

          {/* Signal badge */}
          <div style={{ width: 72, flexShrink: 0 }}>
            {isObscured ? <LockedBadge /> : <SignalBadge type={signal.signalType} />}
          </div>

          {/* Confidence */}
          <div style={{ width: 68, flexShrink: 0 }}>
            {isObscured ? (
              <Blurred>99%</Blurred>
            ) : (
              <span className="text-sm font-bold" style={{ color: confidenceColor }}>
                {signal.confidence}%
              </span>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-w30)', marginTop: 2 }}>Confidence</div>
          </div>

          {/* Entry Zone */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {isObscured ? (
              <Blurred>$000.00 – $000.00</Blurred>
            ) : (
              <span className="text-sm text-white">
                {formatCurrency(signal.entryZoneLow)} – {formatCurrency(signal.entryZoneHigh)}
              </span>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-w30)', marginTop: 2 }}>Entry Zone</div>
          </div>

          {/* Target */}
          <div style={{ width: 104, flexShrink: 0 }}>
            {isObscured ? (
              <Blurred>↑ $000.00</Blurred>
            ) : (
              <span className="text-sm font-semibold" style={{ color: '#1D9E75' }}>
                ↑ {formatCurrency(signal.targetPrice)}
              </span>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-w30)', marginTop: 2 }}>Target</div>
          </div>

          {/* Stop Loss */}
          <div style={{ width: 104, flexShrink: 0 }}>
            {isObscured ? (
              <Blurred>↓ $000.00</Blurred>
            ) : (
              <span className="text-sm font-semibold" style={{ color: '#E24B4A' }}>
                ↓ {formatCurrency(signal.stopLoss)}
              </span>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-w30)', marginTop: 2 }}>Stop Loss</div>
          </div>

          {/* Timeframe */}
          <div style={{ width: 90, flexShrink: 0 }}>
            {isObscured ? (
              <Blurred>00 days</Blurred>
            ) : (
              <span className="text-sm text-white">{signal.timeHorizon}</span>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-w30)', marginTop: 2 }}>Timeframe</div>
          </div>

          {/* Tracker */}
          {onTrackToggle && (
            <TrackerButton
              signalId={signal.id}
              ticker={signal.ticker}
              trackedId={trackedId}
              isObscured={isObscured}
              onToggle={onTrackToggle}
            />
          )}

          {/* Chevron */}
          <ChevronDown
            className="w-4 h-4 shrink-0 transition-transform duration-200"
            style={{
              color: 'var(--text-w35)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </div>

        {/* ── Mobile layout ── */}
        <div className="flex flex-col sm:hidden px-4 py-3 gap-2 hover:bg-white/[0.025]">
          {/* Line 1: ticker/lock + sector/hint + badge + chevron */}
          <div className="flex items-center gap-2">
            {isObscured ? (
              <>
                <span
                  className="font-bold flex items-center gap-1"
                  style={{ fontSize: 16, color: 'var(--text-w25)' }}
                >
                  <Lock className="w-3 h-3" />
                  PRO
                </span>
                <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-w20)' }}>
                  Upgrade to reveal
                </span>
                <LockedBadge />
              </>
            ) : (
              <>
                <span className="font-bold text-white" style={{ fontSize: 18 }}>{signal.ticker}</span>
                <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-w40)' }}>
                  {signal.sector}
                </span>
                <SignalBadge type={signal.signalType} />
              </>
            )}
            <ChevronDown
              className="w-4 h-4 shrink-0 transition-transform duration-200"
              style={{
                color: 'var(--text-w35)',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </div>

          {/* Free pick badge (mobile) */}
          {isFreePick && (
            <div style={{ fontSize: 10, color: '#1D9E75', fontWeight: 700 }}>
              ✦ Free Pick
            </div>
          )}

          {/* Tracker (mobile) */}
          {onTrackToggle && !isObscured && (
            <div className="flex justify-end">
              <TrackerButton
                signalId={signal.id}
                ticker={signal.ticker}
                trackedId={trackedId}
                isObscured={isObscured}
                onToggle={onTrackToggle}
              />
            </div>
          )}

          {/* Line 2: confidence + entry zone */}
          <div className="flex items-center gap-5">
            <div>
              {isObscured ? <Blurred>99%</Blurred> : (
                <span className="text-sm font-bold" style={{ color: confidenceColor }}>
                  {signal.confidence}%
                </span>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-w35)' }}>Confidence</div>
            </div>
            <div>
              {isObscured ? <Blurred>$000 – $000</Blurred> : (
                <span className="text-sm text-white">
                  {formatCurrency(signal.entryZoneLow)} – {formatCurrency(signal.entryZoneHigh)}
                </span>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-w35)' }}>Entry Zone</div>
            </div>
          </div>

          {/* Line 3: target + stop loss + timeframe */}
          <div className="flex items-center gap-5">
            <div>
              {isObscured ? <Blurred>↑ $000</Blurred> : (
                <span className="text-sm font-semibold" style={{ color: '#1D9E75' }}>
                  ↑ {formatCurrency(signal.targetPrice)}
                </span>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-w35)' }}>Target</div>
            </div>
            <div>
              {isObscured ? <Blurred>↓ $000</Blurred> : (
                <span className="text-sm font-semibold" style={{ color: '#E24B4A' }}>
                  ↓ {formatCurrency(signal.stopLoss)}
                </span>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-w35)' }}>Stop Loss</div>
            </div>
            <div>
              {isObscured ? <Blurred>0 days</Blurred> : (
                <span className="text-sm text-white">{signal.timeHorizon}</span>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-w35)' }}>Timeframe</div>
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
          {isObscured ? (
            /* ── Locked upgrade prompt ── */
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(0,155,255,0.15)', border: '1px solid rgba(0,155,255,0.3)' }}
              >
                <Lock className="w-6 h-6" style={{ color: '#009BFF' }} />
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Upgrade to Pro to unlock this signal</p>
                <p className="text-sm" style={{ color: 'var(--text-w50)' }}>
                  Get full access to the ticker, entry zone, target, stop loss, confidence score,
                  live charts, and AI thesis for every signal.
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
            /* ── Full signal detail (pro/max + free pick) ── */
            <>
              {/* Section A — Summary */}
              <section>
                {isFreePick && (
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mb-3"
                    style={{
                      backgroundColor: 'rgba(29,158,117,0.12)',
                      color: '#1D9E75',
                      border: '1px solid rgba(29,158,117,0.3)',
                    }}
                  >
                    ✦ Free Pick — 5 picks refresh daily
                  </div>
                )}
                <h4 className="text-sm font-bold text-white mb-2">Summary</h4>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-w75)' }}>
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
                      color: 'var(--text-w65)',
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
                    <span className="text-xs" style={{ color: 'var(--text-w40)' }}>
                      Loading from Finnhub…
                    </span>
                  </div>
                ) : (
                  <StockDetailsGrid signal={signal} details={details} />
                )}
              </section>

              {/* Section C — Price Chart */}
              <section>
                <h4 className="text-sm font-bold text-white mb-3">Price Chart</h4>
                <SignalChart
                  ticker={signal.ticker}
                  exchange={details?.exchange ?? null}
                />
                {/* Price-level reference (TradingView widget can't overlay custom lines) */}
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3" style={{ fontSize: 11 }}>
                  <span style={{ color: '#009BFF' }}>
                    Entry Zone: {formatCurrency(signal.entryZoneLow)} – {formatCurrency(signal.entryZoneHigh)}
                  </span>
                  <span style={{ color: '#1D9E75' }}>
                    Target: {formatCurrency(signal.targetPrice)}
                  </span>
                  <span style={{ color: '#E24B4A' }}>
                    Stop Loss: {formatCurrency(signal.stopLoss)}
                  </span>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  )
}
