/**
 * PromoVideo — 40 s vertical iPhone promo (1080 × 1920, 30 fps)
 * Light mode · iPhone 15 Pro frame · TikTok / Reels / Shorts
 *
 * Frame timeline:
 *   0–89    Hook           3 s  — phone springs up, bold claim
 *   90–419  Signals        11 s — signals dashboard demo
 *   420–779 Options        12 s — options signals demo
 *   780–1109 Politicians   11 s — congress scanner demo
 *   1110–1199 CTA          3 s  — logo + URL end card
 */

import React from 'react'
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SignalRow {
  ticker: string
  companyName: string
  signalType: 'BUY' | 'WATCH' | 'SHORT'
  confidence: number
  entryZoneLow: number
  entryZoneHigh: number
  targetPrice: number
  stopLoss: number
}

export interface OptionsRow {
  ticker: string
  companyName: string
  contractType: 'CALL' | 'PUT'
  strikePrice: number
  expirationDate: string
  confidence: number
}

export interface PoliticianRow {
  politicianName: string
  party: string
  ticker: string
  companyName: string
  tradeType: string
  amountRange: string
}

export interface PromoVideoProps {
  signals: SignalRow[]
  options: OptionsRow[]
  politicians: PoliticianRow[]
}

// ── Light palette ──────────────────────────────────────────────────────────────

const L = {
  screen:    '#FFFFFF',
  text:      '#1A1A1A',
  textMuted: '#6B7280',
  textDim:   '#9CA3AF',
  accent:    '#009BFF',
  accentBg:  '#EBF6FF',
  buy:       '#1D9E75',
  buyBg:     '#EDFAF4',
  short:     '#E24B4A',
  shortBg:   '#FEF0F0',
  watch:     '#BA7517',
  watchBg:   '#FEF3E2',
  border:    '#E5E7EB',
  cardBg:    '#F9FAFB',
  chassis:   '#1C1C1E',
} as const

// ── Layout ─────────────────────────────────────────────────────────────────────

const PHONE_W = 600
const PHONE_H = 1250
const BEZEL   = 13
const RADIUS  = 56
const SCR_W   = PHONE_W - BEZEL * 2   // 574
const SCR_H   = PHONE_H - BEZEL * 2   // 1224
const DI_H    = 62                     // dynamic island zone height
const CONT_H  = SCR_H - DI_H          // 1162 — usable screen content

const VW      = 1080
const VH      = 1920
const PHONE_X = (VW - PHONE_W) / 2    // 240
const PHONE_Y = (VH - PHONE_H) / 2    // 335

// Frame boundaries
const T = {
  hookEnd:     90,
  signalsEnd:  420,
  optionsEnd:  780,
  politEnd:    1110,
  total:       1200,
  slide:       30,   // 1 s swipe transition
} as const

// ── Helpers ────────────────────────────────────────────────────────────────────

const EO = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ip  = (f: number, inp: number[], out: number[]) => interpolate(f, inp, out, EO)

const sigColor = (t: string) =>
  t === 'BUY' ? L.buy : t === 'SHORT' ? L.short : L.watch
const sigBg = (t: string) =>
  t === 'BUY' ? L.buyBg : t === 'SHORT' ? L.shortBg : L.watchBg
const partyColor = (p: string) => {
  const lower = p.toLowerCase()
  if (lower.startsWith('d') || lower.includes('dem')) return '#3B82F6'
  if (lower.startsWith('r') || lower.includes('rep')) return '#EF4444'
  return '#8B5CF6'
}
const fmt = (n: number) => `$${n.toFixed(2)}`

// ── iPhone Frame ───────────────────────────────────────────────────────────────

function IPhoneFrame({
  translateY,
  scale,
  opacity,
  children,
}: {
  translateY: number
  scale: number
  opacity: number
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left:   PHONE_X,
        top:    PHONE_Y,
        width:  PHONE_W,
        height: PHONE_H,
        transform: `translateY(${translateY}px) scale(${scale})`,
        transformOrigin: 'center center',
        opacity,
        borderRadius: RADIUS,
        backgroundColor: L.chassis,
        boxShadow: [
          '0 0 0 1.5px rgba(255,255,255,0.09) inset',
          '0 50px 140px rgba(0,80,200,0.20)',
          '0 20px 60px rgba(0,0,0,0.26)',
        ].join(', '),
        overflow: 'hidden',
      }}
    >
      {/* Screen glass */}
      <div
        style={{
          position: 'absolute',
          top: BEZEL, left: BEZEL,
          width: SCR_W, height: SCR_H,
          borderRadius: RADIUS - BEZEL,
          backgroundColor: L.screen,
          overflow: 'hidden',
        }}
      >
        {/* Dynamic island */}
        <div
          style={{
            position: 'absolute',
            top: 14, left: '50%',
            transform: 'translateX(-50%)',
            width: 128, height: 36,
            backgroundColor: L.chassis,
            borderRadius: 18,
            zIndex: 200,
          }}
        />

        {/* Status bar — time */}
        <div
          style={{
            position: 'absolute',
            top: 18, left: 28,
            fontSize: 17, fontWeight: 700,
            color: L.text,
            fontFamily: 'Arial, sans-serif',
            zIndex: 200,
          }}
        >
          9:41
        </div>

        {/* Screen content area */}
        <div
          style={{
            position: 'absolute',
            top: DI_H, left: 0,
            width: SCR_W, height: CONT_H,
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
      </div>

      {/* Hardware buttons */}
      <div style={{ position: 'absolute', left: -3, top: 200, width: 4, height: 70, backgroundColor: '#2A2A2C', borderRadius: '2px 0 0 2px' }} />
      <div style={{ position: 'absolute', left: -3, top: 290, width: 4, height: 70, backgroundColor: '#2A2A2C', borderRadius: '2px 0 0 2px' }} />
      <div style={{ position: 'absolute', right: -3, top: 260, width: 4, height: 115, backgroundColor: '#2A2A2C', borderRadius: '0 2px 2px 0' }} />
    </div>
  )
}

// ── Signals Screen ─────────────────────────────────────────────────────────────

function SignalsScreen({ relFrame, signals }: { relFrame: number; signals: SignalRow[] }) {
  const rf    = Math.max(0, relFrame)
  const rows  = signals.slice(0, 5)
  const showExpanded = rf > 155  // expand first row after ~5 s

  return (
    <div style={{ width: SCR_W, height: CONT_H, backgroundColor: L.screen, overflowY: 'hidden' }}>

      {/* Nav bar */}
      <div style={{
        height: 56,
        padding: '0 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${L.border}`,
        backgroundColor: L.screen,
      }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: L.text, fontFamily: 'Arial Black, Arial, sans-serif' }}>
          Signals
        </span>
        <span style={{
          fontSize: 13, fontWeight: 700, color: L.accent,
          backgroundColor: L.accentBg, padding: '5px 14px', borderRadius: 20,
          fontFamily: 'Arial, sans-serif',
        }}>
          Today
        </span>
      </div>

      {/* Signal rows */}
      {rows.map((sig, i) => {
        const rowRf  = rf - (12 + i * 8)
        const rowOp  = ip(rowRf, [0, 16], [0, 1])
        const rowY   = ip(rowRf, [0, 16], [18, 0])
        const isExp  = i === 0 && showExpanded
        // Confidence bar fills from 0 → real value over 50 frames starting at frame 40
        const conf   = ip(rf - 40 - i * 5, [0, 50], [0, sig.confidence])

        return (
          <div
            key={sig.ticker}
            style={{
              opacity: rowOp,
              transform: `translateY(${rowY}px)`,
              borderBottom: `1px solid ${L.border}`,
              backgroundColor: isExp ? `${sigColor(sig.signalType)}09` : 'transparent',
            }}
          >
            {/* Main row */}
            <div style={{ padding: '14px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Signal badge */}
              <div style={{
                width: 58, height: 58, borderRadius: 16, flexShrink: 0,
                backgroundColor: sigBg(sig.signalType),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{
                  fontSize: 12, fontWeight: 900, color: sigColor(sig.signalType),
                  fontFamily: 'Arial Black, Arial, sans-serif', letterSpacing: '-0.01em',
                }}>
                  {sig.signalType}
                </span>
              </div>

              {/* Ticker + name + confidence */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: L.text, fontFamily: 'Arial Black, Arial, sans-serif' }}>
                    {sig.ticker}
                  </span>
                  <span style={{
                    fontSize: 12, color: L.textDim, fontFamily: 'Arial, sans-serif',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200,
                  }}>
                    {sig.companyName}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, backgroundColor: L.border, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${conf}%`, backgroundColor: sigColor(sig.signalType), borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: sigColor(sig.signalType), fontFamily: 'Arial, sans-serif', minWidth: 34 }}>
                    {Math.round(conf)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Expanded detail for first row */}
            {isExp && (
              <div style={{
                padding: '0 20px 14px',
                opacity: ip(rf - 160, [0, 16], [0, 1]),
                transform: `translateY(${ip(rf - 160, [0, 16], [8, 0])}px)`,
              }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { label: 'Entry', value: `${fmt(sig.entryZoneLow)}–${fmt(sig.entryZoneHigh)}`, c: L.text },
                    { label: 'Target 🎯', value: fmt(sig.targetPrice), c: L.buy },
                    { label: 'Stop Loss', value: fmt(sig.stopLoss), c: L.short },
                  ].map(({ label, value, c }) => (
                    <div key={label} style={{
                      flex: 1, backgroundColor: L.cardBg, borderRadius: 12,
                      padding: '9px 10px', textAlign: 'center',
                      border: `1px solid ${L.border}`,
                    }}>
                      <div style={{ fontSize: 11, color: L.textDim, fontFamily: 'Arial, sans-serif', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: c, fontFamily: 'Arial, sans-serif', lineHeight: 1.2 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Options Screen ─────────────────────────────────────────────────────────────

function OptionsScreen({ relFrame, options }: { relFrame: number; options: OptionsRow[] }) {
  const rf    = Math.max(0, relFrame)
  const cards = options.slice(0, 3)

  return (
    <div style={{ width: SCR_W, height: CONT_H, backgroundColor: L.screen, overflowY: 'hidden' }}>

      {/* Nav bar */}
      <div style={{
        height: 56,
        padding: '0 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: `1px solid ${L.border}`,
      }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: L.text, fontFamily: 'Arial Black, Arial, sans-serif' }}>
          Options
        </span>
        {/* MAX badge — pops in at ~2.7 s into scene */}
        <div style={{
          opacity: ip(rf - 80, [0, 20], [0, 1]),
          transform: `scale(${ip(rf - 80, [0, 20], [0.4, 1])})`,
          backgroundColor: L.watch,
          padding: '4px 12px', borderRadius: 12,
        }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: '#FFFFFF', fontFamily: 'Arial Black, Arial, sans-serif', letterSpacing: '0.05em' }}>
            MAX
          </span>
        </div>
      </div>

      {/* Option cards */}
      <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {cards.map((opt, i) => {
          const cardRf  = rf - (15 + i * 15)
          const cardOp  = ip(cardRf, [0, 18], [0, 1])
          const cardY   = ip(cardRf, [0, 18], [26, 0])
          const isHL    = i === 0 && rf > 120
          const hlScale = isHL ? ip(rf - 125, [0, 15], [1, 1.025]) : 1
          const isBull  = opt.contractType === 'CALL'
          const color   = isBull ? L.buy : L.short
          const conf    = ip(rf - (20 + i * 18), [0, 55], [0, opt.confidence])

          return (
            <div
              key={`${opt.ticker}-${i}`}
              style={{
                opacity:   cardOp,
                transform: `translateY(${cardY}px) scale(${hlScale})`,
                transformOrigin: 'center center',
                backgroundColor: isHL ? (isBull ? L.buyBg : L.shortBg) : L.cardBg,
                borderRadius: 20,
                padding: '18px 18px',
                border: `1.5px solid ${isHL ? color : L.border}`,
                boxShadow: isHL ? `0 8px 32px ${color}28` : '0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              {/* Top row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 22, fontWeight: 900, color: L.text, fontFamily: 'Arial Black, Arial, sans-serif', marginRight: 8 }}>
                    {opt.ticker}
                  </span>
                  <span style={{ fontSize: 13, color: L.textMuted, fontFamily: 'Arial, sans-serif' }}>
                    {opt.companyName}
                  </span>
                </div>
                <div style={{ backgroundColor: color, padding: '5px 14px', borderRadius: 20 }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#FFF', fontFamily: 'Arial Black, Arial, sans-serif' }}>
                    {opt.contractType}
                  </span>
                </div>
              </div>

              {/* Strike + expiry */}
              <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: L.textDim, fontFamily: 'Arial, sans-serif', marginBottom: 2 }}>Strike</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: L.text, fontFamily: 'Arial, sans-serif' }}>
                    ${opt.strikePrice}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: L.textDim, fontFamily: 'Arial, sans-serif', marginBottom: 2 }}>Expires</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: L.text, fontFamily: 'Arial, sans-serif' }}>
                    {opt.expirationDate}
                  </div>
                </div>
              </div>

              {/* Confidence bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 7, backgroundColor: L.border, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${conf}%`, backgroundColor: color, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'Arial, sans-serif', minWidth: 36 }}>
                  {Math.round(conf)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Politician Screen ──────────────────────────────────────────────────────────

function PoliticianScreen({ relFrame, politicians }: { relFrame: number; politicians: PoliticianRow[] }) {
  const rf   = Math.max(0, relFrame)
  const rows = politicians.slice(0, 3)

  return (
    <div style={{ width: SCR_W, height: CONT_H, backgroundColor: L.screen, overflowY: 'hidden' }}>

      {/* Nav bar */}
      <div style={{
        height: 56,
        padding: '0 20px',
        display: 'flex', alignItems: 'center',
        borderBottom: `1px solid ${L.border}`,
      }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: L.text, fontFamily: 'Arial Black, Arial, sans-serif' }}>
          Congress Trades
        </span>
      </div>

      {/* Trade rows */}
      {rows.map((pol, i) => {
        const rowRf  = rf - (10 + i * 12)
        const rowOp  = ip(rowRf, [0, 18], [0, 1])
        const rowX   = ip(rowRf, [0, 18], [28, 0])
        const isHL   = i === 1 && rf > 150   // highlight center row
        const hlOp   = isHL ? ip(rf - 155, [0, 20], [0, 1]) : 0
        const pc     = partyColor(pol.party)
        const isRep  = pol.party.toLowerCase().startsWith('r') || pol.party.toLowerCase().includes('rep')
        const isBuy  = pol.tradeType.toLowerCase().includes('purchase') || pol.tradeType.toLowerCase().includes('buy')

        return (
          <div
            key={`${pol.politicianName}-${i}`}
            style={{
              opacity:   rowOp,
              transform: `translateX(${rowX}px)`,
              padding:   '16px 20px',
              borderBottom: `1px solid ${L.border}`,
              backgroundColor: isHL ? `${pc}0E` : 'transparent',
              boxShadow: hlOp > 0 ? `inset 3px 0 0 ${pc}` : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Party circle */}
              <div style={{
                width: 46, height: 46, borderRadius: 23, flexShrink: 0,
                backgroundColor: `${pc}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: isHL && hlOp > 0 ? `2px solid ${pc}` : '2px solid transparent',
              }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: pc, fontFamily: 'Arial Black, Arial, sans-serif' }}>
                  {isRep ? 'R' : 'D'}
                </span>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 16, fontWeight: 700, color: L.text,
                  fontFamily: 'Arial, sans-serif', marginBottom: 3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {pol.politicianName}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: L.accent, fontFamily: 'Arial Black, Arial, sans-serif' }}>
                    {pol.ticker}
                  </span>
                  <span style={{
                    fontSize: 13, fontWeight: 600,
                    color: isBuy ? L.buy : L.short,
                    fontFamily: 'Arial, sans-serif',
                  }}>
                    {isBuy ? '▲ Purchase' : '▼ Sale'}
                  </span>
                  <span style={{
                    fontSize: 12, color: L.textDim, fontFamily: 'Arial, sans-serif',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130,
                  }}>
                    {pol.amountRange}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Phone screen slider (3 screens side by side) ───────────────────────────────

function PhoneScreens({ props }: { props: PromoVideoProps }) {
  const frame = useCurrentFrame()

  // Slide left when crossing into each new section
  const slideX = interpolate(
    frame,
    [
      T.signalsEnd, T.signalsEnd + T.slide,
      T.optionsEnd, T.optionsEnd + T.slide,
    ],
    [0, -SCR_W, -SCR_W, -SCR_W * 2],
    EO,
  )

  return (
    <div style={{
      display: 'flex',
      width:  SCR_W * 3,
      height: CONT_H,
      transform: `translateX(${slideX}px)`,
    }}>
      {/* Screen 1 — Signals */}
      <div style={{ width: SCR_W, height: CONT_H, flexShrink: 0 }}>
        <SignalsScreen relFrame={frame - T.hookEnd} signals={props.signals} />
      </div>

      {/* Screen 2 — Options */}
      <div style={{ width: SCR_W, height: CONT_H, flexShrink: 0 }}>
        <OptionsScreen relFrame={frame - (T.signalsEnd + T.slide)} options={props.options} />
      </div>

      {/* Screen 3 — Politicians */}
      <div style={{ width: SCR_W, height: CONT_H, flexShrink: 0 }}>
        <PoliticianScreen relFrame={frame - (T.optionsEnd + T.slide)} politicians={props.politicians} />
      </div>
    </div>
  )
}

// ── Caption bar ────────────────────────────────────────────────────────────────

function CaptionBar({ text, startF, endF }: { text: string; startF: number; endF: number }) {
  const frame = useCurrentFrame()
  const op    = ip(frame, [startF, startF + 20, endF - 20, endF], [0, 1, 1, 0])

  if (op <= 0) return null

  return (
    <div style={{
      position: 'absolute',
      bottom: 52, left: 0, right: 0,
      padding: '0 80px',
      opacity: op,
      textAlign: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        display: 'inline-block',
        backgroundColor: 'rgba(10,10,10,0.74)',
        padding: '14px 30px', borderRadius: 32,
        maxWidth: 860,
      }}>
        <span style={{
          fontSize: 30, fontWeight: 600, color: '#FFFFFF',
          fontFamily: 'Arial, sans-serif', lineHeight: 1.35,
        }}>
          {text}
        </span>
      </div>
    </div>
  )
}

// ── Corner logo (outside phone) ────────────────────────────────────────────────

function CornerLogo({ opacity }: { opacity: number }) {
  return (
    <div style={{
      position: 'absolute', top: 60, left: 64,
      display: 'flex', alignItems: 'center', gap: 12,
      opacity,
    }}>
      <div style={{
        width: 50, height: 50, borderRadius: 14,
        backgroundColor: L.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 4px 16px ${L.accent}44`,
      }}>
        <span style={{ color: '#fff', fontSize: 26, fontWeight: 900, fontFamily: 'Arial, sans-serif' }}>H</span>
      </div>
      <span style={{
        fontSize: 26, fontWeight: 800, color: L.text,
        fontFamily: 'Arial Black, Arial, sans-serif', letterSpacing: '-0.02em',
      }}>
        Holo<span style={{ color: L.accent }}>ture</span>
      </span>
    </div>
  )
}

// ── Root composition ───────────────────────────────────────────────────────────

export const PromoVideo: React.FC<PromoVideoProps> = (props) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // ── Phone entrance: spring from bottom ──────────────────────────────────────
  const entranceSpring = spring({ fps, frame, config: { damping: 18, stiffness: 75, mass: 1.3 } })
  const entranceY = ip(entranceSpring, [0, 1], [780, 0])

  // ── Gentle float throughout ──────────────────────────────────────────────────
  const floatY = Math.sin(frame * 0.025) * 9

  // ── CTA phase: phone fades out ──────────────────────────────────────────────
  const phoneOpacity = ip(frame, [T.politEnd + 20, T.politEnd + 55], [1, 0])

  // Combined phone translateY (entrance + float)
  const phoneY = entranceY + floatY

  // ── Hook text (0–89) ────────────────────────────────────────────────────────
  const hookOp = ip(frame, [8, 22, 72, 88], [0, 1, 1, 0])
  const hookY  = ip(frame, [8, 22], [28, 0])

  // ── CTA elements ────────────────────────────────────────────────────────────
  const ctaLogoSp = spring({ fps, frame: Math.max(0, frame - (T.politEnd + 25)), config: { damping: 12, stiffness: 95 } })
  const ctaTextOp = ip(frame, [T.politEnd + 45, T.politEnd + 68], [0, 1])

  // ── Corner logo fades in during hook, stays visible ─────────────────────────
  const logoOp = ip(frame, [5, 30, T.politEnd + 15, T.politEnd + 50], [0, 1, 1, 0])

  return (
    <AbsoluteFill
      style={{ background: 'linear-gradient(155deg, #E6EEFF 0%, #F2F6FF 45%, #EBF0FF 100%)' }}
    >
      {/* Soft radial glow behind phone */}
      <div style={{
        position: 'absolute',
        left: '50%', top: '46%',
        transform: 'translate(-50%, -50%)',
        width: 900, height: 1500,
        background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,155,255,0.13) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Corner logo */}
      <CornerLogo opacity={logoOp} />

      {/* Hook text — displayed over the phone sliding up */}
      {frame < T.hookEnd + 5 && (
        <div style={{
          position: 'absolute',
          top: 170, left: 0, right: 0,
          textAlign: 'center',
          padding: '0 80px',
          opacity: hookOp,
          transform: `translateY(${hookY}px)`,
        }}>
          <div style={{
            fontSize: 60,
            fontWeight: 900,
            color: L.text,
            fontFamily: 'Arial Black, Arial, sans-serif',
            lineHeight: 1.12,
          }}>
            Stock signals<br />
            without the<br />
            <span style={{ color: L.accent }}>guru tax</span>
          </div>
        </div>
      )}

      {/* iPhone (hidden during CTA end) */}
      {phoneOpacity > 0 && (
        <IPhoneFrame translateY={phoneY} scale={1} opacity={phoneOpacity}>
          <PhoneScreens props={props} />
        </IPhoneFrame>
      )}

      {/* Section captions */}
      <CaptionBar
        text="15–50 signals daily. Entry zones, targets, stop losses."
        startF={T.hookEnd + 18}
        endF={T.signalsEnd - 8}
      />
      <CaptionBar
        text="Options signals — Max exclusive."
        startF={T.signalsEnd + 38}
        endF={T.optionsEnd - 10}
      />
      <CaptionBar
        text="Track every trade Congress makes."
        startF={T.optionsEnd + 32}
        endF={T.politEnd - 10}
      />

      {/* CTA end card */}
      {frame >= T.politEnd + 15 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 44,
        }}>
          {/* Logo block */}
          <div style={{
            transform: `scale(${ctaLogoSp})`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22,
          }}>
            <div style={{
              width: 128, height: 128, borderRadius: 34,
              backgroundColor: L.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 20px 64px ${L.accent}50`,
            }}>
              <span style={{ color: '#FFF', fontSize: 70, fontWeight: 900, fontFamily: 'Arial, sans-serif' }}>H</span>
            </div>
            <span style={{
              fontSize: 56, fontWeight: 900, color: L.text,
              fontFamily: 'Arial Black, Arial, sans-serif', letterSpacing: '-0.02em',
            }}>
              Holo<span style={{ color: L.accent }}>ture</span>
            </span>
          </div>

          {/* CTA text + button */}
          <div style={{ opacity: ctaTextOp, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
            <span style={{
              fontSize: 34, fontWeight: 600, color: L.textMuted,
              fontFamily: 'Arial, sans-serif',
            }}>
              Start free — holoture.com
            </span>
            <div style={{
              backgroundColor: L.accent,
              padding: '22px 72px', borderRadius: 100,
              boxShadow: `0 14px 44px ${L.accent}44`,
            }}>
              <span style={{
                fontSize: 40, fontWeight: 900, color: '#FFF',
                fontFamily: 'Arial Black, Arial, sans-serif',
              }}>
                Try Free →
              </span>
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  )
}

// ── Fallback sample data (used when DB tables are empty) ───────────────────────

export const PROMO_FALLBACK: PromoVideoProps = {
  signals: [
    { ticker: 'NVDA', companyName: 'NVIDIA Corp', signalType: 'BUY', confidence: 87, entryZoneLow: 118.50, entryZoneHigh: 122.00, targetPrice: 148.00, stopLoss: 112.00 },
    { ticker: 'AAPL', companyName: 'Apple Inc.', signalType: 'BUY', confidence: 79, entryZoneLow: 192.00, entryZoneHigh: 196.50, targetPrice: 220.00, stopLoss: 186.00 },
    { ticker: 'TSLA', companyName: 'Tesla Inc.', signalType: 'SHORT', confidence: 74, entryZoneLow: 248.00, entryZoneHigh: 255.00, targetPrice: 210.00, stopLoss: 265.00 },
    { ticker: 'AMZN', companyName: 'Amazon.com', signalType: 'WATCH', confidence: 61, entryZoneLow: 198.00, entryZoneHigh: 204.00, targetPrice: 228.00, stopLoss: 191.00 },
    { ticker: 'META', companyName: 'Meta Platforms', signalType: 'BUY', confidence: 82, entryZoneLow: 545.00, entryZoneHigh: 562.00, targetPrice: 620.00, stopLoss: 525.00 },
  ],
  options: [
    { ticker: 'NVDA', companyName: 'NVIDIA Corp', contractType: 'CALL', strikePrice: 125, expirationDate: 'Jul 18', confidence: 83 },
    { ticker: 'SPY',  companyName: 'S&P 500 ETF', contractType: 'CALL', strikePrice: 580, expirationDate: 'Aug 15', confidence: 76 },
    { ticker: 'TSLA', companyName: 'Tesla Inc.',  contractType: 'PUT',  strikePrice: 240, expirationDate: 'Jul 18', confidence: 71 },
  ],
  politicians: [
    { politicianName: 'Nancy Pelosi', party: 'Democrat', ticker: 'NVDA', companyName: 'NVIDIA Corp', tradeType: 'Purchase', amountRange: '$500K–$1M' },
    { politicianName: 'Ted Cruz', party: 'Republican', ticker: 'AAPL', companyName: 'Apple Inc.', tradeType: 'Purchase', amountRange: '$50K–$100K' },
    { politicianName: 'Adam Schiff', party: 'Democrat', ticker: 'MSFT', companyName: 'Microsoft', tradeType: 'Sale', amountRange: '$100K–$250K' },
  ],
}
