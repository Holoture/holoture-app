/**
 * StockReels — 5 stock analysis reels (Holoture bullish picks, June 2026)
 *
 * Canvas : 1080 × 1920  |  30 fps  |  ~57 s / 1710 frames each
 * Stocks : QS · SERV · MSFT · PLTR · HOOD
 *
 * Scene timeline (shared across all 5):
 *   S1   0–179   Hook              6 s   enticing question / big stat
 *   S2  180–449  What Is It        9 s   company context, 3 bullet points
 *   S3  450–809  Technical Setup  12 s   chart draw-in, support/resistance/retest
 *   S4  810–1109 Bull Case        10 s   why Holoture is bullish
 *   S5 1110–1379 Key Levels        9 s   entry, targets, stop, upside %
 *   S6 1380–1559 Risk              6 s   balanced bear case
 *   S7 1560–1709 CTA               5 s   holoture.com
 *
 * Safe zones: top ≥ 150 px, bottom ≤ 1750 px, sides ≥ 60 px
 * Min font : headline 56 px, body 36 px, label 28 px
 */

import React from 'react'
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { loadFont } from '@remotion/google-fonts/DMSans'

// ── Font ───────────────────────────────────────────────────────────────────────
const { fontFamily: DM } = loadFont('normal', { weights: ['400', '600', '700', '800'] })

// ── Brand colours ──────────────────────────────────────────────────────────────
const C = {
  bg:      '#0F0F0F',
  accent:  '#009BFF',
  green:   '#1D9E75',
  red:     '#E24B4A',
  gold:    '#F5C842',
  white:   '#FFFFFF',
  muted:   'rgba(255,255,255,0.52)',
  dimmer:  'rgba(255,255,255,0.30)',
  greenBg: 'rgba(29,158,117,0.15)',
  redBg:   'rgba(226,75,74,0.15)',
  blueBg:  'rgba(0,155,255,0.15)',
} as const

// ── Layout ─────────────────────────────────────────────────────────────────────
const VW     = 1080
const VH     = 1920
const SAFE_T = 150
const SAFE_B = 170
const SAFE_X = 60
const CW     = VW - SAFE_X * 2   // 960 px

// ── Helpers ────────────────────────────────────────────────────────────────────
const EO = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ip = (f: number, i: number[], o: number[]) => interpolate(f, i, o, EO)
const sc = { damping: 15, mass: 1.2, stiffness: 100 }
const sp = (fps: number, f: number, cfg: Record<string,number> = sc) =>
  spring({ fps, frame: Math.max(0, f), config: cfg })

// ── Watermark ─────────────────────────────────────────────────────────────────
function Watermark() {
  const frame = useCurrentFrame()
  return (
    <div style={{
      position: 'absolute', bottom: SAFE_B + 12, right: SAFE_X,
      transform: `translateY(${Math.sin(frame * 0.05) * 5}px)`,
      opacity: 0.55,
    }}>
      <Img src={staticFile('logo.png')} style={{ width: 50, height: 50, objectFit: 'contain' }} />
    </div>
  )
}

// ── Radial glow ───────────────────────────────────────────────────────────────
function Glow({ color = C.accent, w = 700, h = 500, op = 0.25 }: {
  color?: string; w?: number; h?: number; op?: number
}) {
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '45%',
      transform: 'translate(-50%,-50%)',
      width: w, height: h,
      background: `radial-gradient(ellipse, ${color} 0%, transparent 68%)`,
      opacity: op, pointerEvents: 'none',
    }} />
  )
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: bg, border: `1.5px solid ${color}`,
      borderRadius: 16, padding: '18px 28px',
    }}>
      <span style={{ fontSize: 30, fontWeight: 600, color: C.muted, fontFamily: DM }}>{label}</span>
      <span style={{ fontSize: 36, fontWeight: 800, color, fontFamily: DM }}>{value}</span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// STOCK CONFIG TYPE
// ══════════════════════════════════════════════════════════════════════════════

interface BulletPoint { icon: string; title: string; body: string }

interface StockConfig {
  ticker:      string
  companyName: string
  accentColor: string
  // S1 — Hook
  hookHeadline:  string    // big bold statement (1-2 lines)
  hookStat:      string    // the char-by-char reveal stat
  hookStatLabel: string    // e.g. "+41% potential upside"
  hookSub:       string    // smaller supporting line
  // S2 — What Is It
  whatTitle:   string
  whatPoints:  BulletPoint[]
  // S3 — Technical Setup
  setupHeadline: string
  setupBody:     string    // 1-2 sentence setup description
  chartPath:     string    // SVG path for price line (viewBox 0 0 900 280)
  supportPrice:  string
  resistPrice:   string
  entryZone:     string
  // S4 — Bull Case
  bullTitle:  string
  bullPoints: string[]
  // S5 — Key Levels
  levelsTitle: string
  support:     string
  entry:       string
  target1:     string
  target2:     string
  stop:        string
  upside:      string
  // S6 — Risk
  riskTitle:  string
  riskPoints: string[]
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 1 — HOOK  (180 frames / 6 s)
// ══════════════════════════════════════════════════════════════════════════════

function SceneHook({ s }: { s: StockConfig }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const qSp    = sp(fps, frame, { damping: 13, mass: 1.1, stiffness: 115 })
  const qScale = ip(qSp, [0, 1], [1.9, 1])
  const qOp    = ip(frame, [0, 10], [0, 1])

  // Char-by-char reveal for hookStat
  const STAT_START = 28
  const CHAR_RATE  = 3
  const visible    = Math.min(s.hookStat.length, Math.max(0, Math.floor((frame - STAT_START) / CHAR_RATE)))

  const statLabelOp = ip(frame, [STAT_START + s.hookStat.length * CHAR_RATE + 4, STAT_START + s.hookStat.length * CHAR_RATE + 22], [0, 1])
  const subOp       = ip(frame, [STAT_START + s.hookStat.length * CHAR_RATE + 16, STAT_START + s.hookStat.length * CHAR_RATE + 34], [0, 1])
  const glowOp      = 0.20 + Math.sin(frame * 0.14) * 0.09
  const exitY       = ip(frame, [162, 179], [0, -VH])

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, transform: `translateY(${exitY}px)` }}>
      <Glow color={s.accentColor} w={820} h={620} op={glowOp} />

      {/* Ticker badge */}
      <div style={{
        position: 'absolute', top: SAFE_T + 60, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        opacity: ip(frame, [0, 14], [0, 1]),
      }}>
        <div style={{
          backgroundColor: `${s.accentColor}22`,
          border: `2px solid ${s.accentColor}`,
          borderRadius: 50, paddingTop: 10, paddingBottom: 10,
          paddingLeft: 32, paddingRight: 32,
        }}>
          <span style={{ fontSize: 36, fontWeight: 800, color: s.accentColor, fontFamily: DM, letterSpacing: '0.10em' }}>
            ${s.ticker}
          </span>
        </div>
      </div>

      {/* Headline */}
      <div style={{
        position: 'absolute', top: SAFE_T + 180, left: SAFE_X, right: SAFE_X,
        textAlign: 'center',
        transform: `scale(${qScale})`, opacity: qOp,
      }}>
        <div style={{ fontSize: 68, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.14 }}>
          {s.hookHeadline}
        </div>
      </div>

      {/* Big stat — char by char */}
      <div style={{
        position: 'absolute', top: SAFE_T + 500, left: SAFE_X, right: SAFE_X,
        textAlign: 'center',
      }}>
        <span style={{
          fontSize: 100, fontWeight: 800, color: s.accentColor,
          fontFamily: DM, letterSpacing: '-0.02em',
        }}>
          {s.hookStat.slice(0, visible)}
        </span>
      </div>

      {/* Stat label */}
      <div style={{
        position: 'absolute', top: SAFE_T + 640, left: SAFE_X, right: SAFE_X,
        textAlign: 'center', opacity: statLabelOp,
      }}>
        <span style={{ fontSize: 38, fontWeight: 700, color: C.gold, fontFamily: DM }}>
          {s.hookStatLabel}
        </span>
      </div>

      {/* Supporting sub */}
      <div style={{
        position: 'absolute', top: SAFE_T + 710, left: SAFE_X + 40, right: SAFE_X + 40,
        textAlign: 'center', opacity: subOp,
      }}>
        <span style={{ fontSize: 36, fontWeight: 400, color: C.muted, fontFamily: DM, lineHeight: 1.45 }}>
          {s.hookSub}
        </span>
      </div>
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 2 — WHAT IS IT  (270 frames / 9 s)
// ══════════════════════════════════════════════════════════════════════════════

function SceneWhatIsIt({ s }: { s: StockConfig }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const entryX = ip(sp(fps, frame, { damping: 20, mass: 1.0, stiffness: 90 }), [0, 1], [VW, 0])
  const exitX  = ip(frame, [250, 269], [0, -VW])
  const slideX = frame < 250 ? entryX : exitX

  const titleOp = ip(frame, [8, 26], [0, 1])
  const titleY  = ip(frame, [8, 26], [20, 0])

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, transform: `translateX(${slideX}px)` }}>
      <Glow color={s.accentColor} w={500} h={400} op={0.15} />
      <Watermark />

      <div style={{ position: 'absolute', top: SAFE_T + 20, left: SAFE_X, right: SAFE_X, opacity: titleOp, transform: `translateY(${titleY}px)` }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: s.accentColor, fontFamily: DM, letterSpacing: '0.10em', textTransform: 'uppercase' as const }}>
          Quick context —
        </div>
        <div style={{ fontSize: 60, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.15, marginTop: 8 }}>
          {s.whatTitle}
        </div>
      </div>

      <div style={{ position: 'absolute', top: SAFE_T + 250, left: SAFE_X, right: SAFE_X, display: 'flex', flexDirection: 'column', gap: 26 }}>
        {s.whatPoints.map((pt, i) => {
          const st  = 28 + i * 22
          const op  = ip(frame, [st, st + 18], [0, 1])
          const txY = ip(sp(fps, Math.max(0, frame - st)), [0, 1], [36, 0])
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 22, opacity: op, transform: `translateY(${txY}px)` }}>
              <div style={{
                width: 80, height: 80, borderRadius: 18, flexShrink: 0,
                backgroundColor: `${s.accentColor}18`,
                border: `2px solid ${s.accentColor}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 34,
              }}>
                {pt.icon}
              </div>
              <div style={{ paddingTop: 4 }}>
                <div style={{ fontSize: 42, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.15 }}>
                  {pt.title}
                </div>
                <div style={{ fontSize: 32, fontWeight: 400, color: C.muted, fontFamily: DM, marginTop: 6, lineHeight: 1.45 }}>
                  {pt.body}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 3 — TECHNICAL SETUP  (360 frames / 12 s)
// ══════════════════════════════════════════════════════════════════════════════

const CHART_W = 900
const CHART_H = 280

function SceneSetup({ s }: { s: StockConfig }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const entryX = ip(sp(fps, frame, { damping: 20, mass: 1.0, stiffness: 88 }), [0, 1], [VW, 0])
  const exitX  = ip(frame, [340, 359], [0, -VW])
  const slideX = frame < 340 ? entryX : exitX

  const titleOp   = ip(frame, [8, 24], [0, 1])
  const bodyOp    = ip(frame, [20, 38], [0, 1])
  const bodyY     = ip(frame, [20, 38], [14, 0])

  // Chart clips in left→right from frame 35
  const chartRevealW = ip(frame - 35, [0, 90], [0, CHART_W])

  // Support / resistance lines fade in after chart is mostly drawn
  const suppOp  = ip(frame, [115, 135], [0, 1])
  const resOp   = ip(frame, [125, 145], [0, 1])
  const entryOp = ip(frame, [135, 155], [0, 1])

  // Level labels
  const labelsOp = ip(frame, [155, 175], [0, 1])

  // "Retest zone" annotation
  const retestOp = ip(frame, [190, 210], [0, 1])
  const retestY  = ip(sp(fps, Math.max(0, frame - 190)), [0, 1], [16, 0])

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, transform: `translateX(${slideX}px)` }}>
      <Glow color={C.accent} w={600} h={400} op={0.12} />
      <Watermark />

      {/* Title */}
      <div style={{ position: 'absolute', top: SAFE_T + 20, left: SAFE_X, right: SAFE_X, opacity: titleOp }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: C.accent, fontFamily: DM, letterSpacing: '0.10em', textTransform: 'uppercase' as const }}>
          Technical Setup
        </div>
        <div style={{ fontSize: 58, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.15, marginTop: 6 }}>
          {s.setupHeadline}
        </div>
      </div>

      {/* Setup body text */}
      <div style={{
        position: 'absolute', top: SAFE_T + 198, left: SAFE_X, right: SAFE_X,
        opacity: bodyOp, transform: `translateY(${bodyY}px)`,
      }}>
        <span style={{ fontSize: 34, fontWeight: 400, color: C.muted, fontFamily: DM, lineHeight: 1.5 }}>
          {s.setupBody}
        </span>
      </div>

      {/* Chart area */}
      <div style={{ position: 'absolute', top: SAFE_T + 400, left: SAFE_X, right: SAFE_X }}>
        <svg width={CHART_W} height={CHART_H + 40} viewBox={`0 0 ${CHART_W} ${CHART_H + 40}`}>
          <defs>
            <clipPath id={`chartClip-${s.ticker}`}>
              <rect x="0" y="-10" width={Math.max(0, chartRevealW)} height={CHART_H + 60} />
            </clipPath>
            <linearGradient id={`areaFill-${s.ticker}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={s.accentColor} stopOpacity="0.18" />
              <stop offset="100%" stopColor={s.accentColor} stopOpacity="0"    />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[70, 140, 210].map(y => (
            <line key={y} x1="0" y1={y} x2={CHART_W} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          ))}

          {/* Support line (green dashed) */}
          <line x1="0" y1={CHART_H * 0.82} x2={CHART_W} y2={CHART_H * 0.82}
            stroke={C.green} strokeWidth="2" strokeDasharray="12,8"
            opacity={suppOp} />

          {/* Resistance line (red dashed) */}
          <line x1="0" y1={CHART_H * 0.28} x2={CHART_W} y2={CHART_H * 0.28}
            stroke={C.red} strokeWidth="2" strokeDasharray="12,8"
            opacity={resOp} />

          {/* Entry zone shaded rect */}
          <rect x="0" y={CHART_H * 0.62} width={CHART_W} height={CHART_H * 0.22}
            fill={C.accent} opacity={0.10 * entryOp} />

          {/* Area fill under price line */}
          <path
            d={`${s.chartPath} L ${CHART_W},${CHART_H} L 0,${CHART_H} Z`}
            fill={`url(#areaFill-${s.ticker})`}
            clipPath={`url(#chartClip-${s.ticker})`}
          />

          {/* Price line */}
          <path
            d={s.chartPath}
            fill="none" stroke={C.white} strokeWidth="3.5"
            strokeLinecap="round" strokeLinejoin="round"
            clipPath={`url(#chartClip-${s.ticker})`}
          />

          {/* Dot at current price (right edge) */}
          {chartRevealW > CHART_W * 0.9 && (
            <circle cx={CHART_W} cy={CHART_H * 0.65} r="7"
              fill={s.accentColor} opacity={ip(frame - 120, [0, 16], [0, 1])} />
          )}

          {/* Labels */}
          <text x={CHART_W + 10} y={CHART_H * 0.82 + 5}
            fill={C.green} fontSize="22" fontFamily={DM} fontWeight="700" opacity={labelsOp}>
            SUPPORT {s.supportPrice}
          </text>
          <text x={CHART_W + 10} y={CHART_H * 0.28 + 5}
            fill={C.red} fontSize="22" fontFamily={DM} fontWeight="700" opacity={labelsOp}>
            RESISTANCE {s.resistPrice}
          </text>
          <text x={CHART_W + 10} y={CHART_H * 0.735}
            fill={C.accent} fontSize="22" fontFamily={DM} fontWeight="700" opacity={labelsOp}>
            ENTRY {s.entryZone}
          </text>
        </svg>
      </div>

      {/* Retest annotation */}
      <div style={{
        position: 'absolute', top: SAFE_T + 810, left: SAFE_X, right: SAFE_X,
        opacity: retestOp, transform: `translateY(${retestY}px)`,
        display: 'flex', alignItems: 'flex-start', gap: 16,
        backgroundColor: 'rgba(0,155,255,0.10)',
        border: `1px solid rgba(0,155,255,0.28)`,
        borderRadius: 18, padding: '20px 24px',
      }}>
        <span style={{ fontSize: 32, flexShrink: 0, marginTop: 2 }}>📍</span>
        <span style={{ fontSize: 32, fontWeight: 400, color: C.white, fontFamily: DM, lineHeight: 1.45 }}>
          Price is retesting a key support level — this is where bulls typically step in and defend.
        </span>
      </div>
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 4 — BULL CASE  (300 frames / 10 s)
// ══════════════════════════════════════════════════════════════════════════════

function SceneBullCase({ s }: { s: StockConfig }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const flashOp = ip(frame, [0, 16], [1, 0])
  const entryX  = ip(sp(fps, Math.max(0, frame - 5), { damping: 20, mass: 1.0, stiffness: 88 }), [0, 1], [VW, 0])
  const exitX   = ip(frame, [280, 299], [0, -VW])
  const slideX  = frame < 280 ? entryX : exitX

  const titleOp = ip(frame, [8, 26], [0, 1])

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, transform: `translateX(${slideX}px)` }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: '#FFFFFF', opacity: flashOp, pointerEvents: 'none' }} />
      <Glow color={C.green} op={0.15} />
      <Watermark />

      <div style={{ position: 'absolute', top: SAFE_T + 20, left: SAFE_X, right: SAFE_X, opacity: titleOp }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: C.green, fontFamily: DM, letterSpacing: '0.10em', textTransform: 'uppercase' as const }}>
          The Bull Case 🐂
        </div>
        <div style={{ fontSize: 60, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.15, marginTop: 6 }}>
          {s.bullTitle}
        </div>
      </div>

      <div style={{ position: 'absolute', top: SAFE_T + 270, left: SAFE_X, right: SAFE_X, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {s.bullPoints.map((pt, i) => {
          const st  = 24 + i * 18
          const op  = ip(frame, [st, st + 18], [0, 1])
          const txX = ip(sp(fps, Math.max(0, frame - st)), [0, 1], [-40, 0])
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 20,
              opacity: op, transform: `translateX(${txX}px)`,
              backgroundColor: C.greenBg,
              border: `1.5px solid ${C.green}44`,
              borderRadius: 16, padding: '20px 24px',
              borderLeft: `4px solid ${C.green}`,
            }}>
              <span style={{ color: C.green, fontSize: 30, flexShrink: 0, fontWeight: 700, marginTop: 2 }}>✓</span>
              <span style={{ fontSize: 34, fontWeight: 500, color: C.white, fontFamily: DM, lineHeight: 1.45 }}>{pt}</span>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 5 — KEY LEVELS  (270 frames / 9 s)
// ══════════════════════════════════════════════════════════════════════════════

function SceneKeyLevels({ s }: { s: StockConfig }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const entryX = ip(sp(fps, frame, { damping: 20, mass: 1.0, stiffness: 88 }), [0, 1], [VW, 0])
  const exitX  = ip(frame, [250, 269], [0, -VW])
  const slideX = frame < 250 ? entryX : exitX

  const titleOp = ip(frame, [8, 24], [0, 1])

  const levels = [
    { label: 'Stop Loss',   value: s.stop,    color: C.red,    bg: C.redBg,   start: 25 },
    { label: 'Support',     value: s.support,  color: C.green,  bg: C.greenBg, start: 38 },
    { label: 'Entry Zone',  value: s.entry,    color: C.accent, bg: C.blueBg,  start: 51 },
    { label: 'Target 1',    value: s.target1,  color: C.green,  bg: C.greenBg, start: 64 },
    { label: 'Target 2 🎯', value: s.target2,  color: C.gold,   bg: 'rgba(245,200,66,0.14)', start: 77 },
  ]

  // Upside callout
  const upsideOp = ip(frame, [130, 150], [0, 1])
  const upsideSp = sp(fps, Math.max(0, frame - 130))
  const upsideSc = ip(upsideSp, [0, 1], [0.8, 1])

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, transform: `translateX(${slideX}px)` }}>
      <Glow color={C.gold} w={600} h={400} op={0.14} />
      <Watermark />

      <div style={{ position: 'absolute', top: SAFE_T + 20, left: SAFE_X, right: SAFE_X, opacity: titleOp }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: C.accent, fontFamily: DM, letterSpacing: '0.10em', textTransform: 'uppercase' as const }}>
          {s.levelsTitle}
        </div>
        <div style={{ fontSize: 58, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.15, marginTop: 6 }}>
          Key Levels to Watch
        </div>
      </div>

      <div style={{ position: 'absolute', top: SAFE_T + 230, left: SAFE_X, right: SAFE_X, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {levels.map((lv) => {
          const op  = ip(frame, [lv.start, lv.start + 16], [0, 1])
          const txY = ip(sp(fps, Math.max(0, frame - lv.start)), [0, 1], [24, 0])
          return (
            <div key={lv.label} style={{ opacity: op, transform: `translateY(${txY}px)` }}>
              <StatPill label={lv.label} value={lv.value} color={lv.color} bg={lv.bg} />
            </div>
          )
        })}
      </div>

      {/* Upside callout */}
      <div style={{
        position: 'absolute', top: SAFE_T + 1060, left: SAFE_X, right: SAFE_X,
        textAlign: 'center',
        opacity: upsideOp, transform: `scale(${upsideSc})`,
      }}>
        <div style={{
          display: 'inline-block',
          background: `linear-gradient(135deg, ${C.green}22, ${C.gold}22)`,
          border: `1.5px solid ${C.gold}`,
          borderRadius: 50, padding: '18px 40px',
        }}>
          <span style={{ fontSize: 38, fontWeight: 800, color: C.gold, fontFamily: DM }}>
            {s.upside}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 6 — RISK  (180 frames / 6 s)
// ══════════════════════════════════════════════════════════════════════════════

function SceneRisk({ s }: { s: StockConfig }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const entryOp = ip(frame, [0, 22], [0, 1])
  const exitOp  = ip(frame, [158, 179], [1, 0])
  const sceneOp = frame < 158 ? entryOp : exitOp

  const titleOp = ip(frame, [12, 28], [0, 1])

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, opacity: sceneOp }}>
      <Glow color={C.red} w={500} h={400} op={0.12} />
      <Watermark />

      <div style={{ position: 'absolute', top: SAFE_T + 20, left: SAFE_X, right: SAFE_X, opacity: titleOp }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: C.red, fontFamily: DM, letterSpacing: '0.10em', textTransform: 'uppercase' as const }}>
          The Risk ⚠️
        </div>
        <div style={{ fontSize: 58, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.15, marginTop: 6 }}>
          {s.riskTitle}
        </div>
      </div>

      <div style={{ position: 'absolute', top: SAFE_T + 260, left: SAFE_X, right: SAFE_X, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {s.riskPoints.map((pt, i) => {
          const st  = 28 + i * 20
          const op  = ip(frame, [st, st + 18], [0, 1])
          const txX = ip(sp(fps, Math.max(0, frame - st)), [0, 1], [40, 0])
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 20,
              opacity: op, transform: `translateX(${txX}px)`,
              backgroundColor: C.redBg,
              border: `1.5px solid ${C.red}44`,
              borderRadius: 16, padding: '22px 24px',
              borderLeft: `4px solid ${C.red}`,
            }}>
              <span style={{ color: C.red, fontSize: 30, flexShrink: 0, fontWeight: 700, marginTop: 2 }}>✕</span>
              <span style={{ fontSize: 34, fontWeight: 500, color: C.white, fontFamily: DM, lineHeight: 1.45 }}>{pt}</span>
            </div>
          )
        })}
      </div>

      <div style={{
        position: 'absolute', bottom: SAFE_B + 90, left: SAFE_X, right: SAFE_X,
        textAlign: 'center', opacity: ip(frame, [120, 140], [0, 1]),
      }}>
        <span style={{ fontSize: 28, color: C.dimmer, fontFamily: DM }}>
          This is not financial advice. Always do your own research.
        </span>
      </div>
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 7 — CTA  (150 frames / 5 s)
// ══════════════════════════════════════════════════════════════════════════════

function SceneCTA() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const fadeIn   = ip(frame, [0, 18], [0, 1])
  const fadeOut  = ip(frame, [128, 149], [0, 1])
  const logoSp   = sp(fps, Math.max(0, frame - 14), { damping: 12, mass: 1.2, stiffness: 80 })
  const logoSc   = ip(logoSp, [0, 1], [0.4, 1])
  const floatY   = Math.sin(frame * 0.1) * 6
  const tagOp    = ip(frame, [38, 56], [0, 1])
  const tagY     = ip(sp(fps, Math.max(0, frame - 38)), [0, 1], [22, 0])
  const domSc    = 1 + Math.sin(Math.max(0, frame - 58) * 0.13) * 0.025
  const domOp    = ip(frame, [52, 68], [0, 1])
  const subOp    = ip(frame, [64, 80], [0, 1])

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, opacity: fadeIn }}>
      <Glow color={C.accent} w={600} h={600} op={0.20} />

      <div style={{
        position: 'absolute', top: SAFE_T + 320, left: '50%',
        transform: `translateX(-50%) translateY(${floatY}px) scale(${logoSc})`,
        opacity: ip(frame, [14, 32], [0, 1]),
      }}>
        <Img src={staticFile('logo.png')} style={{ width: 140, height: 140, objectFit: 'contain' }} />
      </div>

      <div style={{
        position: 'absolute', top: SAFE_T + 510, left: SAFE_X, right: SAFE_X,
        textAlign: 'center', opacity: tagOp, transform: `translateY(${tagY}px)`,
      }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.2 }}>
          Get signals like this daily.
        </div>
      </div>

      <div style={{
        position: 'absolute', top: SAFE_T + 630, left: SAFE_X, right: SAFE_X,
        textAlign: 'center', transform: `scale(${domSc})`, opacity: domOp,
      }}>
        <span style={{ fontSize: 64, fontWeight: 800, color: C.accent, fontFamily: DM, letterSpacing: '-0.01em' }}>
          holoture.com
        </span>
      </div>

      <div style={{
        position: 'absolute', top: SAFE_T + 730, left: SAFE_X, right: SAFE_X,
        textAlign: 'center', opacity: subOp,
      }}>
        <span style={{ fontSize: 32, color: C.muted, fontFamily: DM }}>
          Free to start. No credit card required.
        </span>
      </div>

      <div style={{
        position: 'absolute', inset: 0, backgroundColor: C.bg,
        opacity: fadeOut, pointerEvents: 'none',
      }} />
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE COMPOSITOR
// ══════════════════════════════════════════════════════════════════════════════

function StockReelTemplate({ stock }: { stock: StockConfig }) {
  return (
    <>
      <Sequence from={0}    durationInFrames={180}><SceneHook      s={stock} /></Sequence>
      <Sequence from={180}  durationInFrames={270}><SceneWhatIsIt  s={stock} /></Sequence>
      <Sequence from={450}  durationInFrames={360}><SceneSetup     s={stock} /></Sequence>
      <Sequence from={810}  durationInFrames={300}><SceneBullCase  s={stock} /></Sequence>
      <Sequence from={1110} durationInFrames={270}><SceneKeyLevels s={stock} /></Sequence>
      <Sequence from={1380} durationInFrames={180}><SceneRisk      s={stock} /></Sequence>
      <Sequence from={1560} durationInFrames={150}><SceneCTA /></Sequence>
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// STOCK CONFIGS  (June 2026 setups)
// ══════════════════════════════════════════════════════════════════════════════

// ── QS — QuantumScape ────────────────────────────────────────────────────────
// Bottoming at multi-year support; solid-state battery milestone achieved
const QS_CONFIG: StockConfig = {
  ticker: 'QS', companyName: 'QuantumScape Corporation',
  accentColor: '#009BFF',

  hookHeadline: 'Solid-State Batteries Just Hit A Major Milestone.',
  hookStat: '+78%',
  hookStatLabel: 'Potential upside to first target',
  hookSub: 'And the stock is still sitting at multi-year lows. Here\'s what the chart is saying.',

  whatTitle: 'What Is QuantumScape?',
  whatPoints: [
    { icon: '🔋', title: 'Next-Gen Battery Tech', body: 'Solid-state lithium-metal batteries — no liquid electrolyte, faster charging, higher energy density, and no fire risk' },
    { icon: '🚗', title: 'Backed by Volkswagen', body: 'VW invested $300M+ and holds a commercial licensing agreement — technology risk is partially de-risked' },
    { icon: '📅', title: 'Commercialization Window', body: 'First commercial cells are targeting vehicle integration in 2026–2027 — the inflection point is near' },
  ],

  setupHeadline: 'Compressing at Multi-Year Support',
  setupBody: 'QS has been in a brutal downtrend since its SPAC highs, but price is now coiling tightly at a zone that has held three times. Declining volume on red candles suggests exhaustion.',
  chartPath: 'M 0,40 C 80,60 180,120 280,190 C 360,245 420,268 500,272 C 580,276 640,268 700,260 C 780,250 850,248 900,242',
  supportPrice: '$4.80',
  resistPrice: '$7.20',
  entryZone: '$4.80–$5.50',

  bullTitle: 'Why We\'re Watching This Closely',
  bullPoints: [
    'Retesting a key support level for the third time — triple bottom is a high-conviction reversal signal',
    'VW commercial milestone de-risks the core technology concern that has weighed on the stock',
    'Solid-state battery patents are a permanent moat — no one is catching up quickly',
    'Small float means any institutional accumulation moves the stock significantly',
  ],

  levelsTitle: '${QS} Price Map',
  support: '$4.80',
  entry: '$4.80 – $5.50',
  target1: '$7.20 (+31%)',
  target2: '$8.50 (+55%)',
  stop: '$4.20',
  upside: 'Up to +78% to full target',

  riskTitle: 'Eyes Open on the Risks',
  riskPoints: [
    'Cash burn is significant — watch the balance sheet for dilution events before they happen',
    'Commercialization has been delayed before — timing risk is real and the market has no patience for misses',
    'Macro risk: if rates spike, long-duration growth names like QS get hit hardest and fastest',
  ],
}

// ── SERV — Serve Robotics ────────────────────────────────────────────────────
// Breakout, pulling back to retest breakout level as new support
const SERV_CONFIG: StockConfig = {
  ticker: 'SERV', companyName: 'Serve Robotics Inc.',
  accentColor: '#1D9E75',

  hookHeadline: 'NVIDIA Just Bet Big On This Sidewalk Robot Stock.',
  hookStat: '+50%',
  hookStatLabel: 'Upside to next resistance level',
  hookSub: 'Autonomous delivery robots are hitting the streets. The chart is pulling back to the perfect entry.',

  whatTitle: 'What Is Serve Robotics?',
  whatPoints: [
    { icon: '🤖', title: 'Autonomous Delivery Robots', body: 'Sidewalk robots that deliver food and packages in real cities — spun out of Uber Eats with an existing deployment network' },
    { icon: '💚', title: 'NVIDIA-Backed Platform', body: 'NVIDIA took a direct stake and provides Jetson compute platforms — the AI behind the wheels is best-in-class' },
    { icon: '📦', title: 'Scaling Fast', body: 'Partnership with Uber Eats and 7-Eleven; deploying in LA, Dallas, and Vancouver with dozens more cities approved' },
  ],

  setupHeadline: 'Retesting the Breakout Zone',
  setupBody: 'SERV broke out of a multi-month base on the NVIDIA investment news. It has since pulled back to retest that breakout level — classic bull behavior. Previous resistance is now acting as support.',
  chartPath: 'M 0,240 C 80,215 180,170 280,110 C 360,60 420,28 480,22 C 540,18 580,32 640,65 C 720,110 800,145 900,148',
  supportPrice: '$17.50',
  resistPrice: '$24.00',
  entryZone: '$17.50–$20.00',

  bullTitle: 'The Setup Makes Sense Fundamentally',
  bullPoints: [
    'NVIDIA doesn\'t invest in companies without conviction — this is both a vote of confidence and a distribution partnership',
    'Retesting the breakout zone as support — this is the highest probability entry point in the entire move',
    'Autonomous delivery is still early innings; Serve has first-mover advantage in sidewalk robotics',
    'Uber Eats integration gives built-in demand without needing to build a marketplace from scratch',
  ],

  levelsTitle: '${SERV} Price Map',
  support: '$17.50',
  entry: '$17.50 – $20.00',
  target1: '$26.00 (+30%)',
  target2: '$30.00 (+50%)',
  stop: '$15.00',
  upside: 'Up to +50% to full target',

  riskTitle: 'Risks Worth Tracking',
  riskPoints: [
    'Robotics deployment is capital-intensive — watch quarterly burn rate and cash runway closely',
    'If SERV loses the Uber Eats contract or NVIDIA support fades, the thesis breaks quickly',
    'Regulatory risk: cities can restrict or ban sidewalk robots with relatively little notice',
  ],
}

// ── MSFT — Microsoft ─────────────────────────────────────────────────────────
// Bull flag consolidation above key support; AI monetization accelerating
const MSFT_CONFIG: StockConfig = {
  ticker: 'MSFT', companyName: 'Microsoft Corporation',
  accentColor: '#00B4D8',

  hookHeadline: 'One Company Controls The Entire AI Stack.',
  hookStat: '$495',
  hookStatLabel: 'Our 12-month price target',
  hookSub: 'Azure. Copilot. OpenAI. And the stock is consolidating right at support. Here\'s the setup.',

  whatTitle: 'Why MSFT Is Different',
  whatPoints: [
    { icon: '☁️', title: 'Azure AI Is Compounding', body: 'Azure AI revenue is growing 40%+ YoY — enterprises are locking in multi-year cloud AI contracts at scale' },
    { icon: '🤖', title: 'Copilot Printing Money', body: '$30/seat/month Copilot subscriptions are rolling out across Office 365\'s 400M+ user base — mostly pure margin' },
    { icon: '🔗', title: 'OpenAI Moat', body: '$13B invested in OpenAI gives Microsoft exclusive API rights and first access to every frontier model release' },
  ],

  setupHeadline: 'Bull Flag on Key Support',
  setupBody: 'MSFT pulled back from all-time highs and is now coiling tightly above a critical support zone at the 50-week moving average. Declining volume on the pullback suggests this is consolidation, not distribution.',
  chartPath: 'M 0,220 C 100,190 200,140 320,85 C 400,50 440,40 490,48 C 560,62 640,75 710,72 C 790,68 850,70 900,68',
  supportPrice: '$415',
  resistPrice: '$450',
  entryZone: '$415–$430',

  bullTitle: 'The AI Monetization Machine',
  bullPoints: [
    'Azure AI is the fastest-growing hyperscaler segment — enterprise lock-in is deepening every quarter',
    'Copilot has barely scratched the surface of its 400M+ addressable user base — the revenue flywheel is just starting',
    'Microsoft controls the picks and shovels of AI: compute, models, and distribution in one package',
    'Pullback to support with declining volume = textbook accumulation pattern before the next leg up',
  ],

  levelsTitle: '${MSFT} Price Map',
  support: '$415',
  entry: '$415 – $430',
  target1: '$465 (+8%)',
  target2: '$495 (+15%)',
  stop: '$398',
  upside: 'Up to +15% with defined stop',

  riskTitle: 'The Bearish Scenarios',
  riskPoints: [
    'If Copilot adoption stalls or enterprises push back on AI pricing, the premium multiple gets questioned fast',
    'OpenAI competition (Anthropic, Google DeepMind) could commoditize AI APIs and compress margins',
    'MSFT is a mega-cap — outperformance requires a genuine re-rating, not just market participation',
  ],
}

// ── PLTR — Palantir ──────────────────────────────────────────────────────────
// Corrected 20% YTD, retesting major support confluence zone
const PLTR_CONFIG: StockConfig = {
  ticker: 'PLTR', companyName: 'Palantir Technologies',
  accentColor: '#009BFF',

  hookHeadline: 'This AI Stock Just Dropped 20% In 2026. Dip Or Trap?',
  hookStat: '-19%',
  hookStatLabel: 'YTD — while the S&P 500 is up 5.7%',
  hookSub: 'The chart is at a major confluence support. Here\'s why we think the flush is nearly done.',

  whatTitle: 'What Does Palantir Actually Do?',
  whatPoints: [
    { icon: '🏛️', title: 'Government AI Contracts', body: 'Powers mission-critical intelligence operations for the US Army, NSA, CIA, and NATO allies — not a commodity vendor' },
    { icon: '🏢', title: 'Enterprise AIP Platform', body: 'Artificial Intelligence Platform (AIP) bootcamps are converting enterprise pilots to paid contracts at an accelerating rate' },
    { icon: '🔐', title: 'Impossible to Replace', body: 'Data infrastructure is so deeply embedded that switching costs are effectively infinite for most government clients' },
  ],

  setupHeadline: 'Retesting Major Confluence Support',
  setupBody: 'PLTR\'s 20% YTD correction has brought it back to a critical zone where the 200-day moving average meets a prior breakout level. This is the same level that launched the last 80% rally. Bulls need to hold here.',
  chartPath: 'M 0,48 C 80,40 180,38 280,45 C 360,52 410,48 470,42 C 540,35 590,32 640,55 C 720,100 800,175 900,238',
  supportPrice: '$88',
  resistPrice: '$108',
  entryZone: '$88–$97',

  bullTitle: 'Why This Dip Has Our Attention',
  bullPoints: [
    'AIP bootcamp conversions are accelerating — Q1 2026 showed commercial revenue growing 27% YoY, not slowing',
    'Retesting the exact level that launched the last major rally — institutional memory is strong here',
    'US defense spending on AI is a secular trend; PLTR has a 20-year head start on every competitor',
    'CEO Alex Karp has been aggressively buying the dip personally — that\'s meaningful insider conviction',
  ],

  levelsTitle: '${PLTR} Price Map',
  support: '$88',
  entry: '$88 – $97',
  target1: '$115 (+19%)',
  target2: '$135 (+39%)',
  stop: '$80',
  upside: 'Up to +39% to full target',

  riskTitle: 'Why Some Are Nervous',
  riskPoints: [
    'Valuation remains rich even after the correction — 25× revenue requires flawless execution',
    'Government contract wins can be lumpy and subject to budget cycles outside Palantir\'s control',
    'If the $88 support level breaks cleanly, the next meaningful floor is around $72 — risk is real',
  ],
}

// ── HOOD — Robinhood ─────────────────────────────────────────────────────────
// PDT rule eliminated June 4, 2026 — direct volume and revenue beneficiary
const HOOD_CONFIG: StockConfig = {
  ticker: 'HOOD', companyName: 'Robinhood Markets Inc.',
  accentColor: '#1D9E75',

  hookHeadline: 'The PDT Rule Is Dead. One Stock Wins The Most.',
  hookStat: '$55',
  hookStatLabel: 'Our 12-month price target',
  hookSub: 'The SEC just eliminated the $25,000 day trading rule. Robinhood is the biggest direct beneficiary. Here\'s why.',

  whatTitle: 'Why HOOD Wins From PDT Elimination',
  whatPoints: [
    { icon: '📱', title: 'The Retail Trading App', body: '24M+ funded accounts, options trading already growing 40%+ YoY — PDT elimination unlocks millions of new active traders' },
    { icon: '💰', title: 'Revenue Tied To Volume', body: 'Robinhood earns payment for order flow and margin interest — both scale directly with more active day trading sessions' },
    { icon: '⚡', title: 'Options Are The Engine', body: 'Options notional traded grew 74% in Q4 2025 — day traders love options, and now there\'s no $25K barrier to entry' },
  ],

  setupHeadline: 'Breaking Out On Catalytic News',
  setupBody: 'HOOD was in a multi-week base before the PDT announcement. The stock gapped up on the news and is now consolidating the initial move. The base before the breakout is the ideal retest entry.',
  chartPath: 'M 0,230 C 100,225 200,215 320,205 C 400,198 440,192 480,188 C 560,178 620,165 680,120 C 760,70 840,28 900,18',
  supportPrice: '$35',
  resistPrice: '$42',
  entryZone: '$35–$39',

  bullTitle: 'The PDT Elimination Thesis',
  bullPoints: [
    'Every retail trader who was blocked by the $25K rule is now a potential active day trader — Robinhood is their default app',
    'More trading activity = more PFOF, more margin usage, more Robinhood Gold subscriptions — every revenue line benefits',
    'Crypto is also recovering in 2026 — HOOD\'s crypto trading segment provides additional upside optionality',
    'The breakout from a multi-week base on massive volume is a technically clean setup — momentum is with the bulls',
  ],

  levelsTitle: '${HOOD} Price Map',
  support: '$35',
  entry: '$35 – $39',
  target1: '$45 (+15%)',
  target2: '$55 (+41%)',
  stop: '$30',
  upside: 'Up to +41% to full target',

  riskTitle: 'Not Without Risk',
  riskPoints: [
    'Retail trading volumes are cyclical — a risk-off market environment would compress HOOD\'s revenue quickly',
    'PDT elimination may draw stricter scrutiny of PFOF practices, which is Robinhood\'s core business model',
    'The initial news pop may already be priced in — patient entry below $38 matters more than chasing',
  ],
}

// ══════════════════════════════════════════════════════════════════════════════
// NAMED EXPORTS  (registered in Root.tsx as individual Compositions)
// ══════════════════════════════════════════════════════════════════════════════

export const QSReel:   React.FC = () => <StockReelTemplate stock={QS_CONFIG}   />
export const SERVReel: React.FC = () => <StockReelTemplate stock={SERV_CONFIG} />
export const MSFTReel: React.FC = () => <StockReelTemplate stock={MSFT_CONFIG} />
export const PLTRReel: React.FC = () => <StockReelTemplate stock={PLTR_CONFIG} />
export const HOODReel: React.FC = () => <StockReelTemplate stock={HOOD_CONFIG} />
