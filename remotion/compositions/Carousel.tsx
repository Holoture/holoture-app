/**
 * Instagram carousel — 7 slides, 1080 × 1350 px (4:5)
 *
 * Slide roster:
 *   Carousel_01_Title   — hook / title slide
 *   Carousel_02_SNDK    — stock #1 (SanDisk, +498%)
 *   Carousel_03_DELL    — stock #2 (Dell, +290%)
 *   Carousel_04_MU      — stock #3 (Micron, +271%)
 *   Carousel_05_AMD     — stock #4 (AMD, +153%)
 *   Carousel_06_AVGO    — stock #5 (Broadcom, +38%)
 *   Carousel_07_CTA     — closing call-to-action
 *
 * Exported as PNG via scripts/render-carousel.ts (renderStill).
 * Safe zone: 80 px from every edge.
 */

import React from 'react'
import { AbsoluteFill, Img, staticFile } from 'remotion'
import { loadFont } from '@remotion/google-fonts/DMSans'
import { STOCKS } from '../lib/carouselData'
import type { StockData } from '../lib/carouselData'

// ── Font ───────────────────────────────────────────────────────────────────────
const { fontFamily: DM } = loadFont('normal', { weights: ['400', '600', '700', '800'] })

// ── Canvas / safe zone ────────────────────────────────────────────────────────
const W   = 1080
const H   = 1350
const PAD = 80     // safe zone on all sides

// ── Brand colours ──────────────────────────────────────────────────────────────
const C = {
  bg:      '#0A0A0A',
  bg2:     '#1A1A2E',
  accent:  '#009BFF',
  green:   '#1D9E75',
  gold:    '#F5C842',
  white:   '#FFFFFF',
  muted:   '#CCCCCC',
  dim:     '#888888',
  dimmer:  '#444444',
  greenBg: 'rgba(29,158,117,0.18)',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND — trading-terminal look built entirely in code
// ─────────────────────────────────────────────────────────────────────────────

/** Deterministic chart path that looks like a realistic price curve */
function buildChartPath(): string {
  const pts: string[] = []
  for (let i = 0; i < 90; i++) {
    const t = i / 89
    const v =
      0.52 +
      Math.sin(t * Math.PI * 3.2)        * 0.14 +
      Math.sin(t * Math.PI * 7.5 + 1.1) * 0.055 +
      Math.cos(t * Math.PI * 11 + 2.3)  * 0.035 +
      t * 0.14                                        // gentle uptrend
    const x = t * W
    const y = H * (1 - Math.max(0.08, Math.min(0.88, v)))
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return `M ${pts.join(' L ')}`
}
const CHART_PATH = buildChartPath()

/** Deterministic candle data */
const CANDLES = Array.from({ length: 38 }, (_, i) => ({
  x:    14 + i * 27.5,
  isUp: (i * 13 + 5) % 3 !== 0,
  bH:   10 + ((i * 7) % 22),
  wH:   6  + ((i * 11) % 16),
  y:    H * 0.55 - ((i * 17 + 3) % 80),
}))

/** Floating tiny percentage strings */
const FLOATERS = [
  { x:  95, y: 195, t: '+2.4%',  s: 15, r: -11 },
  { x: 920, y: 360, t: '-0.8%',  s: 12, r:   8 },
  { x: 145, y: 840, t: '+1.2%',  s: 14, r:  -5 },
  { x: 875, y: 690, t: '+3.7%',  s: 13, r:  15 },
  { x:  90, y:1190, t: '-0.3%',  s: 11, r:  -8 },
  { x: 910, y:1060, t: '+5.1%',  s: 14, r:   6 },
  { x: 490, y: 115, t: '+0.9%',  s: 12, r:  -3 },
  { x: 760, y:1230, t: '-1.4%',  s: 13, r:  12 },
  { x: 330, y:1110, t: '+2.8%',  s: 11, r:  -7 },
  { x: 680, y: 245, t: '+0.6%',  s: 14, r:  10 },
  { x: 210, y: 430, t: '-2.1%',  s: 13, r:  -4 },
  { x: 790, y: 510, t: '+4.3%',  s: 12, r:   9 },
]

function FinancialBackground({ accentColor = C.accent }: { accentColor?: string }) {
  return (
    <AbsoluteFill style={{
      background: `linear-gradient(165deg, ${C.bg} 0%, ${C.bg2} 55%, #0F0A1E 100%)`,
    }}>
      {/* Subtle accent radial behind centre */}
      <div style={{
        position: 'absolute', left: '50%', top: '42%',
        transform: 'translate(-50%,-50%)',
        width: 860, height: 860,
        background: `radial-gradient(circle, ${accentColor}14 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />

      <svg
        style={{ position: 'absolute', inset: 0, width: W, height: H }}
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Terminal grid */}
        {Array.from({ length: 14 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 100} x2={W} y2={i * 100}
            stroke="white" strokeWidth="0.6" opacity="0.07" />
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <line key={`v${i}`} x1={i * 120} y1="0" x2={i * 120} y2={H}
            stroke="white" strokeWidth="0.6" opacity="0.07" />
        ))}

        {/* Price line chart */}
        <path d={CHART_PATH} fill="none"
          stroke={C.accent} strokeWidth="2.5" opacity="0.18"
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Area fill under line */}
        <path d={`${CHART_PATH} L ${W},${H} L 0,${H} Z`}
          fill={C.accent} opacity="0.04" />

        {/* Candlestick bars */}
        {CANDLES.map((c, i) => (
          <g key={i} opacity="0.13">
            {/* Wick */}
            <line x1={c.x} y1={c.y - c.wH} x2={c.x} y2={c.y + c.bH + c.wH}
              stroke={c.isUp ? C.green : '#E24B4A'} strokeWidth="1.2" />
            {/* Body */}
            <rect x={c.x - 5} y={c.y} width="10" height={c.bH}
              fill={c.isUp ? C.green : '#E24B4A'} rx="1" />
          </g>
        ))}
      </svg>

      {/* Floating numbers */}
      {FLOATERS.map((f, i) => (
        <div key={i} style={{
          position: 'absolute', left: f.x, top: f.y,
          fontSize: f.s, fontWeight: 600, fontFamily: DM,
          color: 'white', opacity: 0.06,
          transform: `rotate(${f.r}deg)`,
          pointerEvents: 'none',
          userSelect: 'none',
        }}>
          {f.t}
        </div>
      ))}

      {/* Bottom gradient so text is always readable */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 420,
        background: 'linear-gradient(to top, rgba(8,8,18,0.97) 0%, rgba(8,8,18,0.7) 55%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Top fade */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 180,
        background: 'linear-gradient(to bottom, rgba(8,8,18,0.80) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />
    </AbsoluteFill>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED ATOMS
// ─────────────────────────────────────────────────────────────────────────────

function Watermark() {
  return (
    <div style={{
      position: 'absolute', bottom: PAD - 8, left: 0, right: 0,
      textAlign: 'center',
      fontSize: 24, fontWeight: 400, color: C.dimmer, fontFamily: DM,
    }}>
      holoture.com
    </div>
  )
}

function MonogramLogo({ initials, bg, size = 120 }: {
  initials: string; bg: string; size?: number
}) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      backgroundColor: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 0 48px ${bg}70, 0 0 90px ${bg}30`,
      border: '2px solid rgba(255,255,255,0.18)',
      flexShrink: 0,
    }}>
      <span style={{
        fontSize: size * (initials.length > 2 ? 0.30 : 0.36),
        fontWeight: 800, color: '#FFFFFF', fontFamily: DM,
        letterSpacing: initials.length > 2 ? '-0.03em' : '-0.01em',
      }}>
        {initials}
      </span>
    </div>
  )
}

function PerformanceBadge({ ytd, isGold }: { ytd: number; isGold: boolean }) {
  const bg   = isGold ? C.gold : C.green
  const txt  = isGold ? '#1A1100' : '#FFFFFF'
  const glow = isGold ? `0 10px 50px ${C.gold}66` : `0 10px 50px ${C.green}55`
  return (
    <div style={{
      backgroundColor: bg, borderRadius: 100,
      paddingTop: 18, paddingBottom: 18, paddingLeft: 50, paddingRight: 50,
      display: 'inline-flex', alignItems: 'center',
      boxShadow: glow,
    }}>
      <span style={{
        fontSize: 72, fontWeight: 800, color: txt,
        fontFamily: DM, letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
      }}>
        ▲ +{ytd.toFixed(1)}%
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 1 — TITLE
// ─────────────────────────────────────────────────────────────────────────────

export function CarouselTitle() {
  const tickers = STOCKS.map(s => s.ticker)

  return (
    <AbsoluteFill>
      <FinancialBackground />

      {/* Logo */}
      <div style={{
        position: 'absolute', top: PAD + 20, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
      }}>
        <Img
          src={staticFile('logo.png')}
          style={{ width: 170, height: 170, objectFit: 'contain',
            filter: 'drop-shadow(0 0 24px rgba(0,155,255,0.55))' }}
        />
      </div>

      {/* Headline stack */}
      <div style={{
        position: 'absolute',
        top: PAD + 220, left: PAD, right: PAD,
        textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        {[
          { text: 'THE 5 BEST',      color: C.white, size: 96 },
          { text: 'PERFORMING',      color: C.white, size: 96 },
          { text: 'STOCKS OF 2026',  color: C.accent, size: 96 },
        ].map(({ text, color, size }) => (
          <div key={text} style={{
            fontSize: size, fontWeight: 800, color, fontFamily: DM,
            lineHeight: 1.08, letterSpacing: '-0.02em',
          }}>
            {text}
          </div>
        ))}
        <div style={{
          fontSize: 52, fontWeight: 400, color: C.dim, fontFamily: DM,
          marginTop: 8, letterSpacing: '0.04em',
        }}>
          (SO FAR)
        </div>
      </div>

      {/* Ticker pills */}
      <div style={{
        position: 'absolute',
        top: PAD + 740,
        left: PAD, right: PAD,
        display: 'flex', justifyContent: 'center',
        gap: 18, flexWrap: 'nowrap',
      }}>
        {tickers.map((t, i) => (
          <div key={t} style={{
            backgroundColor: 'rgba(255,255,255,0.08)',
            border: '1.5px solid rgba(255,255,255,0.18)',
            borderRadius: 50,
            paddingTop: 12, paddingBottom: 12,
            paddingLeft: 22, paddingRight: 22,
          }}>
            <span style={{
              fontSize: 30, fontWeight: 800, color: C.white, fontFamily: DM,
            }}>
              {t}
            </span>
          </div>
        ))}
      </div>

      {/* Year badge */}
      <div style={{
        position: 'absolute',
        top: PAD + 870,
        left: PAD, right: PAD,
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block',
          backgroundColor: 'rgba(0,155,255,0.12)',
          border: `1px solid ${C.accent}44`,
          borderRadius: 40, padding: '10px 32px',
        }}>
          <span style={{ fontSize: 30, fontWeight: 600, color: C.accent, fontFamily: DM }}>
            Year-to-date · June 2026
          </span>
        </div>
      </div>

      {/* Swipe prompt */}
      <div style={{
        position: 'absolute',
        bottom: PAD + 80,
        left: PAD, right: PAD,
        textAlign: 'center',
      }}>
        <span style={{ fontSize: 32, fontWeight: 400, color: '#666666', fontFamily: DM }}>
          Swipe to see each stock →
        </span>
      </div>

      {/* Tiny watermark bottom-right */}
      <div style={{
        position: 'absolute', bottom: PAD - 8, right: PAD,
        fontSize: 24, fontWeight: 400, color: C.dimmer, fontFamily: DM,
      }}>
        holoture.com
      </div>
    </AbsoluteFill>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDES 2-6 — STOCK SLIDES
// ─────────────────────────────────────────────────────────────────────────────

export function CarouselStock(props: StockData) {
  const isGold   = props.rank === 1
  const badgeBg  = isGold ? C.gold : C.green
  const rankLabel = ['#1', '#2', '#3', '#4', '#5'][props.rank - 1]

  return (
    <AbsoluteFill>
      <FinancialBackground accentColor={props.color} />

      {/* Rank badge — top-left */}
      <div style={{
        position: 'absolute', top: PAD, left: PAD,
        backgroundColor: isGold ? `${C.gold}22` : 'rgba(255,255,255,0.07)',
        border: `1.5px solid ${isGold ? C.gold : 'rgba(255,255,255,0.15)'}`,
        borderRadius: 50,
        paddingTop: 8, paddingBottom: 8, paddingLeft: 20, paddingRight: 20,
      }}>
        <span style={{
          fontSize: 28, fontWeight: 800,
          color: isGold ? C.gold : C.muted,
          fontFamily: DM,
        }}>
          {rankLabel} Performer
        </span>
      </div>

      {/* Logo / monogram */}
      <div style={{
        position: 'absolute', top: PAD + 20, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
      }}>
        <MonogramLogo initials={props.initials} bg={props.color} size={120} />
      </div>

      {/* Ticker */}
      <div style={{
        position: 'absolute', top: PAD + 172, left: PAD, right: PAD,
        textAlign: 'center',
      }}>
        <span style={{
          fontSize: 110, fontWeight: 800, color: C.white, fontFamily: DM,
          letterSpacing: '-0.03em', lineHeight: 1,
        }}>
          {props.ticker}
        </span>
      </div>

      {/* Performance badge */}
      <div style={{
        position: 'absolute', top: PAD + 305, left: PAD, right: PAD,
        display: 'flex', justifyContent: 'center',
      }}>
        <PerformanceBadge ytd={props.ytd} isGold={isGold} />
      </div>

      {/* Company name */}
      <div style={{
        position: 'absolute', top: PAD + 470, left: PAD, right: PAD,
        textAlign: 'center',
      }}>
        <span style={{
          fontSize: 46, fontWeight: 600, color: C.white, fontFamily: DM,
          letterSpacing: '-0.01em',
        }}>
          {props.name}
        </span>
      </div>

      {/* Divider */}
      <div style={{
        position: 'absolute', top: PAD + 550, left: PAD + 60, right: PAD + 60,
        height: 2, backgroundColor: C.accent, opacity: 0.55,
      }} />

      {/* Reason fragment */}
      <div style={{
        position: 'absolute', top: PAD + 576, left: PAD, right: PAD,
        textAlign: 'center',
      }}>
        <span style={{
          fontSize: 38, fontWeight: 400, fontStyle: 'italic',
          color: C.muted, fontFamily: DM, lineHeight: 1.45,
        }}>
          {props.reason}
        </span>
      </div>

      {/* YTD context bar */}
      <div style={{
        position: 'absolute', top: PAD + 670, left: PAD, right: PAD,
        display: 'flex', justifyContent: 'center',
      }}>
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 40, padding: '10px 28px',
        }}>
          <span style={{ fontSize: 28, fontWeight: 600, color: C.dim, fontFamily: DM }}>
            S&P 500 up 5.7% YTD&nbsp;&nbsp;·&nbsp;&nbsp;
            <span style={{ color: isGold ? C.gold : C.green }}>
              {props.ticker} up {props.ytd.toFixed(1)}%
            </span>
          </span>
        </div>
      </div>

      {/* Bottom — slide counter (right) */}
      <div style={{
        position: 'absolute', bottom: PAD + 50, right: PAD,
        fontSize: 28, fontWeight: 600, color: '#666666', fontFamily: DM,
      }}>
        {props.slideNum}
      </div>

      {/* Disclaimer bottom-left */}
      <div style={{
        position: 'absolute', bottom: PAD + 50, left: PAD,
        fontSize: 22, fontWeight: 400, color: C.dimmer, fontFamily: DM,
      }}>
        Not financial advice.
      </div>

      {/* Watermark bottom-center */}
      <Watermark />
    </AbsoluteFill>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 7 — CTA
// ─────────────────────────────────────────────────────────────────────────────

export function CarouselCTA() {
  return (
    <AbsoluteFill>
      {/* Slightly brighter bg with blue glow */}
      <AbsoluteFill style={{
        background: `linear-gradient(165deg, #0D0D18 0%, #141426 55%, #0D0D18 100%)`,
      }} />
      <FinancialBackground accentColor={C.accent} />

      {/* Extra accent glow centre */}
      <div style={{
        position: 'absolute', left: '50%', top: '40%',
        transform: 'translate(-50%,-50%)',
        width: 780, height: 780,
        background: `radial-gradient(circle, ${C.accent}22 0%, transparent 60%)`,
      }} />

      {/* Logo */}
      <div style={{
        position: 'absolute', top: PAD + 30, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
      }}>
        <Img
          src={staticFile('logo.png')}
          style={{
            width: 200, height: 200, objectFit: 'contain',
            filter: 'drop-shadow(0 0 32px rgba(0,155,255,0.70))',
          }}
        />
      </div>

      {/* Text stack */}
      <div style={{
        position: 'absolute',
        top: PAD + 280, left: PAD, right: PAD,
        textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}>
        <div style={{ fontSize: 88, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
          DON'T MISS OUT
        </div>
        <div style={{ fontSize: 72, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
          ON TRADES LIKE THIS.
        </div>
      </div>

      {/* Sub-headline */}
      <div style={{
        position: 'absolute',
        top: PAD + 560, left: PAD, right: PAD,
        textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
      }}>
        <div style={{ fontSize: 56, fontWeight: 700, color: C.accent, fontFamily: DM, letterSpacing: '-0.01em' }}>
          TRY HOLOTURE FOR FREE
        </div>
        <div style={{ fontSize: 44, fontWeight: 400, fontStyle: 'italic', color: C.muted, fontFamily: DM }}>
          TRADE WITH AN EDGE
        </div>
      </div>

      {/* CTA pill button (visual only) */}
      <div style={{
        position: 'absolute',
        top: PAD + 760, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22,
      }}>
        <div style={{
          width: 600, height: 90,
          backgroundColor: C.accent,
          borderRadius: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 12px 60px ${C.accent}55`,
        }}>
          <span style={{
            fontSize: 48, fontWeight: 800, color: '#FFFFFF', fontFamily: DM,
            letterSpacing: '-0.01em',
          }}>
            holoture.com
          </span>
        </div>
        <span style={{ fontSize: 30, fontWeight: 400, color: C.dim, fontFamily: DM }}>
          Free daily signal. No credit card.
        </span>
      </div>

      {/* Slide counter */}
      <div style={{
        position: 'absolute', bottom: PAD + 50, right: PAD,
        fontSize: 28, fontWeight: 600, color: '#666666', fontFamily: DM,
      }}>
        07 / 07
      </div>

      <Watermark />
    </AbsoluteFill>
  )
}
