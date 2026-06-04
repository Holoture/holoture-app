/**
 * BuyTheDip — Holoture educational graphic
 * "Don't Buy Every Dip" — animated 4:5 social card
 *
 * Canvas : 1080 × 1350 px
 * FPS    : 30  |  Duration : 180 frames (6 seconds)
 *
 * Animation timeline:
 *   0–20   Background + logo fade in
 *  10–35   "Don't Buy" title springs in from below
 *  30–50   Subtitle fades in
 *  45–65   Section headers + panel borders appear
 *  55–105  Left  chart line draws left→right (clip reveal)
 *  65–115  Right chart line draws left→right (clip reveal)
 *  80–140  Buy markers + labels stagger in
 * 120–145  Bottom tagline fades in
 * 145–180  Hold
 *
 * Render as PNG still (frame 170):
 *   npx tsx scripts/render-buy-the-dip.ts
 *
 * Render as MP4:
 *   npx remotion render remotion/index.ts BuyTheDip \
 *     "C:\Users\jaken\Desktop\buy-the-dip.mp4" --public-dir=public
 */

import React from 'react'
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { loadFont } from '@remotion/google-fonts/DMSans'

const { fontFamily: DM } = loadFont('normal', { weights: ['400', '500', '600', '700', '800'] })

// ── Brand ─────────────────────────────────────────────────────────────────────
const C = {
  bg:      '#080C1A',
  bgCard:  '#0D1120',
  green:   '#1D9E75',
  greenDim:'#0D2B1F',
  red:     '#E24B4A',
  redDim:  '#2B0D0D',
  accent:  '#009BFF',
  white:   '#FFFFFF',
  muted:   'rgba(255,255,255,0.60)',
  dim:     'rgba(255,255,255,0.35)',
  chart:   '#FFFFFF',
} as const

// ── Layout ────────────────────────────────────────────────────────────────────
const W  = 1080
const H  = 1350
const PX = 52          // horizontal page padding

// ── Helpers ───────────────────────────────────────────────────────────────────
const EO = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ip = (f: number, i: number[], o: number[]) => interpolate(f, i, o, EO)
const sp = (fps: number, f: number, cfg = { damping: 14, mass: 1.1, stiffness: 110 }) =>
  spring({ fps, frame: Math.max(0, f), config: cfg })

// ══════════════════════════════════════════════════════════════════════════════
// SVG CHART PATHS  (viewBox 0 0 460 300)
// ══════════════════════════════════════════════════════════════════════════════

// Left — V-shaped recovery (dips, then strong rally)
const LEFT_PATH =
  'M 10,120 C 30,110 50,130 70,165 C 90,200 110,240 128,272 ' +
  'C 140,288 152,294 162,290 C 175,284 185,268 200,242 ' +
  'C 220,208 245,168 272,132 C 300,94  330,64  365,44 ' +
  'C 390,30  420,22  450,20'

// Buy marker position on left chart (the bottom of the dip)
const LEFT_BUY = { x: 162, y: 290 }

// Right — staircase decline with three dead-cat bounces
const RIGHT_PATH =
  'M 10,28 C 30,22 50,18 70,30 C 85,40 95,55 105,48 ' +
  'C 118,38 128,30 140,50 C 152,70  162,92  175,86 ' +
  'C 188,80  198,75  210,95 C 225,118 238,140 252,132 ' +
  'C 265,124 274,118 288,138 C 305,162 318,185 334,178 ' +
  'C 348,172 358,165 374,186 C 392,210 412,242 435,268 C 445,280 452,290 460,298'

// Three failed buy points on right chart
const RIGHT_BUYS = [
  { x: 105, y: 48,  label: 'Buy the dip!', dx: 8,  dy: -22 },
  { x: 252, y: 132, label: 'Buy the dip!', dx: 8,  dy: -22 },
  { x: 334, y: 178, label: 'Ummmmm...',    dx: 8,  dy: -22 },
]

// ══════════════════════════════════════════════════════════════════════════════
// CHART COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

interface ChartProps {
  side:        'left' | 'right'
  drawStart:   number   // global frame when reveal begins
  drawEnd:     number   // global frame when reveal ends
  markStart:   number   // global frame when markers begin appearing
}

function Chart({ side, drawStart, drawEnd, markStart }: ChartProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const isLeft      = side === 'left'
  const lineColor   = C.chart
  const borderColor = isLeft ? C.green : C.red
  const bgColor     = isLeft ? C.greenDim : C.redDim
  const path        = isLeft ? LEFT_PATH : RIGHT_PATH

  // Clip-reveal: a rect grows from x=0 to x=460 over drawStart→drawEnd frames
  const revealW = ip(frame, [drawStart, drawEnd], [0, 460])

  // Marker springs — staggered
  const markers = isLeft
    ? [{ ...LEFT_BUY, label: 'Buy the Dip', type: 'check' as const, delay: 0, dx: 12, dy: -22 }]
    : RIGHT_BUYS.map((b, i) => ({ ...b, type: 'x' as const, delay: i * 10 }))

  const PANEL_W  = 460
  const PANEL_H  = 310
  const CHART_VB = '0 0 460 310'

  return (
    <div style={{
      width: PANEL_W, height: PANEL_H,
      backgroundColor: bgColor,
      borderRadius: 18,
      border: `2px solid ${borderColor}`,
      overflow: 'hidden',
      position: 'relative',
    }}>
      <svg
        width={PANEL_W}
        height={PANEL_H}
        viewBox={CHART_VB}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          {/* Clip rect that expands left→right */}
          <clipPath id={`reveal-${side}`}>
            <rect x="0" y="-10" width={revealW} height="340" />
          </clipPath>

          {/* Subtle area-fill gradient under line */}
          <linearGradient id={`areaFill-${side}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={borderColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={borderColor} stopOpacity="0"    />
          </linearGradient>
        </defs>

        {/* Subtle grid */}
        {[75, 150, 225].map(y => (
          <line key={y} x1="0" y1={y} x2="460" y2={y}
            stroke="white" strokeWidth="0.6" opacity="0.06" />
        ))}
        {[115, 230, 345].map(x => (
          <line key={x} x1={x} y1="0" x2={x} y2="310"
            stroke="white" strokeWidth="0.6" opacity="0.06" />
        ))}

        {/* Area fill (same clip) */}
        <path
          d={`${path} L 460,310 L 10,310 Z`}
          fill={`url(#areaFill-${side})`}
          clipPath={`url(#reveal-${side})`}
        />

        {/* Main line */}
        <path
          d={path}
          fill="none"
          stroke={lineColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath={`url(#reveal-${side})`}
        />

        {/* Buy markers */}
        {markers.map((m, i) => {
          const markerSp  = sp(fps, Math.max(0, frame - markStart - m.delay))
          const markerSc  = ip(markerSp, [0, 1], [0, 1])
          const markerOp  = ip(frame - markStart - m.delay, [0, 12], [0, 1])
          const labelOp   = ip(frame - markStart - m.delay - 8, [0, 14], [0, 1])

          return (
            <g key={i}
              transform={`translate(${m.x}, ${m.y}) scale(${markerSc})`}
              style={{ transformOrigin: `${m.x}px ${m.y}px` }}
              opacity={markerOp}
            >
              {m.type === 'check' ? (
                /* Green dot + tick */
                <>
                  <circle r="9" fill={C.green} />
                  <path d="M -4,0 L -1,3.5 L 5,-3.5"
                    fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </>
              ) : (
                /* Red X */
                <>
                  <circle r="9" fill={C.red} />
                  <path d="M -4,-4 L 4,4 M 4,-4 L -4,4"
                    fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                </>
              )}

              {/* Label */}
              <text
                x={m.dx}
                y={m.dy}
                fill="white"
                fontSize="18"
                fontFamily={DM}
                fontWeight="500"
                opacity={labelOp}
              >
                {m.label}
              </text>
            </g>
          )
        })}

        {/* Left chart only — "Yessss!" celebration */}
        {isLeft && (() => {
          const celebOp = ip(frame - markStart - 18, [0, 16], [0, 1])
          const celebY  = ip(sp(fps, Math.max(0, frame - markStart - 18)), [0, 1], [8, 0])
          return (
            <g opacity={celebOp} transform={`translate(0, ${celebY})`}>
              <text x="300" y="52" fill={C.green} fontSize="22" fontFamily={DM} fontWeight="700">
                Yessss! 📈
              </text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT COMPOSITION
// ══════════════════════════════════════════════════════════════════════════════

export const BuyTheDip: React.FC = () => {
  const frame   = useCurrentFrame()
  const { fps } = useVideoConfig()

  // ── Global entrance animations ──────────────────────────────────────────────

  const bgOp       = ip(frame, [0, 20], [0, 1])

  // Title: large spring from below
  const titleSp    = sp(fps, frame - 10, { damping: 16, mass: 1.2, stiffness: 100 })
  const titleY     = ip(titleSp, [0, 1], [50, 0])
  const titleOp    = ip(frame, [10, 28], [0, 1])

  // "The dip" accent word (delayed, different color)
  const accentDelay = 6
  const accentSp   = sp(fps, frame - 10 - accentDelay, { damping: 16, mass: 1.2, stiffness: 100 })
  const accentY    = ip(accentSp, [0, 1], [50, 0])

  const subtitleOp = ip(frame, [30, 48], [0, 1])
  const subtitleY  = ip(frame, [30, 48], [14, 0])

  const headersOp  = ip(frame, [45, 62], [0, 1])
  const headersY   = ip(frame, [45, 62], [12, 0])

  const panelOp    = ip(frame, [45, 62], [0, 1])
  const panelY     = ip(sp(fps, Math.max(0, frame - 45)), [0, 1], [20, 0])

  const taglineOp  = ip(frame, [120, 142], [0, 1])
  const taglineY   = ip(frame, [120, 142], [14, 0])

  const logoOp     = ip(frame, [0, 22], [0, 1])

  // ── Panel layout (two columns) ───────────────────────────────────────────────
  const GAP        = 28
  const PANEL_W    = (W - PX * 2 - GAP) / 2   // ≈ 474 → chart SVG is 460, add padding

  return (
    <AbsoluteFill style={{
      backgroundColor: C.bg,
      opacity: bgOp,
      fontFamily: DM,
    }}>

      {/* ── Subtle background texture ─────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse 70% 40% at 20% 80%, rgba(0,155,255,0.07) 0%, transparent 70%),
          radial-gradient(ellipse 60% 35% at 80% 20%, rgba(29,158,117,0.06) 0%, transparent 70%)
        `,
        pointerEvents: 'none',
      }} />

      {/* ── TOP BAR — logo left, "holoture.com" right ─────────────────────── */}
      <div style={{
        position: 'absolute', top: 44, left: PX, right: PX,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        opacity: logoOp,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Img src={staticFile('logo.png')}
            style={{ width: 42, height: 42, objectFit: 'contain' }} />
          <span style={{
            fontSize: 24, fontWeight: 800, color: C.white,
            letterSpacing: '-0.01em',
          }}>
            Holo<span style={{ color: C.accent }}>ture</span>
          </span>
        </div>
        <span style={{ fontSize: 20, fontWeight: 500, color: C.dim }}>
          holoture.com
        </span>
      </div>

      {/* ── TITLE ─────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: 130,
        left: PX, right: PX,
        textAlign: 'center',
      }}>
        {/* "Don't" */}
        <div style={{
          fontSize: 148, fontWeight: 800, color: C.white,
          lineHeight: 0.94, letterSpacing: '-0.04em',
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
        }}>
          Don't
        </div>

        {/* "Buy" — accent color, slightly delayed */}
        <div style={{
          fontSize: 148, fontWeight: 800, color: C.accent,
          lineHeight: 0.94, letterSpacing: '-0.04em',
          opacity: titleOp,
          transform: `translateY(${accentY}px)`,
          marginTop: 4,
        }}>
          Buy
        </div>
      </div>

      {/* ── SUBTITLE ──────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: 492,
        left: PX, right: PX,
        textAlign: 'center',
        opacity: subtitleOp,
        transform: `translateY(${subtitleY}px)`,
      }}>
        <span style={{
          fontSize: 36, fontWeight: 500, color: C.muted,
          letterSpacing: '0.01em',
        }}>
          Not Every Dip Is A Buying Opportunity
        </span>
      </div>

      {/* ── COLUMN HEADERS ────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: 570,
        left: PX, right: PX,
        display: 'flex', gap: GAP,
        opacity: headersOp,
        transform: `translateY(${headersY}px)`,
      }}>
        {['What you want', 'What may happen'].map((label, i) => (
          <div key={i} style={{
            flex: 1, textAlign: 'center',
            fontSize: 32, fontWeight: 700,
            color: i === 0 ? C.green : C.red,
          }}>
            {label}
          </div>
        ))}
      </div>

      {/* ── CHART PANELS ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: 618,
        left: PX, right: PX,
        display: 'flex', gap: GAP,
        opacity: panelOp,
        transform: `translateY(${panelY}px)`,
      }}>
        {/* Left panel wrapper — adds padding around the 460px SVG */}
        <div style={{ flex: 1, padding: '20px 16px 16px', backgroundColor: C.greenDim, borderRadius: 20, border: `2px solid ${C.green}` }}>
          <Chart side="left"  drawStart={55} drawEnd={105} markStart={88} />
        </div>

        {/* Right panel wrapper */}
        <div style={{ flex: 1, padding: '20px 16px 16px', backgroundColor: C.redDim, borderRadius: 20, border: `2px solid ${C.red}` }}>
          <Chart side="right" drawStart={65} drawEnd={115} markStart={92} />
        </div>
      </div>

      {/* ── BOTTOM TAGLINE ────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: 1182,
        left: PX, right: PX,
        textAlign: 'center',
        opacity: taglineOp,
        transform: `translateY(${taglineY}px)`,
      }}>
        <span style={{
          fontSize: 38, fontWeight: 600, color: C.white,
          lineHeight: 1.4,
        }}>
          Not every dip is worthy of your money.
        </span>
      </div>

      {/* ── BOTTOM — "Free signals at Holoture" ───────────────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: 48,
        left: PX, right: PX,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
        opacity: taglineOp,
      }}>
        <div style={{
          backgroundColor: 'rgba(0,155,255,0.12)',
          border: `1px solid rgba(0,155,255,0.30)`,
          borderRadius: 50,
          paddingTop: 10, paddingBottom: 10, paddingLeft: 28, paddingRight: 28,
        }}>
          <span style={{
            fontSize: 26, fontWeight: 600, color: C.accent,
          }}>
            Get smarter signals — holoture.com
          </span>
        </div>
      </div>

    </AbsoluteFill>
  )
}
