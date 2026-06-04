/**
 * MRVLExplainer — 60 s vertical explainer (1080 × 1920, 30 fps)
 * Jensen Huang's MRVL $1 trillion market-cap prediction
 *
 * Scene timeline (frames @ 30 fps):
 *  S1   0–149    Hook              5 s
 *  S2  150–389   Who Said It       8 s
 *  S3  390–689   What Is Marvell  10 s
 *  S4  690–1049  The Stock Move   12 s
 *  S5 1050–1439  Simple Math      13 s
 *  S6 1440–1649  The Catch         7 s
 *  S7 1650–1799  CTA               5 s
 *
 * Safe zones: top ≥ 150 px, bottom ≤ 1750 px, sides ≥ 60 px
 * Min font: headline 56 px, body 36 px, label 28 px
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
  bg:     '#0F0F0F',
  accent: '#009BFF',
  green:  '#1D9E75',
  red:    '#E24B4A',
  gold:   '#F5C842',
  white:  '#FFFFFF',
  muted:  'rgba(255,255,255,0.50)',
  dimmer: 'rgba(255,255,255,0.30)',
  greenBg: 'rgba(29,158,117,0.15)',
  redBg:   'rgba(226,75,74,0.15)',
  blueBg:  'rgba(0,155,255,0.15)',
} as const

// ── Layout ─────────────────────────────────────────────────────────────────────
const VW    = 1080
const VH    = 1920
const SAFE_T = 150
const SAFE_B = 170
const SAFE_X = 60
const CW     = VW - SAFE_X * 2   // 960 px usable width

// ── Animation helpers ──────────────────────────────────────────────────────────
const EO = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ip = (f: number, inp: number[], out: number[]) => interpolate(f, inp, out, EO)
const sc = { damping: 15, mass: 1.2, stiffness: 100 }  // default spring cfg
const sp = (fps: number, f: number, cfg: Record<string,number> = sc) =>
  spring({ fps, frame: Math.max(0, f), config: cfg })

// ── Watermark (bottom-right, gentle float, every scene except S1) ─────────────
function Watermark() {
  const frame = useCurrentFrame()
  const floatY = Math.sin(frame * 0.05) * 5
  return (
    <div style={{
      position: 'absolute',
      bottom: SAFE_B + 12,
      right: SAFE_X,
      transform: `translateY(${floatY}px)`,
      opacity: 0.55,
    }}>
      <Img src={staticFile('logo.png')} style={{ width: 50, height: 50, objectFit: 'contain' }} />
    </div>
  )
}

// ── Radial glow helper ────────────────────────────────────────────────────────
function Glow({ color = C.accent, w = 700, h = 500, opacity = 0.25 }: {
  color?: string; w?: number; h?: number; opacity?: number
}) {
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '45%',
      transform: 'translate(-50%,-50%)',
      width: w, height: h,
      background: `radial-gradient(ellipse, ${color} 0%, transparent 68%)`,
      opacity,
      pointerEvents: 'none',
    }} />
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 1 — HOOK (150 frames / 5 s)
// ══════════════════════════════════════════════════════════════════════════════

const TRILLION_STR = '$1,000,000,000,000'

function SceneHook() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Question slams in from 2× scale
  const qSp    = sp(fps, frame, { damping: 14, mass: 1.1, stiffness: 120 })
  const qScale = ip(qSp, [0, 1], [2, 1])
  const qOp    = ip(frame, [0, 8], [0, 1])

  // Number chars appear one-by-one starting at frame 22, 3 frames each
  const CHAR_START = 22
  const CHAR_RATE  = 3
  const visibleChars = Math.min(
    TRILLION_STR.length,
    Math.max(0, Math.floor((frame - CHAR_START) / CHAR_RATE))
  )

  // "That's one trillion dollars." fades in after number completes
  const taglineStart = CHAR_START + TRILLION_STR.length * CHAR_RATE + 4
  const tagOp = ip(frame, [taglineStart, taglineStart + 16], [0, 1])

  // Glow pulse
  const glowOp = 0.22 + Math.sin(frame * 0.15) * 0.10

  // Exit — slide up in last 15 frames
  const exitY = ip(frame, [135, 149], [0, -VH])

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, transform: `translateY(${exitY}px)` }}>
      <Glow color={C.accent} w={800} h={600} opacity={glowOp} />

      <div style={{
        position: 'absolute',
        top: SAFE_T + 280,
        left: SAFE_X, right: SAFE_X,
        textAlign: 'center',
        transform: `scale(${qScale})`,
        opacity: qOp,
      }}>
        <div style={{
          fontSize: 60, fontWeight: 800, color: C.white,
          fontFamily: DM, lineHeight: 1.18,
        }}>
          What if someone just told you<br />a stock was going to be worth
        </div>
      </div>

      {/* Trillion number — character by character */}
      <div style={{
        position: 'absolute',
        top: SAFE_T + 620,
        left: SAFE_X, right: SAFE_X,
        textAlign: 'center',
      }}>
        <span style={{
          fontSize: 96, fontWeight: 800, color: C.accent,
          fontFamily: DM, letterSpacing: '-0.02em',
        }}>
          {TRILLION_STR.slice(0, visibleChars)}
        </span>
      </div>

      {/* Tagline */}
      <div style={{
        position: 'absolute',
        top: SAFE_T + 750,
        left: SAFE_X, right: SAFE_X,
        textAlign: 'center',
        opacity: tagOp,
      }}>
        <span style={{ fontSize: 40, fontWeight: 400, color: C.muted, fontFamily: DM }}>
          That's one trillion dollars.
        </span>
      </div>
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 2 — WHO SAID IT (240 frames / 8 s)
// ══════════════════════════════════════════════════════════════════════════════

function SceneWhoSaidIt() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Entry — slide up from bottom
  const entryY = ip(sp(fps, frame, { damping: 20, mass: 1.1, stiffness: 90 }), [0,1], [VH, 0])

  const headSp = sp(fps, frame - 8)
  const headY  = ip(headSp, [0, 1], [40, 0])
  const headOp = ip(frame, [8, 24], [0, 1])

  const circleSp = sp(fps, Math.max(0, frame - 28), { damping: 14, mass: 1.3, stiffness: 80 })
  const circleScale = ip(circleSp, [0,1], [0, 1])
  const circleOp    = ip(frame, [28, 46], [0, 1])

  const nameSp = sp(fps, Math.max(0, frame - 55))
  const nameY  = ip(nameSp, [0,1], [30, 0])
  const nameOp = ip(frame, [55, 72], [0, 1])

  const quoteSp = sp(fps, Math.max(0, frame - 75))
  const quoteY  = ip(quoteSp, [0,1], [30, 0])
  const quoteOp = ip(frame, [75, 95], [0, 1])

  // Exit slide left
  const exitX = ip(frame, [220, 239], [0, -VW])

  return (
    <AbsoluteFill style={{
      backgroundColor: C.bg,
      transform: `translateX(${exitX}px) translateY(${entryY}px)`,
    }}>
      <Glow color={C.accent} w={600} h={400} opacity={0.18} />
      <Watermark />

      {/* Headline */}
      <div style={{
        position: 'absolute',
        top: SAFE_T + 40,
        left: SAFE_X, right: SAFE_X,
        opacity: headOp,
        transform: `translateY(${headY}px)`,
      }}>
        <div style={{ fontSize: 56, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.2 }}>
          The CEO of the biggest<br />company on Earth just said this.
        </div>
      </div>

      {/* NVIDIA circle */}
      <div style={{
        position: 'absolute',
        top: SAFE_T + 320,
        left: '50%', transform: `translateX(-50%) scale(${circleScale})`,
        opacity: circleOp,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 200, height: 200, borderRadius: '50%',
          backgroundColor: 'rgba(29,158,117,0.18)',
          border: `3px solid ${C.green}`,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 42, fontWeight: 800, color: C.green, fontFamily: DM }}>NVIDIA</span>
          <span style={{ fontSize: 30, fontWeight: 700, color: C.gold, fontFamily: DM }}>$5 TRILLION</span>
        </div>
        <span style={{ fontSize: 28, color: C.muted, fontFamily: DM, textAlign: 'center' }}>
          Largest company in the world<br />by market value
        </span>
      </div>

      {/* Jensen name */}
      <div style={{
        position: 'absolute',
        top: SAFE_T + 620,
        left: SAFE_X, right: SAFE_X,
        opacity: nameOp, transform: `translateY(${nameY}px)`,
      }}>
        <div style={{ fontSize: 38, fontWeight: 700, color: C.white, fontFamily: DM }}>
          Jensen Huang, CEO of NVIDIA:
        </div>
      </div>

      {/* Quote */}
      <div style={{
        position: 'absolute',
        top: SAFE_T + 690,
        left: SAFE_X, right: SAFE_X,
        opacity: quoteOp, transform: `translateY(${quoteY}px)`,
      }}>
        <div style={{
          borderLeft: `4px solid ${C.accent}`,
          paddingLeft: 24,
        }}>
          <div style={{
            fontSize: 44, fontWeight: 400, fontStyle: 'italic',
            color: C.accent, fontFamily: DM, lineHeight: 1.45,
          }}>
            "Marvell Technology will eventually reach a trillion-dollar market cap."
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 3 — WHAT IS MARVELL (300 frames / 10 s)
// ══════════════════════════════════════════════════════════════════════════════

function ChipIcon({ color = C.accent }: { color?: string }) {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <rect x="18" y="18" width="36" height="36" stroke={color} strokeWidth="3" fill="none" rx="4"/>
      {/* Pins left */}
      <line x1="0" y1="28" x2="18" y2="28" stroke={color} strokeWidth="2.5"/>
      <line x1="0" y1="36" x2="18" y2="36" stroke={color} strokeWidth="2.5"/>
      <line x1="0" y1="44" x2="18" y2="44" stroke={color} strokeWidth="2.5"/>
      {/* Pins right */}
      <line x1="54" y1="28" x2="72" y2="28" stroke={color} strokeWidth="2.5"/>
      <line x1="54" y1="36" x2="72" y2="36" stroke={color} strokeWidth="2.5"/>
      <line x1="54" y1="44" x2="72" y2="44" stroke={color} strokeWidth="2.5"/>
      {/* Pins top */}
      <line x1="28" y1="0" x2="28" y2="18" stroke={color} strokeWidth="2.5"/>
      <line x1="36" y1="0" x2="36" y2="18" stroke={color} strokeWidth="2.5"/>
      <line x1="44" y1="0" x2="44" y2="18" stroke={color} strokeWidth="2.5"/>
      {/* Core */}
      <rect x="26" y="26" width="20" height="20" fill={color} opacity="0.6" rx="2"/>
      <circle cx="36" cy="36" r="5" fill={color}/>
    </svg>
  )
}

function DataCenterIcon({ color = C.accent }: { color?: string }) {
  return (
    <svg width="80" height="64" viewBox="0 0 80 64">
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i}
          x={(i % 3) * 26 + 1} y={Math.floor(i / 3) * 30 + 2}
          width="22" height="24" rx="3"
          fill={color} opacity={0.5 + (i % 3) * 0.15}
        />
      ))}
      {/* Rack lines */}
      {Array.from({ length: 6 }, (_, i) => (
        <line key={`l${i}`}
          x1={(i % 3) * 26 + 4} y1={Math.floor(i / 3) * 30 + 12}
          x2={(i % 3) * 26 + 20} y2={Math.floor(i / 3) * 30 + 12}
          stroke="#0F0F0F" strokeWidth="1.5"
        />
      ))}
    </svg>
  )
}

function CloudIcon({ color = C.accent }: { color?: string }) {
  return (
    <svg width="84" height="60" viewBox="0 0 84 60">
      <ellipse cx="42" cy="44" rx="38" ry="16" fill={color} opacity="0.7"/>
      <circle cx="28" cy="34" r="16" fill={color} opacity="0.7"/>
      <circle cx="52" cy="28" r="20" fill={color} opacity="0.7"/>
      <circle cx="34" cy="26" r="14" fill={color} opacity="0.7"/>
    </svg>
  )
}

function Arrow() {
  return (
    <svg width="48" height="32" viewBox="0 0 48 32">
      <line x1="0" y1="16" x2="40" y2="16" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5"/>
      <polyline points="32,6 44,16 32,26" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" fill="none"/>
    </svg>
  )
}

function SceneWhatIsMarvell() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Entry slide from right
  const entryX = ip(sp(fps, frame, { damping: 20, mass: 1.0, stiffness: 95 }), [0,1], [VW, 0])

  const titleOp = ip(frame, [6, 22], [0, 1])
  const titleY  = ip(frame, [6, 22], [18, 0])

  // Step 1: chip — frame 20
  const s1Op = ip(frame, [20, 38], [0, 1])
  const s1Y  = ip(sp(fps, Math.max(0, frame-20)), [0,1], [40,0])

  // Step 2: data center — frame 80
  const s2Op = ip(frame, [80, 98], [0, 1])
  const s2Y  = ip(sp(fps, Math.max(0, frame-80)), [0,1], [40,0])

  // Step 3: cloud/AI — frame 145
  const s3Op = ip(frame, [145, 163], [0, 1])
  const s3Y  = ip(sp(fps, Math.max(0, frame-145)), [0,1], [40,0])

  // Exit
  const exitX = ip(frame, [280, 299], [0, -VW])

  const rowStyle = (op: number, y: number): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 24,
    opacity: op, transform: `translateY(${y}px)`,
    marginBottom: 0,
  })

  return (
    <AbsoluteFill style={{
      backgroundColor: C.bg,
      transform: `translateX(${Math.max(entryX, exitX === 0 ? entryX : exitX)}px)`,
    }}>
      {/* Use proper combined transform */}
      <AbsoluteFill style={{
        transform: `translateX(${frame < 280 ? entryX : exitX}px)`,
      }}>
        <Glow color={C.accent} opacity={0.14} />
        <Watermark />

        {/* Title */}
        <div style={{
          position: 'absolute', top: SAFE_T + 20, left: SAFE_X, right: SAFE_X,
          opacity: titleOp, transform: `translateY(${titleY}px)`,
        }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: C.accent, fontFamily: DM, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
            But first —
          </span>
          <div style={{ fontSize: 56, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.2, marginTop: 8 }}>
            What is Marvell Technology?
          </div>
        </div>

        {/* Step 1 — Chip */}
        <div style={{ position: 'absolute', top: SAFE_T + 260, left: SAFE_X, right: SAFE_X, ...rowStyle(s1Op, s1Y) }}>
          <div style={{ width: 96, height: 96, borderRadius: 20, backgroundColor: C.blueBg, border: `2px solid ${C.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ChipIcon />
          </div>
          <div>
            <div style={{ fontSize: 52, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.15 }}>Marvell makes<br />computer chips</div>
            <div style={{ fontSize: 36, color: C.muted, fontFamily: DM, marginTop: 6 }}>The tiny parts that make AI work</div>
          </div>
        </div>

        {/* Arrow 1 */}
        {s2Op > 0.1 && (
          <div style={{ position: 'absolute', top: SAFE_T + 490, left: SAFE_X + 160, opacity: s2Op }}>
            <Arrow />
          </div>
        )}

        {/* Step 2 — Data Center */}
        <div style={{ position: 'absolute', top: SAFE_T + 540, left: SAFE_X, right: SAFE_X, ...rowStyle(s2Op, s2Y) }}>
          <div style={{ width: 96, height: 96, borderRadius: 20, backgroundColor: 'rgba(245,200,66,0.12)', border: `2px solid ${C.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <DataCenterIcon color={C.gold} />
          </div>
          <div>
            <div style={{ fontSize: 48, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.15 }}>Used inside massive<br />AI data centers</div>
          </div>
        </div>

        {/* Arrow 2 */}
        {s3Op > 0.1 && (
          <div style={{ position: 'absolute', top: SAFE_T + 760, left: SAFE_X + 160, opacity: s3Op }}>
            <Arrow />
          </div>
        )}

        {/* Step 3 — Cloud/AI */}
        <div style={{ position: 'absolute', top: SAFE_T + 810, left: SAFE_X, right: SAFE_X, ...rowStyle(s3Op, s3Y) }}>
          <div style={{ width: 96, height: 96, borderRadius: 20, backgroundColor: 'rgba(29,158,117,0.12)', border: `2px solid ${C.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CloudIcon color={C.green} />
          </div>
          <div>
            <div style={{ fontSize: 40, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.2 }}>Every time you use AI —<br />Marvell chips are involved</div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 4 — THE STOCK MOVE (360 frames / 12 s)
// ══════════════════════════════════════════════════════════════════════════════

// Pre-computed particle positions (deterministic)
const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  x:     -60 + i * 10 + (i % 3) * 8,
  delay: i * 2,
  speed: 2.5 + (i % 5) * 0.6,
  size:  4 + (i % 3) * 3,
}))

function SceneStockMove() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Flash entry: white → dark over first 18 frames
  const flashOp = ip(frame, [0, 18], [1, 0])

  const titleOp = ip(frame, [14, 30], [0, 1])
  const titleY  = ip(frame, [14, 30], [18, 0])

  // Bars appear at frame 38
  const leftOp  = ip(frame, [38, 54], [0, 1])
  const leftY   = ip(sp(fps, Math.max(0, frame - 38)), [0,1], [30, 0])

  // Right bar grows from 0 over 45 frames starting at frame 60
  const BAR_START  = 60
  const BAR_DUR    = 45
  const MAX_RIGHT  = 450   // px
  const MIN_LEFT   = 200   // px
  const rightH = ip(frame - BAR_START, [0, BAR_DUR], [0, MAX_RIGHT])
  const rightOp = ip(frame, [58, 74], [0, 1])

  // Particles fire when bar reaches peak (~frame 105+)
  const PEAK_FRAME = BAR_START + BAR_DUR

  // Stat pills — staggered at frame 120, 124, 128 (150 ms = 4.5 frames apart → use 5)
  const pills = [
    { label: '📈  +32.5% yesterday', bg: C.greenBg, border: C.green, start: 120 },
    { label: '📈  +5.5% today',      bg: C.greenBg, border: C.green, start: 125 },
    { label: '💰  Now worth $268B',  bg: C.blueBg,  border: C.accent, start: 130 },
  ]

  // Exit
  const exitX = ip(frame, [340, 359], [0, -VW])

  const BAR_BOTTOM = SAFE_T + 980   // y-coordinate of bar bases
  const BAR_W      = 360

  return (
    <AbsoluteFill style={{
      backgroundColor: C.bg,
      transform: `translateX(${exitX}px)`,
    }}>
      {/* White flash */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: '#FFFFFF', opacity: flashOp, pointerEvents: 'none' }} />

      <Glow color={C.green} opacity={0.14} />
      <Watermark />

      {/* Title */}
      <div style={{
        position: 'absolute', top: SAFE_T + 20, left: SAFE_X, right: SAFE_X,
        opacity: titleOp, transform: `translateY(${titleY}px)`,
      }}>
        <span style={{ fontSize: 32, fontWeight: 700, color: C.accent, fontFamily: DM, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Here's what happened</span>
        <div style={{ fontSize: 56, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.2, marginTop: 6 }}>
          to the stock
        </div>
      </div>

      {/* ── BAR CHART ── */}

      {/* Left bar (Before) */}
      <div style={{
        position: 'absolute',
        left: SAFE_X + 40,
        bottom: VH - BAR_BOTTOM,
        opacity: leftOp,
        transform: `translateY(${leftY}px)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}>
        <div style={{ fontSize: 30, fontWeight: 700, color: 'rgba(255,255,255,0.7)', fontFamily: DM }}>$268B</div>
        <div style={{
          width: BAR_W, height: MIN_LEFT,
          backgroundColor: 'rgba(255,255,255,0.18)',
          borderRadius: '12px 12px 0 0',
        }} />
        <div style={{ fontSize: 28, color: C.muted, fontFamily: DM, textAlign: 'center', maxWidth: BAR_W }}>
          Before Jensen spoke
        </div>
      </div>

      {/* Right bar (After) */}
      <div style={{
        position: 'absolute',
        right: SAFE_X + 40,
        bottom: VH - BAR_BOTTOM,
        opacity: rightOp,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}>
        {/* Particles */}
        {frame >= PEAK_FRAME - 5 && PARTICLES.map((p, i) => {
          const pf = Math.max(0, frame - PEAK_FRAME - p.delay)
          const pY  = ip(pf, [0, 40], [0, p.speed * 40])
          const pOp = ip(pf, [0, 4, 30, 42], [0, 0.9, 0.7, 0])
          return (
            <div key={i} style={{
              position: 'absolute',
              bottom: MAX_RIGHT + 10,
              left: BAR_W / 2 + p.x - p.size / 2,
              width: p.size, height: p.size, borderRadius: '50%',
              backgroundColor: C.gold,
              transform: `translateY(${-pY}px)`,
              opacity: pOp,
              pointerEvents: 'none',
            }} />
          )
        })}

        <div style={{ fontSize: 34, fontWeight: 800, color: C.green, fontFamily: DM }}>
          +32.5%<br />
          <span style={{ fontSize: 24, fontWeight: 400 }}>in ONE day</span>
        </div>
        <div style={{
          width: BAR_W, height: Math.max(0, rightH),
          backgroundColor: C.green,
          borderRadius: '12px 12px 0 0',
          boxShadow: `0 0 40px ${C.green}55`,
        }} />
        <div style={{ fontSize: 28, color: C.muted, fontFamily: DM, textAlign: 'center', maxWidth: BAR_W }}>
          After Jensen spoke
        </div>
      </div>

      {/* ── STAT PILLS ── */}
      <div style={{
        position: 'absolute',
        top: SAFE_T + 1110,
        left: SAFE_X, right: SAFE_X,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {pills.map((pill, i) => {
          const pSp  = sp(fps, Math.max(0, frame - pill.start))
          const pY   = ip(pSp, [0,1], [28,0])
          const pOp  = ip(frame - pill.start, [0, 16], [0, 1])
          return (
            <div key={i} style={{
              backgroundColor: pill.bg,
              border: `1.5px solid ${pill.border}`,
              borderRadius: 50, padding: '14px 28px',
              opacity: pOp, transform: `translateY(${pY}px)`,
            }}>
              <span style={{ fontSize: 36, fontWeight: 700, color: C.white, fontFamily: DM }}>
                {pill.label}
              </span>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 5 — SIMPLE MATH (390 frames / 13 s)
// ══════════════════════════════════════════════════════════════════════════════

function SceneSimpleMath() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Entry
  const entryX = ip(sp(fps, frame, { damping: 20, mass: 1.0, stiffness: 90 }), [0,1], [VW, 0])

  const titleOp = ip(frame, [8, 26], [0, 1])
  const titleY  = ip(frame, [8, 26], [20, 0])

  // Small circle (MRVL today) — frame 34
  const sm_Sp = sp(fps, Math.max(0, frame - 34), { damping: 12, mass: 1.3, stiffness: 80 })
  const smSc  = ip(sm_Sp, [0,1], [0, 1])
  const smOp  = ip(frame, [34, 52], [0, 1])

  // Large circle (prediction) — frame 80
  const lg_Sp = sp(fps, Math.max(0, frame - 80), { damping: 11, mass: 1.5, stiffness: 70 })
  const lgSc  = ip(lg_Sp, [0,1], [0, 1])
  const lgOp  = ip(frame, [80, 100], [0, 1])

  // Arrow between circles — frame 90
  const arrowOp = ip(frame, [90, 106], [0, 1])

  // "Nearly 4x" text — frame 130
  const foXOp = ip(frame, [130, 150], [0, 1])
  const foXY  = ip(sp(fps, Math.max(0, frame - 130)), [0,1], [24, 0])

  // "4x" pulse
  const pulse = 1 + Math.sin(Math.max(0, frame - 145) * 0.14) * 0.04

  // Exit
  const exitX = ip(frame, [370, 389], [0, -VW])

  return (
    <AbsoluteFill style={{
      backgroundColor: C.bg,
      transform: `translateX(${frame < 370 ? entryX : exitX}px)`,
    }}>
      <Glow color={C.gold} opacity={0.16} />
      <Watermark />

      {/* Title */}
      <div style={{
        position: 'absolute', top: SAFE_T + 20, left: SAFE_X, right: SAFE_X,
        opacity: titleOp, transform: `translateY(${titleY}px)`,
      }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.2 }}>
          What does a trillion-dollar<br />prediction actually mean?
        </div>
      </div>

      {/* ── CIRCLE COMPARISON ── */}
      <div style={{
        position: 'absolute',
        top: SAFE_T + 260,
        left: SAFE_X, right: SAFE_X,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>

        {/* Small circle — $268B */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          opacity: smOp, transform: `scale(${smSc})`, transformOrigin: 'center',
        }}>
          <div style={{
            width: 190, height: 190, borderRadius: '50%',
            backgroundColor: C.blueBg,
            border: `3px solid ${C.accent}`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: C.accent, fontFamily: DM }}>MRVL</span>
            <span style={{ fontSize: 30, fontWeight: 800, color: C.white, fontFamily: DM }}>$268B</span>
          </div>
          <span style={{ fontSize: 30, color: C.muted, fontFamily: DM, textAlign: 'center' }}>Where it is now</span>
        </div>

        {/* Arrow */}
        <div style={{ opacity: arrowOp, flexShrink: 0 }}>
          <svg width="60" height="36" viewBox="0 0 60 36">
            <line x1="0" y1="18" x2="50" y2="18" stroke={C.gold} strokeWidth="3"/>
            <polyline points="40,6 54,18 40,30" stroke={C.gold} strokeWidth="3" fill="none"/>
          </svg>
        </div>

        {/* Large circle — $1T */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          opacity: lgOp, transform: `scale(${lgSc})`, transformOrigin: 'center',
        }}>
          <div style={{
            width: 380, height: 380, borderRadius: '50%',
            backgroundColor: 'rgba(245,200,66,0.13)',
            border: `3px solid ${C.gold}`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
            boxShadow: `0 0 60px ${C.gold}33`,
          }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: C.gold, fontFamily: DM }}>Jensen's Prediction</span>
            <span style={{ fontSize: 46, fontWeight: 800, color: C.white, fontFamily: DM }}>$1 TRILLION</span>
          </div>
          <span style={{ fontSize: 30, color: C.muted, fontFamily: DM, textAlign: 'center' }}>Where Jensen thinks<br />it's going</span>
        </div>
      </div>

      {/* 4x explanation */}
      <div style={{
        position: 'absolute',
        top: SAFE_T + 920,
        left: SAFE_X, right: SAFE_X,
        textAlign: 'center',
        opacity: foXOp, transform: `translateY(${foXY}px)`,
      }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.25 }}>
          That would be nearly{' '}
          <span style={{
            color: C.gold,
            display: 'inline-block',
            transform: `scale(${pulse})`,
          }}>
            4×
          </span>
          {' '}from today's price
        </div>
        <div style={{ fontSize: 36, color: C.muted, fontFamily: DM, marginTop: 14 }}>
          Meaning the stock could potentially<br />quadruple in value
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 6 — THE CATCH (210 frames / 7 s)
// ══════════════════════════════════════════════════════════════════════════════

const BULL_POINTS = [
  "Jensen Huang has been right about AI",
  "Marvell's chips are in high demand",
  "AI spending is accelerating",
]
const BEAR_POINTS = [
  "No guarantee this happens",
  "Still needs to grow 4×",
  "Markets are unpredictable",
]

function SceneCatch() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Fade entry
  const entryOp = ip(frame, [0, 20], [0, 1])
  const exitOp  = ip(frame, [190, 209], [1, 0])
  const sceneOp = frame < 190 ? entryOp : exitOp

  const headerOp = ip(frame, [12, 28], [0, 1])

  // Column headers — frame 24
  const colHOp = ip(frame, [24, 40], [0, 1])
  const colHY  = ip(sp(fps, Math.max(0, frame - 24)), [0,1], [20,0])

  // Bullets stagger — first bullet at frame 45, each +8 frames
  const disclaimerOp = ip(frame, [145, 165], [0, 1])

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, opacity: sceneOp }}>
      <Glow color={C.accent} opacity={0.12} />
      <Watermark />

      {/* Title */}
      <div style={{
        position: 'absolute', top: SAFE_T + 20, left: SAFE_X, right: SAFE_X,
        opacity: headerOp,
      }}>
        <div style={{ fontSize: 60, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.2, textAlign: 'center' }}>
          But here's the<br />full picture
        </div>
      </div>

      {/* Two columns */}
      <div style={{
        position: 'absolute',
        top: SAFE_T + 220,
        left: SAFE_X, right: SAFE_X,
        display: 'flex', gap: 24,
      }}>

        {/* Bull column */}
        <div style={{
          flex: 1,
          backgroundColor: C.greenBg,
          border: `1.5px solid ${C.green}`,
          borderRadius: 20,
          padding: '24px 22px',
          opacity: colHOp,
          transform: `translateY(${colHY}px)`,
        }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: C.green, fontFamily: DM, marginBottom: 20 }}>
            The Bull Case 🐂
          </div>
          {BULL_POINTS.map((pt, i) => {
            const bOp = ip(frame, [45 + i*8, 61 + i*8], [0, 1])
            const bY  = ip(sp(fps, Math.max(0, frame - (45+i*8))), [0,1], [18,0])
            return (
              <div key={pt} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                marginBottom: 14, opacity: bOp, transform: `translateY(${bY}px)`,
              }}>
                <span style={{ color: C.green, fontSize: 28, flexShrink: 0, marginTop: 2 }}>✓</span>
                <span style={{ fontSize: 30, color: C.white, fontFamily: DM, lineHeight: 1.4 }}>{pt}</span>
              </div>
            )
          })}
        </div>

        {/* Bear column */}
        <div style={{
          flex: 1,
          backgroundColor: C.redBg,
          border: `1.5px solid ${C.red}`,
          borderRadius: 20,
          padding: '24px 22px',
          opacity: colHOp,
          transform: `translateY(${colHY}px)`,
        }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: C.red, fontFamily: DM, marginBottom: 20 }}>
            The Risk ⚠️
          </div>
          {BEAR_POINTS.map((pt, i) => {
            const bOp = ip(frame, [69 + i*8, 85 + i*8], [0, 1])
            const bY  = ip(sp(fps, Math.max(0, frame - (69+i*8))), [0,1], [18,0])
            return (
              <div key={pt} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                marginBottom: 14, opacity: bOp, transform: `translateY(${bY}px)`,
              }}>
                <span style={{ color: C.red, fontSize: 28, flexShrink: 0, marginTop: 2 }}>✕</span>
                <span style={{ fontSize: 30, color: C.white, fontFamily: DM, lineHeight: 1.4 }}>{pt}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{
        position: 'absolute',
        bottom: SAFE_B + 80,
        left: SAFE_X, right: SAFE_X,
        textAlign: 'center',
        opacity: disclaimerOp,
      }}>
        <span style={{ fontSize: 28, color: C.dimmer, fontFamily: DM }}>
          Always do your own research. This is not financial advice.
        </span>
      </div>
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 7 — CTA (150 frames / 5 s)
// ══════════════════════════════════════════════════════════════════════════════

function SceneCTA() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Fade in
  const fadeIn  = ip(frame, [0, 18], [0, 1])
  // Fade out to black
  const fadeOut = ip(frame, [128, 149], [0, 1])

  const logoSp  = sp(fps, Math.max(0, frame - 16), { damping: 12, mass: 1.2, stiffness: 80 })
  const logoSc  = ip(logoSp, [0,1], [0.5, 1])
  const logoOp  = ip(frame, [16, 34], [0, 1])
  const floatY  = Math.sin(frame * 0.1) * 6

  const tagOp   = ip(frame, [42, 58], [0, 1])
  const tagY    = ip(sp(fps, Math.max(0, frame - 42)), [0,1], [22, 0])

  const domainScale = 1 + Math.sin(Math.max(0, frame - 60) * 0.13) * 0.025
  const domainOp    = ip(frame, [55, 72], [0, 1])

  const subtextOp = ip(frame, [68, 84], [0, 1])

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, opacity: fadeIn }}>
      <Glow color={C.accent} w={600} h={600} opacity={0.20} />

      {/* Logo */}
      <div style={{
        position: 'absolute',
        top: SAFE_T + 320,
        left: '50%',
        transform: `translateX(-50%) translateY(${floatY}px) scale(${logoSc})`,
        opacity: logoOp,
      }}>
        <Img src={staticFile('logo.png')} style={{ width: 140, height: 140, objectFit: 'contain' }} />
      </div>

      {/* Tagline */}
      <div style={{
        position: 'absolute',
        top: SAFE_T + 510,
        left: SAFE_X, right: SAFE_X,
        textAlign: 'center',
        opacity: tagOp, transform: `translateY(${tagY}px)`,
      }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: C.white, fontFamily: DM, lineHeight: 1.2 }}>
          Track signals like this daily
        </div>
      </div>

      {/* Domain */}
      <div style={{
        position: 'absolute',
        top: SAFE_T + 630,
        left: SAFE_X, right: SAFE_X,
        textAlign: 'center',
        transform: `scale(${domainScale})`,
        opacity: domainOp,
      }}>
        <span style={{ fontSize: 64, fontWeight: 800, color: C.accent, fontFamily: DM, letterSpacing: '-0.01em' }}>
          holoture.com
        </span>
      </div>

      {/* Subtext */}
      <div style={{
        position: 'absolute',
        top: SAFE_T + 730,
        left: SAFE_X, right: SAFE_X,
        textAlign: 'center',
        opacity: subtextOp,
      }}>
        <span style={{ fontSize: 32, color: C.muted, fontFamily: DM }}>
          Free to start. No credit card.
        </span>
      </div>

      {/* Fade to black overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundColor: C.bg,
        opacity: fadeOut,
        pointerEvents: 'none',
      }} />
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT COMPOSITION
// ══════════════════════════════════════════════════════════════════════════════

export const MRVLExplainer: React.FC = () => (
  <>
    <Sequence from={0}    durationInFrames={150}><SceneHook /></Sequence>
    <Sequence from={150}  durationInFrames={240}><SceneWhoSaidIt /></Sequence>
    <Sequence from={390}  durationInFrames={300}><SceneWhatIsMarvell /></Sequence>
    <Sequence from={690}  durationInFrames={360}><SceneStockMove /></Sequence>
    <Sequence from={1050} durationInFrames={390}><SceneSimpleMath /></Sequence>
    <Sequence from={1440} durationInFrames={210}><SceneCatch /></Sequence>
    <Sequence from={1650} durationInFrames={150}><SceneCTA /></Sequence>
  </>
)
