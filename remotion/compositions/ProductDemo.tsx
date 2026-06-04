/**
 * ProductDemo — 40 s product launch video (1080 × 1920, 30 fps)
 *
 * Scene timeline (frames @ 30 fps):
 *   S1  0–89    Hook          3 s  — pain-point text, pulse glow
 *   S2  90–209  Brand Intro   4 s  — logo spring, particles, tagline
 *   S3  210–509 Signals      10 s  — signal board, expand, confidence bar
 *   S4  510–749 Options       8 s  — option cards, highlight, thesis flip
 *   S5  750–989 Politicians   8 s  — trade rows, typeout commentary
 *   S6  990–1199 CTA          7 s  — tiers, domain pulse, fade to black
 *
 * Safe zones: top ≥ 150px, bottom ≤ 1750px, sides ≥ 60px
 * Min font sizes: headline 56px, body 36px, label 28px
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
import type { ProductDemoProps, DemoSignal, DemoOption, DemoPolitician } from '../lib/demoTypes'
export type { ProductDemoProps }
export { DEMO_FALLBACK } from '../lib/demoTypes'

// ── Font ───────────────────────────────────────────────────────────────────────
const { fontFamily: DM_SANS } = loadFont('normal', { weights: ['400', '600', '700', '800'] })

// ── Brand colours ──────────────────────────────────────────────────────────────
const C = {
  dark:    '#0F0F0F',
  light:   '#FAFAFA',
  white:   '#FFFFFF',
  accent:  '#009BFF',
  buy:     '#1D9E75',
  short:   '#E24B4A',
  watch:   '#BA7517',
  gold:    '#F5C842',
  muted:   'rgba(255,255,255,0.45)',
  mutedDk: 'rgba(26,26,26,0.55)',
  border:  '#E5E7EB',
  cardBg:  '#F2F4F8',
} as const

// ── Layout constants ───────────────────────────────────────────────────────────
const VW = 1080
const VH = 1920
const SAFE_T  = 150
const SAFE_B  = 170
const SAFE_X  = 60
const CW      = VW - SAFE_X * 2   // 960 — safe content width

// ── Global helpers ─────────────────────────────────────────────────────────────
const EO = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ip = (f: number, inp: number[], out: number[]) => interpolate(f, inp, out, EO)

const SC = { damping: 15, mass: 1.2, stiffness: 100 }  // default spring config
const sp = (fps: number, f: number, cfg: Record<string, number> = SC) =>
  spring({ fps, frame: f, config: cfg })

function sigColor(t: string) { return t === 'BUY' ? C.buy : t === 'SHORT' ? C.short : C.watch }
function sigBg(t: string)    { return t === 'BUY' ? '#E8F7F2' : t === 'SHORT' ? '#FEF0F0' : '#FEF3E2' }
function partyColor(p: string) {
  if (p.toLowerCase().startsWith('d')) return '#3B82F6'
  if (p.toLowerCase().startsWith('r')) return '#EF4444'
  return '#8B5CF6'
}
const fmt = (n: number) => `$${n.toFixed(2)}`

// ── Pre-computed particles (deterministic, no Math.random() in render) ─────────
const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  angle:  (i / 20) * Math.PI * 2 + i * 0.42,
  speed:  3.5 + (i % 5) * 0.7,
  size:   5 + (i % 4) * 2.5,
  delay:  (i % 5) * 2,
  color:  i % 3 === 0 ? C.accent : i % 3 === 1 ? '#60C6FF' : '#FFFFFF',
}))

// ── Shared UI atoms ────────────────────────────────────────────────────────────

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <div style={{
      backgroundColor: bg,
      borderRadius: 10,
      paddingLeft: 16, paddingRight: 16, paddingTop: 7, paddingBottom: 7,
      display: 'inline-flex', alignItems: 'center',
    }}>
      <span style={{ fontSize: 26, fontWeight: 800, color, fontFamily: DM_SANS, letterSpacing: '0.03em' }}>
        {label}
      </span>
    </div>
  )
}

function MaxBadge() {
  return (
    <div style={{
      backgroundColor: C.gold,
      borderRadius: 10,
      paddingLeft: 16, paddingRight: 16, paddingTop: 6, paddingBottom: 6,
      display: 'inline-flex', alignItems: 'center',
    }}>
      <span style={{ fontSize: 24, fontWeight: 900, color: '#1A1A1A', fontFamily: DM_SANS, letterSpacing: '0.06em' }}>
        MAX
      </span>
    </div>
  )
}

function SectionTitle({
  title, relFrame, dark = false, showMax = false,
}: {
  title: string; relFrame: number; dark?: boolean; showMax?: boolean
}) {
  const textColor = dark ? C.white : '#1A1A1A'
  const op  = ip(relFrame, [0, 18], [0, 1])
  const txY = ip(relFrame, [0, 18], [16, 0])
  return (
    <div style={{ opacity: op, transform: `translateY(${txY}px)`, display: 'flex', alignItems: 'center', gap: 18 }}>
      <span style={{
        fontSize: 32, fontWeight: 700, color: C.accent, fontFamily: DM_SANS,
        letterSpacing: '0.14em', textTransform: 'uppercase' as const,
      }}>
        {title}
      </span>
      {showMax && <MaxBadge />}
    </div>
  )
}

function CaptionBar({ text, relFrame, show = true }: { text: string; relFrame: number; show?: boolean }) {
  if (!show) return null
  const op = ip(relFrame, [15, 32, 220, 240], [0, 1, 1, 0])
  return (
    <div style={{
      position: 'absolute',
      bottom: SAFE_B + 20,
      left: SAFE_X, right: SAFE_X,
      opacity: op,
      textAlign: 'center',
    }}>
      <span style={{
        fontSize: 36, fontWeight: 500, color: '#1A1A1A',
        fontFamily: DM_SANS, lineHeight: 1.35,
      }}>
        {text}
      </span>
    </div>
  )
}

function ConfidenceBar({
  confidence, relFrame, fillStart, fillDuration, color,
}: {
  confidence: number; relFrame: number; fillStart: number; fillDuration: number; color: string
}) {
  const pct = ip(relFrame - fillStart, [0, fillDuration], [0, confidence])
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 600, color: '#9CA3AF', fontFamily: DM_SANS }}>
          Confidence
        </span>
        <span style={{ fontSize: 30, fontWeight: 800, color, fontFamily: DM_SANS }}>
          {Math.round(pct)}%
        </span>
      </div>
      <div style={{ height: 10, backgroundColor: '#E5E7EB', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 5 }} />
      </div>
    </div>
  )
}

// ── Cursor with click ripple ───────────────────────────────────────────────────

interface CursorWaypoint { f: number; x: number; y: number }

function Cursor({ waypoints, clicks }: { waypoints: CursorWaypoint[]; clicks: number[] }) {
  const frame = useCurrentFrame()
  if (waypoints.length === 0) return null

  const frames = waypoints.map(w => w.f)
  const xs = waypoints.map(w => w.x)
  const ys = waypoints.map(w => w.y)

  const cx = ip(frame, frames, xs)
  const cy = ip(frame, frames, ys)

  return (
    <>
      {/* Trailing shadow */}
      <div style={{
        position: 'absolute', left: cx - 18, top: cy - 18,
        width: 36, height: 36, borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.18)',
        pointerEvents: 'none', zIndex: 90,
      }} />
      {/* Cursor dot */}
      <div style={{
        position: 'absolute', left: cx - 8, top: cy - 8,
        width: 16, height: 16, borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.85)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        pointerEvents: 'none', zIndex: 91,
      }} />
      {/* Click ripples */}
      {clicks.map((cf, i) => {
        const rf = frame - cf
        if (rf < 0 || rf > 35) return null
        const rScale = ip(rf, [0, 35], [0.2, 2.2])
        const rOp   = ip(rf, [0, 8, 35], [0.9, 0.7, 0])
        return (
          <div key={i} style={{
            position: 'absolute', left: cx - 24, top: cy - 24,
            width: 48, height: 48, borderRadius: '50%',
            border: `2px solid ${C.accent}`,
            transform: `scale(${rScale})`, opacity: rOp,
            pointerEvents: 'none', zIndex: 89,
          }} />
        )
      })}
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 1 — HOOK
// ══════════════════════════════════════════════════════════════════════════════

function SceneHook() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const textScale = sp(fps, frame, { damping: 14, mass: 1.1, stiffness: 120 })
  const textSc  = ip(textScale, [0, 1], [2, 1])
  const textOp  = ip(frame, [0, 8, 68, 88], [0, 1, 1, 0])

  // Radial glow pulse
  const glowOp = 0.35 + Math.sin(frame * 0.18) * 0.18

  // Logo appears bottom-center
  const logoOp = ip(frame, [58, 82], [0, 1])
  const logoY  = ip(frame, [58, 78], [24, 0])

  return (
    <AbsoluteFill style={{ backgroundColor: C.dark }}>
      {/* Pulsing accent glow */}
      <div style={{
        position: 'absolute', left: '50%', top: '45%',
        transform: 'translate(-50%, -50%)',
        width: 700, height: 500,
        background: `radial-gradient(ellipse, ${C.accent}${Math.round(glowOp * 255).toString(16).padStart(2,'0')} 0%, transparent 68%)`,
        pointerEvents: 'none',
      }} />

      {/* Pain-point headline */}
      <div style={{
        position: 'absolute',
        top: SAFE_T + 340, left: SAFE_X, right: SAFE_X,
        textAlign: 'center',
        transform: `scale(${textSc})`,
        opacity: textOp,
      }}>
        <div style={{
          fontSize: 68, fontWeight: 800, color: C.white,
          fontFamily: DM_SANS, lineHeight: 1.18,
        }}>
          Tired of paying{'\n'}
          <span style={{ color: C.short }}>$200/month</span>
          {'\n'}for a Discord server?
        </div>
      </div>

      {/* Logo bottom-center */}
      <div style={{
        position: 'absolute',
        bottom: SAFE_B + 60,
        left: '50%', transform: `translateX(-50%) translateY(${logoY}px)`,
        opacity: logoOp,
      }}>
        <Img src={staticFile('logo.png')} style={{ width: 80, height: 80, objectFit: 'contain' }} />
      </div>
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 2 — BRAND INTRO
// ══════════════════════════════════════════════════════════════════════════════

function SceneBrand() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const logoSp  = sp(fps, frame, { damping: 13, mass: 1.3, stiffness: 90 })
  const logoSc  = ip(logoSp, [0, 1], [3, 1])
  const logoOp  = ip(frame, [0, 12], [0, 1])
  const floatY  = Math.sin(frame * 0.12) * 6

  const nameSp  = sp(fps, Math.max(0, frame - 20))
  const nameY   = ip(nameSp, [0, 1], [50, 0])
  const nameOp  = ip(frame, [20, 38], [0, 1])

  const tagOp   = ip(frame, [36, 56], [0, 1])
  const tagY    = ip(frame, [36, 56], [18, 0])

  // Background: dark → dark blue gradient
  const gradOp  = ip(frame, [0, 60], [0, 1])

  return (
    <AbsoluteFill style={{ backgroundColor: C.dark }}>
      {/* Dark blue gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0, opacity: gradOp,
        background: 'linear-gradient(170deg, #0A0F1E 0%, #0F1628 60%, #0F0F0F 100%)',
      }} />
      {/* Accent glow behind logo */}
      <div style={{
        position: 'absolute', left: '50%', top: '42%',
        transform: 'translate(-50%, -50%)',
        width: 500, height: 500,
        background: `radial-gradient(circle, ${C.accent}30 0%, transparent 65%)`,
      }} />
      {/* Particles */}
      {PARTICLES.map((p, i) => {
        const pf = Math.max(0, frame - p.delay)
        const pSp = sp(fps, pf, { damping: 20, mass: 0.8, stiffness: 60 })
        const dist = ip(pSp, [0, 1], [0, p.speed * 80])
        const pOp  = ip(pf, [0, 5, 40, 65], [0, 0.9, 0.7, 0])
        const px = VW / 2 + Math.cos(p.angle) * dist - p.size / 2
        const py = VH * 0.42 + Math.sin(p.angle) * dist - p.size / 2
        return (
          <div key={i} style={{
            position: 'absolute', left: px, top: py,
            width: p.size, height: p.size, borderRadius: '50%',
            backgroundColor: p.color, opacity: pOp,
            pointerEvents: 'none',
          }} />
        )
      })}
      {/* Logo */}
      <div style={{
        position: 'absolute', left: '50%', top: VH * 0.38,
        transform: `translateX(-50%) translateY(${floatY}px) scale(${logoSc})`,
        opacity: logoOp,
      }}>
        <Img src={staticFile('logo.png')} style={{
          width: 160,
          height: 160,
          objectFit: 'contain'
        }} />
      </div>
      {/* "Holoture" wordmark */}
      <div style={{
        position: 'absolute', left: SAFE_X, right: SAFE_X,
        top: VH * 0.38 + 185,
        textAlign: 'center',
        transform: `translateY(${nameY}px)`, opacity: nameOp,
      }}>
        <span style={{ fontSize: 88, fontWeight: 800, color: C.white, fontFamily: DM_SANS, letterSpacing: '-0.02em' }}>
          Holo<span style={{ color: C.accent }}>ture</span>
        </span>
      </div>
      {/* Tagline */}
      <div style={{
        position: 'absolute', left: SAFE_X, right: SAFE_X,
        top: VH * 0.38 + 295,
        textAlign: 'center',
        transform: `translateY(${tagY}px)`, opacity: tagOp,
      }}>
        <span style={{ fontSize: 38, fontWeight: 400, color: C.muted, fontFamily: DM_SANS, lineHeight: 1.4 }}>
          Data-powered stock signals.{'\n'}No guru required.
        </span>
      </div>
    </AbsoluteFill>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 3 — SIGNALS DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

function SignalRow({
  sig, relFrame, staggerOffset, isExpanded, expandStart,
}: {
  sig: DemoSignal
  relFrame: number
  staggerOffset: number
  isExpanded: boolean
  expandStart: number
}) {
  const { fps } = useVideoConfig()
  const rf    = relFrame - staggerOffset
  const rowSp = sp(fps, Math.max(0, rf))
  const rowY  = ip(rowSp, [0, 1], [60, 0])
  const rowOp = ip(rf, [0, 12], [0, 1])

  const color = sigColor(sig.signalType)
  const bg    = sigBg(sig.signalType)

  const expandSp  = sp(fps, Math.max(0, relFrame - expandStart), { damping: 16, mass: 1.1, stiffness: 100 })
  const expandH   = ip(expandSp, [0, 1], [0, 1])

  return (
    <div style={{
      opacity: rowOp,
      transform: `translateY(${rowY}px)`,
      marginBottom: 16,
    }}>
      <div style={{
        backgroundColor: C.white,
        borderRadius: 20,
        padding: '24px 28px',
        boxShadow: isExpanded ? `0 8px 32px ${color}28, 0 2px 8px rgba(0,0,0,0.06)` : '0 2px 12px rgba(0,0,0,0.07)',
        border: isExpanded ? `1.5px solid ${color}` : '1.5px solid transparent',
        transition: 'box-shadow 0.3s',
      }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 52, fontWeight: 800, color: '#1A1A1A', fontFamily: DM_SANS, lineHeight: 1 }}>
              {sig.ticker}
            </span>
            <span style={{ display: 'block', fontSize: 30, color: '#6B7280', fontFamily: DM_SANS, marginTop: 4 }}>
              {sig.companyName}
            </span>
          </div>
          <Badge label={sig.signalType} color={color} bg={bg} />
        </div>

        {/* Expanded detail */}
        {isExpanded && (
          <div style={{
            overflow: 'hidden',
            maxHeight: `${expandH * 300}px`,
            opacity: expandH,
          }}>
            <div style={{ height: 1, backgroundColor: C.border, marginTop: 20, marginBottom: 20 }} />

            {/* Confidence bar */}
            <ConfidenceBar
              confidence={sig.confidence}
              relFrame={relFrame}
              fillStart={expandStart + 8}
              fillDuration={55}
              color={color}
            />

            {/* Price levels */}
            <div style={{ display: 'flex', gap: 14, marginTop: 22 }}>
              {[
                { label: 'Entry Zone', value: `${fmt(sig.entryZoneLow)}–${fmt(sig.entryZoneHigh)}`, c: '#1A1A1A' },
                { label: 'Target 🎯', value: fmt(sig.targetPrice), c: C.buy },
                { label: 'Stop Loss', value: fmt(sig.stopLoss), c: C.short },
              ].map(({ label, value, c }) => (
                <div key={label} style={{
                  flex: 1, backgroundColor: C.cardBg, borderRadius: 14,
                  padding: '16px 14px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 24, color: '#9CA3AF', fontFamily: DM_SANS, marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: c, fontFamily: DM_SANS, lineHeight: 1.2 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SceneSignals({ signals }: { signals: DemoSignal[] }) {
  const frame = useCurrentFrame()

  const EXPAND_START = 65
  const SLIDE_OUT    = 285  // begin exit slide

  // Entry / exit slide
  const entryX = ip(frame, [0, 15], [VW, 0])
  const exitX  = ip(frame, [SLIDE_OUT, 299], [0, -VW])
  const slideX = frame < SLIDE_OUT ? entryX : exitX

  // Cursor waypoints (relative to this Sequence's frame = absolute)
  const cursorWaypoints: CursorWaypoint[] = [
    { f: 0,  x: VW * 0.8, y: VH * 0.45 },
    { f: 50, x: VW * 0.8, y: VH * 0.45 },
    { f: 62, x: SAFE_X + CW - 55, y: SAFE_T + 230 },
    { f: 70, x: SAFE_X + CW - 55, y: SAFE_T + 230 },
    { f: 130, x: SAFE_X + CW * 0.5, y: SAFE_T + 320 },
    { f: 299, x: SAFE_X + CW * 0.5, y: SAFE_T + 320 },
  ]

  const rows = signals.slice(0, 3)

  return (
    <AbsoluteFill style={{
      backgroundColor: C.light,
      transform: `translateX(${slideX}px)`,
    }}>
      <div style={{
        position: 'absolute',
        top: SAFE_T + 10, left: SAFE_X, right: SAFE_X,
        bottom: SAFE_B + 80,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Section title */}
        <div style={{ marginBottom: 32 }}>
          <SectionTitle title="Stock Signals" relFrame={frame} />
        </div>

        {/* Signal rows */}
        {rows.map((sig, i) => (
          <SignalRow
            key={sig.ticker}
            sig={sig}
            relFrame={frame}
            staggerOffset={20 + i * 7}
            isExpanded={i === 0 && frame >= EXPAND_START}
            expandStart={EXPAND_START}
          />
        ))}
      </div>

      {/* Caption */}
      <CaptionBar
        text="15–50 signals daily. Entry zones. Price targets. Stop losses."
        relFrame={frame}
      />

      {/* Cursor */}
      <Cursor waypoints={cursorWaypoints} clicks={[65]} />
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 4 — OPTIONS SIGNALS
// ══════════════════════════════════════════════════════════════════════════════

function OptionCard({
  opt, relFrame, staggerOffset, isHighlight, highlightStart, flipStart,
}: {
  opt: DemoOption
  relFrame: number
  staggerOffset: number
  isHighlight: boolean
  highlightStart: number
  flipStart: number
}) {
  const { fps } = useVideoConfig()
  const rf    = relFrame - staggerOffset
  const cardSp = sp(fps, Math.max(0, rf))
  const cardY  = ip(cardSp, [0, 1], [70, 0])
  const cardOp = ip(rf, [0, 14], [0, 1])

  const isBull   = opt.contractType === 'CALL'
  const color    = isBull ? C.buy : C.short
  const bg       = isBull ? '#EDFAF4' : '#FEF0F0'

  const hlSc  = isHighlight ? ip(relFrame - highlightStart, [0, 20], [1, 1.03]) : 1
  const hlGlow = isHighlight ? `0 12px 40px ${color}30, 0 3px 12px rgba(0,0,0,0.08)` : '0 2px 10px rgba(0,0,0,0.07)'
  const hlBorder = isHighlight ? `1.5px solid ${color}` : '1.5px solid transparent'

  // Flip / expand
  const flipSp = sp(fps, Math.max(0, relFrame - flipStart), { damping: 18, mass: 1.0, stiffness: 90 })
  const thesisH = isHighlight ? ip(flipSp, [0, 1], [0, 1]) : 0

  const confPct = ip(relFrame - (staggerOffset + 18), [0, 55], [0, opt.confidence])

  return (
    <div style={{
      opacity: cardOp,
      transform: `translateY(${cardY}px) scale(${hlSc})`,
      transformOrigin: 'center center',
      marginBottom: 20,
    }}>
      <div style={{
        backgroundColor: isHighlight ? bg : C.white,
        borderRadius: 22, padding: '26px 28px',
        boxShadow: hlGlow, border: hlBorder,
      }}>
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 48, fontWeight: 800, color: '#1A1A1A', fontFamily: DM_SANS }}>{opt.ticker}</span>
            <span style={{ display: 'block', fontSize: 28, color: '#6B7280', fontFamily: DM_SANS, marginTop: 2 }}>{opt.companyName}</span>
          </div>
          <Badge label={opt.contractType} color={color} bg={bg} />
        </div>

        {/* Strike + expiry row */}
        <div style={{ display: 'flex', gap: 28, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 26, color: '#9CA3AF', fontFamily: DM_SANS }}>Strike</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#1A1A1A', fontFamily: DM_SANS }}>${opt.strikePrice}</div>
          </div>
          <div>
            <div style={{ fontSize: 26, color: '#9CA3AF', fontFamily: DM_SANS }}>Expires</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#1A1A1A', fontFamily: DM_SANS }}>{opt.expirationDate}</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <div style={{ fontSize: 26, color: '#9CA3AF', fontFamily: DM_SANS }}>Confidence</div>
            <div style={{ fontSize: 36, fontWeight: 700, color, fontFamily: DM_SANS }}>{Math.round(confPct)}%</div>
          </div>
        </div>

        {/* Confidence bar */}
        <div style={{ height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${confPct}%`, backgroundColor: color, borderRadius: 4 }} />
        </div>

        {/* Thesis (expanded on highlight) */}
        {isHighlight && (
          <div style={{
            overflow: 'hidden',
            maxHeight: `${thesisH * 160}px`,
            opacity: thesisH,
          }}>
            <div style={{ height: 1, backgroundColor: C.border, marginTop: 18, marginBottom: 14 }} />
            <span style={{ fontSize: 28, color: '#374151', fontFamily: DM_SANS, lineHeight: 1.5 }}>
              {opt.thesis}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function SceneOptions({ options }: { options: DemoOption[] }) {
  const frame = useCurrentFrame()

  const HIGHLIGHT_START = 70
  const FLIP_START      = 82
  const SLIDE_OUT       = 225

  const entryX = ip(frame, [0, 15], [VW, 0])
  const exitX  = ip(frame, [SLIDE_OUT, 239], [0, -VW])
  const slideX = frame < SLIDE_OUT ? entryX : exitX

  const cursorWaypoints: CursorWaypoint[] = [
    { f: 0,   x: VW * 0.75, y: VH * 0.55 },
    { f: 60,  x: VW * 0.75, y: VH * 0.55 },
    { f: 74,  x: SAFE_X + CW * 0.5, y: SAFE_T + 510 },
    { f: 84,  x: SAFE_X + CW * 0.5, y: SAFE_T + 510 },
    { f: 239, x: SAFE_X + CW * 0.5, y: SAFE_T + 510 },
  ]

  const cards = options.slice(0, 3)

  return (
    <AbsoluteFill style={{
      backgroundColor: C.light,
      transform: `translateX(${slideX}px)`,
    }}>
      <div style={{
        position: 'absolute',
        top: SAFE_T + 10, left: SAFE_X, right: SAFE_X,
        bottom: SAFE_B + 80,
      }}>
        {/* Section title */}
        <div style={{ marginBottom: 28 }}>
          <SectionTitle title="Options Signals" relFrame={frame} showMax />
        </div>

        {/* Option cards */}
        {cards.map((opt, i) => (
          <OptionCard
            key={`${opt.ticker}-${i}`}
            opt={opt}
            relFrame={frame}
            staggerOffset={18 + i * 10}
            isHighlight={i === 1 && frame >= HIGHLIGHT_START}
            highlightStart={HIGHLIGHT_START}
            flipStart={FLIP_START}
          />
        ))}
      </div>

      <CaptionBar text="Options signals — exclusively for Max members." relFrame={frame} />
      <Cursor waypoints={cursorWaypoints} clicks={[82]} />
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 5 — POLITICIAN SCANNER
// ══════════════════════════════════════════════════════════════════════════════

function PoliticianRow({
  pol, relFrame, staggerOffset, isCenter,
}: {
  pol: DemoPolitician; relFrame: number; staggerOffset: number; isCenter: boolean
}) {
  const { fps } = useVideoConfig()
  const rf     = relFrame - staggerOffset
  const rowSp  = sp(fps, Math.max(0, rf))
  const rowX   = ip(rowSp, [0, 1], [80, 0])
  const rowOp  = ip(rf, [0, 14], [0, 1])

  const pc      = partyColor(pol.party)
  const isRep   = pol.party.toLowerCase().startsWith('r')
  const isBuy   = pol.tradeType.toLowerCase().includes('purchase') || pol.tradeType.toLowerCase().includes('buy')
  const tradeC  = isBuy ? C.buy : C.short

  const glowOp = isCenter ? ip(relFrame - 72, [0, 20], [0, 1]) : 0

  return (
    <div style={{
      opacity: rowOp,
      transform: `translateX(${rowX}px)`,
      marginBottom: 18,
    }}>
      <div style={{
        backgroundColor: isCenter && glowOp > 0.1 ? `${pc}0C` : C.white,
        borderRadius: 20, padding: '22px 28px',
        borderLeft: isCenter && glowOp > 0.1 ? `4px solid ${pc}` : '4px solid transparent',
        boxShadow: isCenter && glowOp > 0.1
          ? `0 6px 28px ${pc}20, 0 2px 8px rgba(0,0,0,0.06)`
          : '0 2px 10px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* Party badge */}
          <div style={{
            width: 52, height: 52, borderRadius: 26, flexShrink: 0,
            backgroundColor: `${pc}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${pc}`,
          }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: pc, fontFamily: DM_SANS }}>
              {isRep ? 'R' : 'D'}
            </span>
          </div>

          {/* Name + ticker */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 34, fontWeight: 700, color: '#1A1A1A', fontFamily: DM_SANS,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4,
            }}>
              {pol.politicianName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: C.accent, fontFamily: DM_SANS }}>{pol.ticker}</span>
              <span style={{ fontSize: 28, fontWeight: 600, color: tradeC, fontFamily: DM_SANS }}>
                {isBuy ? '▲' : '▼'} {pol.tradeType}
              </span>
              <span style={{ fontSize: 26, color: '#9CA3AF', fontFamily: DM_SANS }}>{pol.amountRange}</span>
            </div>
          </div>

          {/* Date */}
          <span style={{ fontSize: 26, color: '#9CA3AF', fontFamily: DM_SANS, flexShrink: 0 }}>
            {pol.tradedAt}
          </span>
        </div>
      </div>
    </div>
  )
}

function ScenePoliticians({ politicians }: { politicians: DemoPolitician[] }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const TYPE_START   = 85   // commentary typing starts
  const TYPE_SPEED   = 1.8  // chars per frame
  const FEATURE_IN   = 185
  const FEATURE_OUT  = 228

  const centerPol = politicians[1] ?? politicians[0]
  const commentary = centerPol?.aiCommentary ?? ''
  const chars = Math.min(commentary.length, Math.floor(Math.max(0, frame - TYPE_START) * TYPE_SPEED))
  const displayText = commentary.slice(0, chars)

  // Commentary expand
  const expSp = sp(fps, Math.max(0, frame - 78), { damping: 18, mass: 1.0, stiffness: 90 })
  const expH  = ip(expSp, [0, 1], [0, 1])
  const expOp = ip(frame, [78, 95], [0, 1])

  const entryX = ip(frame, [0, 15], [VW, 0])

  const featureOp = ip(frame, [FEATURE_IN, FEATURE_IN + 14, FEATURE_OUT - 12, FEATURE_OUT], [0, 1, 1, 0])

  const cursorWaypoints: CursorWaypoint[] = [
    { f: 0,   x: VW * 0.8, y: VH * 0.5 },
    { f: 65,  x: VW * 0.8, y: VH * 0.5 },
    { f: 76,  x: SAFE_X + CW * 0.5, y: SAFE_T + 450 },
    { f: 82,  x: SAFE_X + CW * 0.5, y: SAFE_T + 450 },
    { f: 239, x: SAFE_X + CW * 0.5, y: SAFE_T + 450 },
  ]

  const rows = politicians.slice(0, 3)

  return (
    <AbsoluteFill style={{
      backgroundColor: C.light,
      transform: `translateX(${entryX}px)`,
    }}>
      <div style={{
        position: 'absolute',
        top: SAFE_T + 10, left: SAFE_X, right: SAFE_X,
        bottom: SAFE_B + 80,
      }}>
        {/* Section title */}
        <div style={{ marginBottom: 28 }}>
          <SectionTitle title="Politician Scanner" relFrame={frame} showMax />
        </div>

        {/* Politician rows */}
        {rows.map((pol, i) => (
          <PoliticianRow
            key={pol.politicianName}
            pol={pol}
            relFrame={frame}
            staggerOffset={18 + i * 9}
            isCenter={i === 1}
          />
        ))}

        {/* AI Commentary expand for center row */}
        {frame >= 76 && (
          <div style={{
            maxHeight: `${expH * 200}px`, opacity: expOp,
            overflow: 'hidden', marginTop: -10, marginBottom: 18,
            marginLeft: 0, marginRight: 0,
          }}>
            <div style={{
              backgroundColor: '#F0F7FF', borderRadius: 16, padding: '18px 24px',
              borderLeft: `4px solid ${C.accent}`,
            }}>
              <span style={{ fontSize: 30, color: '#374151', fontFamily: DM_SANS, lineHeight: 1.5 }}>
                {displayText}
                {chars < commentary.length && (
                  <span style={{ opacity: Math.round(frame / 8) % 2 === 0 ? 1 : 0 }}>|</span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* Feature flash */}
        <div style={{ opacity: featureOp, textAlign: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 30, color: '#9CA3AF', fontFamily: DM_SANS }}>
            Also: Live Market News&nbsp;&nbsp;•&nbsp;&nbsp;Sector Trends
          </span>
        </div>
      </div>

      <CaptionBar text="Every stock Congress buys or sells. Automatically tracked." relFrame={frame} />
      <Cursor waypoints={cursorWaypoints} clicks={[80]} />
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENE 6 — CTA
// ══════════════════════════════════════════════════════════════════════════════

const TIERS = [
  { label: 'Free',  desc: '1 signal daily',               price: null,    color: C.muted },
  { label: 'Pro',   desc: 'Full board · ',                 price: '$15/mo', color: C.accent },
  { label: 'Max',   desc: 'Options + Congress · ',         price: '$25/mo', color: C.gold },
]

function SceneCTA() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const logoSp  = sp(fps, Math.max(0, frame - 20), { damping: 12, mass: 1.2, stiffness: 80 })
  const logoSc  = ip(logoSp, [0, 1], [0.4, 1])
  const logoOp  = ip(frame, [20, 38], [0, 1])
  const floatY  = Math.sin(frame * 0.1) * 6

  // Domain gentle pulse
  const domainScale = 1 + Math.sin(frame * 0.12) * 0.025

  // Fade to black at very end
  const fadeOut = ip(frame, [190, 209], [0, 1])

  return (
    <AbsoluteFill style={{ backgroundColor: C.dark }}>
      {/* Radial glow */}
      <div style={{
        position: 'absolute', left: '50%', top: '38%',
        transform: 'translate(-50%, -50%)',
        width: 600, height: 600,
        background: `radial-gradient(circle, ${C.accent}22 0%, transparent 65%)`,
      }} />

      {/* Logo */}
      <div style={{
        position: 'absolute',
        left: '50%', top: SAFE_T + 200,
        transform: `translateX(-50%) translateY(${floatY}px) scale(${logoSc})`,
        opacity: logoOp,
      }}>
        <Img src={staticFile('logo.png')} style={{ width: 140, height: 140, objectFit: 'contain' }} />
      </div>

      {/* Wordmark */}
      <div style={{
        position: 'absolute',
        top: SAFE_T + 368, left: SAFE_X, right: SAFE_X,
        textAlign: 'center',
        opacity: logoOp,
      }}>
        <span style={{ fontSize: 80, fontWeight: 800, color: C.white, fontFamily: DM_SANS, letterSpacing: '-0.02em' }}>
          Holo<span style={{ color: C.accent }}>ture</span>
        </span>
      </div>

      {/* Tier list */}
      <div style={{
        position: 'absolute',
        top: SAFE_T + 510, left: SAFE_X + 60, right: SAFE_X + 60,
      }}>
        {TIERS.map((tier, i) => {
          const tOp = ip(frame, [52 + i * 10, 68 + i * 10], [0, 1])
          const tY  = ip(frame, [52 + i * 10, 68 + i * 10], [22, 0])
          return (
            <div key={tier.label} style={{
              opacity: tOp, transform: `translateY(${tY}px)`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingTop: 20, paddingBottom: 20,
              borderBottom: i < TIERS.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
            }}>
              <span style={{ fontSize: 38, fontWeight: 700, color: C.white, fontFamily: DM_SANS }}>
                {tier.label}
              </span>
              <span style={{ fontSize: 34, color: 'rgba(255,255,255,0.55)', fontFamily: DM_SANS }}>
                {tier.desc}
                {tier.price && (
                  <span style={{ color: tier.color, fontWeight: 700 }}>{tier.price}</span>
                )}
              </span>
            </div>
          )
        })}
      </div>

      {/* Domain */}
      <div style={{
        position: 'absolute',
        bottom: SAFE_B + 60, left: SAFE_X, right: SAFE_X,
        textAlign: 'center',
        transform: `scale(${domainScale})`,
        opacity: ip(frame, [95, 115], [0, 1]),
      }}>
        <span style={{ fontSize: 56, fontWeight: 700, color: C.accent, fontFamily: DM_SANS, letterSpacing: '-0.01em' }}>
          holoture.com
        </span>
      </div>

      {/* Fade to black */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundColor: C.dark,
        opacity: fadeOut,
        pointerEvents: 'none',
      }} />
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT COMPOSITION
// ══════════════════════════════════════════════════════════════════════════════

export const ProductDemo: React.FC<ProductDemoProps> = ({ signals, options, politicians }) => (
  <>
    <Sequence from={0}   durationInFrames={90}>
      <SceneHook />
    </Sequence>

    <Sequence from={90}  durationInFrames={120}>
      <SceneBrand />
    </Sequence>

    <Sequence from={210} durationInFrames={300}>
      <SceneSignals signals={signals} />
    </Sequence>

    <Sequence from={510} durationInFrames={240}>
      <SceneOptions options={options} />
    </Sequence>

    <Sequence from={750} durationInFrames={240}>
      <ScenePoliticians politicians={politicians} />
    </Sequence>

    <Sequence from={990} durationInFrames={210}>
      <SceneCTA />
    </Sequence>
  </>
)
