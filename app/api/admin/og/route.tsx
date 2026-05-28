import { ImageResponse } from 'next/og'
import { type NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ── Constants ─────────────────────────────────────────────────────────────────

const SIZES = {
  instagram: { width: 1080, height: 1080 },
  tiktok:    { width: 1080, height: 1920 },
  twitter:   { width: 1200, height: 675  },
  linkedin:  { width: 1200, height: 627  },
} as const

type SizeName = keyof typeof SIZES

const BG      = '#353535'
const SURFACE = '#2d2d2d'
const ACCENT  = '#009BFF'
const TEXT    = '#ffffff'
const MUTED   = 'rgba(255,255,255,0.55)'
const BORDER  = 'rgba(255,255,255,0.08)'
const SIGNAL_COLORS = { BUY: '#4ade80', SHORT: '#f87171', WATCH: '#fbbf24' } as const

type OgSignal = {
  id: string
  ticker: string
  companyName: string
  signalType: string
  entryZoneLow: number
  entryZoneHigh: number
  targetPrice: number
  stopLoss: number
  confidence: number
  timeHorizon: string
  thesis: string
  aiSummary: string
  sector: string
}

function sc(n: number) {
  return SIGNAL_COLORS[n as unknown as keyof typeof SIGNAL_COLORS]
}
function sigColor(type: string) {
  return SIGNAL_COLORS[type as keyof typeof SIGNAL_COLORS] ?? '#9ca3af'
}
function usd(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
// Scale a base size (designed for 1080px width) to the target width
function ss(base: number, w: number) {
  return Math.round((base * w) / 1080)
}

// ── Templates ─────────────────────────────────────────────────────────────────

function Spotlight(signal: OgSignal, w: number, h: number) {
  const s = (n: number) => ss(n, w)
  const portrait = h > w
  const landscape = w > h * 1.2

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: BG,
        padding: s(56),
        fontFamily: 'sans-serif',
        position: 'relative',
      }}
    >
      {/* Accent bar top-left */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: s(6), height: '100%', backgroundColor: ACCENT }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: portrait ? s(64) : s(40) }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: ACCENT, fontSize: s(13), fontWeight: 700, letterSpacing: '0.15em' }}>HOLOTURE</span>
          <span style={{ color: MUTED, fontSize: s(11), letterSpacing: '0.08em' }}>DATA-POWERED SIGNALS</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: `${s(8)}px ${s(22)}px`,
          backgroundColor: `${sigColor(signal.signalType)}22`,
          border: `${s(2)}px solid ${sigColor(signal.signalType)}`,
          borderRadius: s(10),
        }}>
          <span style={{ color: sigColor(signal.signalType), fontSize: s(18), fontWeight: 900, letterSpacing: '0.1em' }}>{signal.signalType}</span>
        </div>
      </div>

      {/* Ticker */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: landscape ? 0 : 1, justifyContent: landscape ? 'flex-start' : 'center', alignItems: 'flex-start' }}>
        <span style={{ color: MUTED, fontSize: s(14), fontWeight: 600, letterSpacing: '0.12em', marginBottom: s(4) }}>{signal.sector.toUpperCase()}</span>
        <span style={{ color: TEXT, fontSize: portrait ? s(128) : s(104), fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>{signal.ticker}</span>
        <span style={{ color: MUTED, fontSize: s(22), marginTop: s(6), marginBottom: portrait ? s(48) : s(36) }}>{signal.companyName}</span>

        {/* Metrics */}
        {landscape ? (
          <div style={{ display: 'flex', gap: s(32), marginBottom: s(24) }}>
            {[
              { label: 'ENTRY ZONE', value: `${usd(signal.entryZoneLow)} – ${usd(signal.entryZoneHigh)}` },
              { label: 'TARGET', value: usd(signal.targetPrice) },
              { label: 'STOP LOSS', value: usd(signal.stopLoss) },
              { label: 'CONFIDENCE', value: `${signal.confidence}%`, color: sigColor(signal.signalType) },
              { label: 'HORIZON', value: signal.timeHorizon },
            ].map((m) => (
              <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: s(4) }}>
                <span style={{ color: MUTED, fontSize: s(11), letterSpacing: '0.1em' }}>{m.label}</span>
                <span style={{ color: m.color ?? TEXT, fontSize: s(20), fontWeight: 700 }}>{m.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: s(12), width: '100%', marginBottom: s(32) }}>
            <div style={{ display: 'flex', gap: s(12) }}>
              {[
                { label: 'ENTRY ZONE', value: `${usd(signal.entryZoneLow)} – ${usd(signal.entryZoneHigh)}` },
                { label: 'TARGET', value: usd(signal.targetPrice) },
              ].map((m) => (
                <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: SURFACE, borderRadius: s(14), padding: s(22), gap: s(6) }}>
                  <span style={{ color: MUTED, fontSize: s(12), letterSpacing: '0.1em' }}>{m.label}</span>
                  <span style={{ color: TEXT, fontSize: s(24), fontWeight: 700 }}>{m.value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: s(12) }}>
              {[
                { label: 'STOP LOSS', value: usd(signal.stopLoss), color: TEXT },
                { label: 'CONFIDENCE', value: `${signal.confidence}%`, color: sigColor(signal.signalType) },
              ].map((m) => (
                <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: SURFACE, borderRadius: s(14), padding: s(22), gap: s(6) }}>
                  <span style={{ color: MUTED, fontSize: s(12), letterSpacing: '0.1em' }}>{m.label}</span>
                  <span style={{ color: m.color, fontSize: s(24), fontWeight: 700 }}>{m.value}</span>
                </div>
              ))}
            </div>

            {/* Confidence bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: s(6) }}>
              <div style={{ display: 'flex', width: '100%', height: s(6), backgroundColor: BORDER, borderRadius: s(3), overflow: 'hidden' }}>
                <div style={{ width: `${signal.confidence}%`, height: '100%', backgroundColor: sigColor(signal.signalType), borderRadius: s(3) }} />
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: s(8), alignItems: 'center' }}>
          <span style={{ color: MUTED, fontSize: s(14) }}>Time Horizon:</span>
          <span style={{ color: TEXT, fontSize: s(14), fontWeight: 600 }}>{signal.timeHorizon}</span>
        </div>

        {portrait && (
          <div style={{
            marginTop: s(32),
            padding: s(28),
            backgroundColor: SURFACE,
            borderRadius: s(16),
            borderLeft: `${s(4)}px solid ${ACCENT}`,
          }}>
            <span style={{ color: TEXT, fontSize: s(19), lineHeight: 1.55, opacity: 0.85 }}>{signal.aiSummary}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: s(24), paddingTop: s(20), borderTop: `1px solid ${BORDER}` }}>
        <span style={{ color: ACCENT, fontSize: s(14), fontWeight: 700 }}>holoture.com</span>
        <span style={{ color: MUTED, fontSize: s(12) }}>Not financial advice</span>
      </div>
    </div>
  )
}

function Top5(signals: OgSignal[], w: number, h: number) {
  const s = (n: number) => ss(n, w)
  const top = signals.slice(0, 5)
  const portrait = h > w

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: BG, padding: s(56), fontFamily: 'sans-serif', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: s(6), height: '100%', backgroundColor: ACCENT }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: portrait ? s(56) : s(40) }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: s(4) }}>
          <span style={{ color: TEXT, fontSize: portrait ? s(52) : s(44), fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>TODAY'S TOP 5</span>
          <span style={{ color: MUTED, fontSize: s(16) }}>Ranked by confidence</span>
        </div>
        <span style={{ color: ACCENT, fontSize: s(13), fontWeight: 700, letterSpacing: '0.15em' }}>HOLOTURE</span>
      </div>

      {/* Signal rows */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: portrait ? s(20) : s(12) }}>
        {top.map((sig, i) => (
          <div
            key={sig.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: SURFACE,
              borderRadius: s(16),
              padding: portrait ? `${s(28)}px ${s(32)}px` : `${s(18)}px ${s(28)}px`,
              gap: s(20),
              border: i === 0 ? `1px solid ${ACCENT}44` : `1px solid ${BORDER}`,
            }}
          >
            {/* Rank */}
            <span style={{ color: i === 0 ? ACCENT : MUTED, fontSize: s(20), fontWeight: 900, width: s(32) }}>#{i + 1}</span>

            {/* Ticker + company */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: s(2) }}>
              <span style={{ color: TEXT, fontSize: portrait ? s(32) : s(26), fontWeight: 900 }}>{sig.ticker}</span>
              <span style={{ color: MUTED, fontSize: s(13) }}>{sig.sector}</span>
            </div>

            {/* Signal type badge */}
            <div style={{
              display: 'flex',
              padding: `${s(6)}px ${s(16)}px`,
              backgroundColor: `${sigColor(sig.signalType)}18`,
              borderRadius: s(8),
              border: `1px solid ${sigColor(sig.signalType)}50`,
            }}>
              <span style={{ color: sigColor(sig.signalType), fontSize: s(14), fontWeight: 800, letterSpacing: '0.08em' }}>{sig.signalType}</span>
            </div>

            {/* Target */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: s(2), minWidth: s(80) }}>
              <span style={{ color: '#4ade80', fontSize: s(18), fontWeight: 700 }}>{usd(sig.targetPrice)}</span>
              <span style={{ color: MUTED, fontSize: s(11) }}>target</span>
            </div>

            {/* Confidence */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: s(4), minWidth: s(60) }}>
              <span style={{ color: sigColor(sig.signalType), fontSize: s(22), fontWeight: 900 }}>{sig.confidence}%</span>
              <div style={{ display: 'flex', width: s(56), height: s(4), backgroundColor: BORDER, borderRadius: s(2), overflow: 'hidden' }}>
                <div style={{ width: `${sig.confidence}%`, height: '100%', backgroundColor: sigColor(sig.signalType) }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: s(24), paddingTop: s(20), borderTop: `1px solid ${BORDER}` }}>
        <span style={{ color: ACCENT, fontSize: s(14), fontWeight: 700 }}>holoture.com</span>
        <span style={{ color: MUTED, fontSize: s(12) }}>Not financial advice</span>
      </div>
    </div>
  )
}

function SectorSignal(signals: OgSignal[], w: number, h: number) {
  const s = (n: number) => ss(n, w)
  const portrait = h > w

  // Pick top signal per sector
  const bySector: Record<string, OgSignal> = {}
  for (const sig of signals) {
    if (!bySector[sig.sector]) bySector[sig.sector] = sig
  }
  const rows = Object.entries(bySector).slice(0, portrait ? 8 : 6)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: BG, padding: s(56), fontFamily: 'sans-serif', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: s(6), height: '100%', backgroundColor: ACCENT }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: portrait ? s(48) : s(36) }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: s(4) }}>
          <span style={{ color: TEXT, fontSize: portrait ? s(52) : s(44), fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>SECTOR SIGNALS</span>
          <span style={{ color: MUTED, fontSize: s(16) }}>Top pick per sector</span>
        </div>
        <span style={{ color: ACCENT, fontSize: s(13), fontWeight: 700, letterSpacing: '0.15em' }}>HOLOTURE</span>
      </div>

      {/* Sector rows */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: portrait ? s(16) : s(10) }}>
        {rows.map(([sector, sig]) => (
          <div
            key={sector}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: portrait ? `${s(22)}px ${s(28)}px` : `${s(14)}px ${s(24)}px`,
              backgroundColor: SURFACE,
              borderRadius: s(14),
              gap: s(16),
              borderLeft: `${s(3)}px solid ${sigColor(sig.signalType)}`,
            }}
          >
            {/* Sector */}
            <span style={{ color: MUTED, fontSize: s(14), fontWeight: 600, width: s(portrait ? 200 : 160), letterSpacing: '0.02em' }}>{sector}</span>

            {/* Divider */}
            <div style={{ width: s(1), height: s(28), backgroundColor: BORDER }} />

            {/* Ticker */}
            <span style={{ color: TEXT, fontSize: portrait ? s(28) : s(24), fontWeight: 900, width: s(80) }}>{sig.ticker}</span>

            {/* Signal badge */}
            <div style={{
              display: 'flex',
              padding: `${s(4)}px ${s(12)}px`,
              backgroundColor: `${sigColor(sig.signalType)}18`,
              borderRadius: s(6),
              border: `1px solid ${sigColor(sig.signalType)}50`,
            }}>
              <span style={{ color: sigColor(sig.signalType), fontSize: s(12), fontWeight: 800 }}>{sig.signalType}</span>
            </div>

            {/* Target */}
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: s(8) }}>
              <span style={{ color: MUTED, fontSize: s(13) }}>→</span>
              <span style={{ color: '#4ade80', fontSize: s(18), fontWeight: 700 }}>{usd(sig.targetPrice)}</span>
            </div>

            {/* Confidence */}
            <span style={{ color: sigColor(sig.signalType), fontSize: s(18), fontWeight: 900 }}>{sig.confidence}%</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: s(24), paddingTop: s(20), borderTop: `1px solid ${BORDER}` }}>
        <span style={{ color: ACCENT, fontSize: s(14), fontWeight: 700 }}>holoture.com</span>
        <span style={{ color: MUTED, fontSize: s(12) }}>Not financial advice</span>
      </div>
    </div>
  )
}

function LongTerm(signals: OgSignal[], w: number, h: number) {
  const s = (n: number) => ss(n, w)
  const portrait = h > w

  // Filter for longer horizons (contains "month" or "wk" with 3+ or "weeks" with 4+)
  const longTermKeywords = ['month', 'quarter', 'year']
  const longTermSignals = signals.filter((sig) =>
    longTermKeywords.some((kw) => sig.timeHorizon.toLowerCase().includes(kw))
  ).slice(0, portrait ? 6 : 5)

  const allSignals = longTermSignals.length >= 3 ? longTermSignals : signals.slice(0, portrait ? 6 : 5)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: BG, padding: s(56), fontFamily: 'sans-serif', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: s(6), height: '100%', backgroundColor: ACCENT }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: portrait ? s(48) : s(36) }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: s(4) }}>
          <span style={{ color: TEXT, fontSize: portrait ? s(52) : s(44), fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>LONG TERM PICKS</span>
          <span style={{ color: MUTED, fontSize: s(16) }}>Multi-month investment setups</span>
        </div>
        <span style={{ color: ACCENT, fontSize: s(13), fontWeight: 700, letterSpacing: '0.15em' }}>HOLOTURE</span>
      </div>

      {/* Column headers */}
      <div style={{ display: 'flex', padding: `0 ${s(24)}px`, marginBottom: s(10), gap: s(16) }}>
        <span style={{ color: MUTED, fontSize: s(11), letterSpacing: '0.1em', flex: 1 }}>TICKER</span>
        <span style={{ color: MUTED, fontSize: s(11), letterSpacing: '0.1em', width: s(100) }}>ENTRY</span>
        <span style={{ color: MUTED, fontSize: s(11), letterSpacing: '0.1em', width: s(30), textAlign: 'center' }}></span>
        <span style={{ color: MUTED, fontSize: s(11), letterSpacing: '0.1em', width: s(100) }}>TARGET</span>
        <span style={{ color: MUTED, fontSize: s(11), letterSpacing: '0.1em', width: s(120) }}>HORIZON</span>
        <span style={{ color: MUTED, fontSize: s(11), letterSpacing: '0.1em', width: s(56), textAlign: 'right' }}>CONF</span>
      </div>

      {/* Signal rows */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: portrait ? s(14) : s(8) }}>
        {allSignals.map((sig, i) => {
          const pct = ((sig.targetPrice - sig.entryZoneHigh) / sig.entryZoneHigh * 100).toFixed(0)
          const isUp = sig.targetPrice > sig.entryZoneHigh
          return (
            <div
              key={sig.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: i % 2 === 0 ? SURFACE : 'transparent',
                borderRadius: s(12),
                padding: portrait ? `${s(20)}px ${s(24)}px` : `${s(14)}px ${s(24)}px`,
                gap: s(16),
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: s(2) }}>
                <span style={{ color: TEXT, fontSize: portrait ? s(26) : s(22), fontWeight: 900 }}>{sig.ticker}</span>
                <span style={{ color: MUTED, fontSize: s(12) }}>{sig.sector}</span>
              </div>
              <span style={{ color: TEXT, fontSize: s(18), fontWeight: 600, width: s(100) }}>{usd(sig.entryZoneLow)}</span>
              <span style={{ color: ACCENT, fontSize: s(18), width: s(30), textAlign: 'center' }}>→</span>
              <div style={{ display: 'flex', flexDirection: 'column', width: s(100), gap: s(2) }}>
                <span style={{ color: '#4ade80', fontSize: s(18), fontWeight: 700 }}>{usd(sig.targetPrice)}</span>
                <span style={{ color: isUp ? '#4ade80' : '#f87171', fontSize: s(11) }}>{isUp ? '+' : ''}{pct}%</span>
              </div>
              <span style={{ color: MUTED, fontSize: s(13), width: s(120) }}>{sig.timeHorizon}</span>
              <span style={{ color: sigColor(sig.signalType), fontSize: s(18), fontWeight: 900, width: s(56), textAlign: 'right' }}>{sig.confidence}%</span>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: s(24), paddingTop: s(20), borderTop: `1px solid ${BORDER}` }}>
        <span style={{ color: ACCENT, fontSize: s(14), fontWeight: 700 }}>holoture.com</span>
        <span style={{ color: MUTED, fontSize: s(12) }}>Not financial advice</span>
      </div>
    </div>
  )
}

function WeeklyRecap(signals: OgSignal[], w: number, h: number) {
  const s = (n: number) => ss(n, w)
  const portrait = h > w

  const buys  = signals.filter((s) => s.signalType === 'BUY').length
  const watch = signals.filter((s) => s.signalType === 'WATCH').length
  const short = signals.filter((s) => s.signalType === 'SHORT').length
  const best  = signals[0]

  // Top sector
  const sectorCount: Record<string, number> = {}
  for (const sig of signals) sectorCount[sig.sector] = (sectorCount[sig.sector] ?? 0) + 1
  const topSector = Object.entries(sectorCount).sort(([, a], [, b]) => b - a)[0]

  const avgConf = Math.round(signals.reduce((a, s) => a + s.confidence, 0) / (signals.length || 1))

  const stats = [
    { label: 'TOTAL', value: String(signals.length), color: TEXT },
    { label: 'BUY', value: String(buys), color: '#4ade80' },
    { label: 'WATCH', value: String(watch), color: '#fbbf24' },
    { label: 'SHORT', value: String(short), color: '#f87171' },
  ]

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: BG, padding: s(56), fontFamily: 'sans-serif', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: s(6), height: '100%', backgroundColor: ACCENT }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: portrait ? s(56) : s(40) }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: s(4) }}>
          <span style={{ color: TEXT, fontSize: portrait ? s(52) : s(44), fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>SIGNAL RECAP</span>
          <span style={{ color: MUTED, fontSize: s(16) }}>This week's full board summary</span>
        </div>
        <span style={{ color: ACCENT, fontSize: s(13), fontWeight: 700, letterSpacing: '0.15em' }}>HOLOTURE</span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: s(16), marginBottom: portrait ? s(48) : s(32) }}>
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: SURFACE,
              borderRadius: s(18),
              padding: portrait ? `${s(32)}px ${s(16)}px` : `${s(24)}px ${s(16)}px`,
              gap: s(8),
              border: `1px solid ${BORDER}`,
            }}
          >
            <span style={{ color: stat.color, fontSize: portrait ? s(56) : s(44), fontWeight: 900, lineHeight: 1 }}>{stat.value}</span>
            <span style={{ color: MUTED, fontSize: s(12), letterSpacing: '0.1em' }}>{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Best pick */}
      {best && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: SURFACE,
          borderRadius: s(18),
          padding: portrait ? s(36) : s(28),
          marginBottom: portrait ? s(32) : s(20),
          border: `1px solid ${ACCENT}44`,
          gap: s(10),
        }}>
          <span style={{ color: ACCENT, fontSize: s(12), fontWeight: 700, letterSpacing: '0.12em' }}>HIGHEST CONFIDENCE PICK</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: s(20) }}>
            <span style={{ color: TEXT, fontSize: portrait ? s(44) : s(36), fontWeight: 900 }}>{best.ticker}</span>
            <div style={{
              display: 'flex',
              padding: `${s(6)}px ${s(16)}px`,
              backgroundColor: `${sigColor(best.signalType)}18`,
              borderRadius: s(8),
              border: `1px solid ${sigColor(best.signalType)}50`,
            }}>
              <span style={{ color: sigColor(best.signalType), fontSize: s(14), fontWeight: 800 }}>{best.signalType}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: s(8), flex: 1 }}>
              <span style={{ color: TEXT, fontSize: s(18) }}>{usd(best.entryZoneLow)}</span>
              <span style={{ color: ACCENT }}>→</span>
              <span style={{ color: '#4ade80', fontSize: s(20), fontWeight: 700 }}>{usd(best.targetPrice)}</span>
            </div>
            <span style={{ color: sigColor(best.signalType), fontSize: portrait ? s(40) : s(36), fontWeight: 900 }}>{best.confidence}%</span>
          </div>
          <span style={{ color: MUTED, fontSize: s(14) }}>{best.aiSummary?.slice(0, 120)}{(best.aiSummary?.length ?? 0) > 120 ? '…' : ''}</span>
        </div>
      )}

      {/* Sector + avg confidence */}
      <div style={{ display: 'flex', gap: s(16) }}>
        {topSector && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: SURFACE, borderRadius: s(14), padding: s(20), gap: s(6) }}>
            <span style={{ color: MUTED, fontSize: s(11), letterSpacing: '0.1em' }}>TOP SECTOR</span>
            <span style={{ color: TEXT, fontSize: portrait ? s(24) : s(20), fontWeight: 700 }}>{topSector[0]}</span>
            <span style={{ color: ACCENT, fontSize: s(14) }}>{topSector[1]} signal{topSector[1] > 1 ? 's' : ''}</span>
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: SURFACE, borderRadius: s(14), padding: s(20), gap: s(6) }}>
          <span style={{ color: MUTED, fontSize: s(11), letterSpacing: '0.1em' }}>AVG CONFIDENCE</span>
          <span style={{ color: TEXT, fontSize: portrait ? s(24) : s(20), fontWeight: 700 }}>{avgConf}%</span>
          <div style={{ display: 'flex', width: '100%', height: s(4), backgroundColor: BORDER, borderRadius: s(2) }}>
            <div style={{ width: `${avgConf}%`, height: '100%', backgroundColor: ACCENT, borderRadius: s(2) }} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: s(24), paddingTop: s(20), borderTop: `1px solid ${BORDER}` }}>
        <span style={{ color: ACCENT, fontSize: s(14), fontWeight: 700 }}>holoture.com</span>
        <span style={{ color: MUTED, fontSize: s(12) }}>Not financial advice</span>
      </div>
    </div>
  )
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const template = searchParams.get('template') ?? 'spotlight'
  const sizeName = (searchParams.get('size') ?? 'instagram') as SizeName
  const signalId = searchParams.get('signalId')

  const dim = SIZES[sizeName] ?? SIZES.instagram

  try {
    let element: React.ReactElement

    if (template === 'spotlight') {
      const sig = signalId
        ? await prisma.signal.findUnique({ where: { id: signalId } })
        : await prisma.signal.findFirst({ where: { isActive: true }, orderBy: { confidence: 'desc' } })
      if (!sig) return new Response('No signal found', { status: 404 })
      element = Spotlight(sig as OgSignal, dim.width, dim.height)
    } else if (template === 'top5') {
      const sigs = await prisma.signal.findMany({ where: { isActive: true }, orderBy: { confidence: 'desc' }, take: 5 })
      element = Top5(sigs as OgSignal[], dim.width, dim.height)
    } else if (template === 'sector') {
      const sigs = await prisma.signal.findMany({ where: { isActive: true }, orderBy: { confidence: 'desc' }, take: 50 })
      element = SectorSignal(sigs as OgSignal[], dim.width, dim.height)
    } else if (template === 'longterm') {
      const sigs = await prisma.signal.findMany({ where: { isActive: true }, orderBy: { confidence: 'desc' }, take: 30 })
      element = LongTerm(sigs as OgSignal[], dim.width, dim.height)
    } else {
      const sigs = await prisma.signal.findMany({ where: { isActive: true }, orderBy: { confidence: 'desc' }, take: 50 })
      element = WeeklyRecap(sigs as OgSignal[], dim.width, dim.height)
    }

    return new ImageResponse(element, {
      width: dim.width,
      height: dim.height,
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[og]', err)
    return new Response('Failed to generate image', { status: 500 })
  }
}
