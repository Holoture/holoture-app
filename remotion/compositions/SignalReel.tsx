/**
 * Template 1 — Daily Signal Reel
 * 15 seconds · 30 fps · 1080 × 1920 (vertical)
 *
 * Timeline:
 *  0–2 s   (0–59)    Hook text
 *  2–13 s  (60–389)  Full signal card with chart
 *  13–15 s (390–449) CTA
 */

import React from 'react'
import {
  AbsoluteFill, Sequence,
  interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion'
import { SceneHeader } from '../components/SceneHeader'
import { COLORS, SignalReelProps, signalColor } from '../types'

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt  = (n: number) => `$${n.toFixed(2)}`
const pct  = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`

function buildPath(data: number[], w: number, h: number) {
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pad = 24
  return data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')
}

// ── Scenes ─────────────────────────────────────────────────────────────────────

function HookScene() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const scale = spring({ fps, frame, config: { damping: 10, stiffness: 120 } })
  const opacity = interpolate(frame, [0, 10, 50, 59], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
      {/* Radial glow */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 50% at 50% 50%, ${COLORS.accent}28 0%, transparent 70%)` }} />
      <SceneHeader />

      <div style={{ textAlign: 'center', padding: '0 72px', transform: `scale(${scale})`, opacity }}>
        <p style={{ fontSize: 100, lineHeight: 1, marginBottom: 16, color: COLORS.text }}>📈</p>
        <p style={{ color: COLORS.text, fontSize: 76, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', lineHeight: 1.1 }}>
          Today's top<br />signal just<br />dropped
        </p>
        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
          <span style={{
            backgroundColor: COLORS.accent, color: '#fff',
            fontSize: 28, fontWeight: 700, fontFamily: 'Arial, sans-serif',
            padding: '10px 32px', borderRadius: 100,
          }}>
            Free on Holoture
          </span>
        </div>
      </div>
    </AbsoluteFill>
  )
}

function MainScene({ s }: { s: SignalReelProps }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Card entrance
  const cardY = interpolate(frame, [0, 20], [80, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const cardOp = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // Confidence bar fills over 1.5 s starting at frame 10
  const confPct = interpolate(frame, [10, 10 + fps * 1.5], [0, s.confidence], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // Price chart clip grows after frame 90 (~3 s into this scene)
  const chartW = 940
  const chartH = 280
  const clipW  = interpolate(frame, [120, 300], [0, chartW], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  const color     = signalColor(s.signalType)
  const barColor  = s.confidence >= 75 ? COLORS.buy : s.confidence >= 50 ? COLORS.watch : COLORS.short
  const last      = s.priceHistory[s.priceHistory.length - 1]
  const first     = s.priceHistory[0]
  const changePct = ((last - first) / first) * 100
  const isUp      = changePct >= 0
  const lineColor = isUp ? COLORS.buy : COLORS.short
  const path      = buildPath(s.priceHistory, chartW, chartH)

  // R/R ratio
  const entryMid = (s.entryZoneLow + s.entryZoneHigh) / 2
  const rr        = ((s.targetPrice - entryMid) / (entryMid - s.stopLoss)).toFixed(1)

  // Staggered row entrances
  const rowOp = (i: number) => interpolate(frame, [i * 12, i * 12 + 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const rowX  = (i: number) => interpolate(frame, [i * 12, i * 12 + 18], [-30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, padding: '120px 48px 40px' }}>
      <SceneHeader />

      <div style={{ transform: `translateY(${cardY}px)`, opacity: cardOp, marginTop: 8 }}>
        {/* ── Ticker row ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <p style={{ color: COLORS.text, fontSize: 104, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', lineHeight: 1, marginBottom: 4 }}>
              {s.ticker}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 30, fontFamily: 'Arial, sans-serif' }}>
              {s.companyName}
            </p>
          </div>
          <div style={{
            backgroundColor: `${color}22`, border: `2px solid ${color}`,
            borderRadius: 18, padding: '14px 30px',
          }}>
            <span style={{ color, fontSize: 44, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif' }}>
              {s.signalType}
            </span>
          </div>
        </div>

        {/* ── Confidence ── */}
        <div style={{ marginBottom: 28, opacity: rowOp(1), transform: `translateX(${rowX(1)}px)` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 26, fontFamily: 'Arial, sans-serif', fontWeight: 600, letterSpacing: '0.06em' }}>
              CONFIDENCE
            </span>
            <span style={{ color: barColor, fontSize: 36, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif' }}>
              {Math.round(confPct)}%
            </span>
          </div>
          <div style={{ height: 18, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 9 }}>
            <div style={{ height: '100%', width: `${confPct}%`, backgroundColor: barColor, borderRadius: 9, transition: 'width 0.05s' }} />
          </div>
        </div>

        {/* ── Price levels ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 16, marginBottom: 20,
          opacity: rowOp(2), transform: `translateX(${rowX(2)}px)`,
        }}>
          {[
            { label: 'Entry Zone', value: `${fmt(s.entryZoneLow)}–${fmt(s.entryZoneHigh)}`, color: COLORS.text },
            { label: 'Target 🎯',  value: fmt(s.targetPrice),  color: COLORS.buy },
            { label: 'Stop Loss',  value: fmt(s.stopLoss),     color: COLORS.short },
          ].map(({ label, value, color: c }) => (
            <div key={label} style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: '20px 16px', textAlign: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 22, fontFamily: 'Arial, sans-serif', marginBottom: 8 }}>{label}</p>
              <p style={{ color: c, fontSize: 26, fontWeight: 800, fontFamily: 'Arial, sans-serif', lineHeight: 1.2 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── R/R + timeframe row ── */}
        <div style={{
          display: 'flex', gap: 16, marginBottom: 24,
          opacity: rowOp(3), transform: `translateX(${rowX(3)}px)`,
        }}>
          {[
            { label: 'Risk/Reward', value: `1 : ${rr}`, color: COLORS.accent },
            { label: 'Time Horizon', value: s.signalType === 'SHORT' ? 'Short Term' : 'Swing Trade', color: 'rgba(255,255,255,0.7)' },
          ].map(({ label, value, color: c }) => (
            <div key={label} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '16px 20px' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 20, fontFamily: 'Arial, sans-serif', marginBottom: 6 }}>{label}</p>
              <p style={{ color: c, fontSize: 30, fontWeight: 800, fontFamily: 'Arial, sans-serif' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Price chart ── */}
        <div style={{ opacity: rowOp(4) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 22, fontFamily: 'Arial, sans-serif' }}>30-Day Price</span>
            <span style={{ color: lineColor, fontSize: 28, fontWeight: 800, fontFamily: 'Arial, sans-serif' }}>
              {pct(changePct)}
            </span>
          </div>
          <div style={{ position: 'relative', height: chartH }}>
            <svg width={chartW} height={chartH} style={{ position: 'absolute', inset: 0 }}>
              <defs>
                <clipPath id="chartClip">
                  <rect x={0} y={0} width={clipW} height={chartH} />
                </clipPath>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <path d={`${path} L ${chartW - 24} ${chartH - 24} L 24 ${chartH - 24} Z`} fill="url(#areaFill)" clipPath="url(#chartClip)" />
              <path d={path} fill="none" stroke={lineColor} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" clipPath="url(#chartClip)" />
            </svg>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}

function CTAScene() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const scale  = spring({ fps, frame, config: { damping: 14, stiffness: 100 } })
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${COLORS.accent}20 0%, transparent 70%)` }} />
      <SceneHeader />
      <div style={{ textAlign: 'center', padding: '0 72px', transform: `scale(${scale})`, opacity }}>
        <p style={{ color: COLORS.text, fontSize: 68, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', lineHeight: 1.15, marginBottom: 40 }}>
          See every signal free at holoture.com
        </p>
        <div style={{ backgroundColor: COLORS.accent, color: '#fff', fontSize: 40, fontWeight: 800, fontFamily: 'Arial Black, Arial, sans-serif', padding: '22px 64px', borderRadius: 100, display: 'inline-block' }}>
          Start Free →
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────

export const SignalReel: React.FC<SignalReelProps> = (props) => (
  <>
    <Sequence from={0}   durationInFrames={60}>  <HookScene /> </Sequence>
    <Sequence from={60}  durationInFrames={330}> <MainScene s={props} /> </Sequence>
    <Sequence from={390} durationInFrames={60}>  <CTAScene /> </Sequence>
  </>
)
