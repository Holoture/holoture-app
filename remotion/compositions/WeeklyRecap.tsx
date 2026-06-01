/**
 * Template 3 — Weekly Recap Reel
 * 18 seconds · 30 fps · 1080 × 1920 (vertical)
 *
 * Timeline:
 *  0–2 s   (0–59)    Hook
 *  2–14 s  (60–419)  Signal list — all 5 stagger in, visible together
 *  14–18 s (420–539) Stats summary + CTA
 */

import React from 'react'
import {
  AbsoluteFill, Sequence,
  interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion'
import { SceneHeader } from '../components/SceneHeader'
import { COLORS, WeeklyRecapProps, WeeklyRecapSignal, signalColor } from '../types'

const STAGGER = 54  // frames between each signal entrance (~1.8 s)

// ── Scenes ─────────────────────────────────────────────────────────────────────

function HookScene({ weekLabel }: { weekLabel: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const scale  = spring({ fps, frame, config: { damping: 10, stiffness: 120 } })
  const opacity = interpolate(frame, [0, 10, 50, 59], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 50% at 50% 50%, ${COLORS.buy}20 0%, transparent 70%)` }} />
      <SceneHeader />
      <div style={{ textAlign: 'center', padding: '0 72px', transform: `scale(${scale})`, opacity }}>
        <p style={{ fontSize: 96, lineHeight: 1, marginBottom: 16 }}>🎯</p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 28, fontFamily: 'Arial, sans-serif', letterSpacing: '0.1em', marginBottom: 16 }}>
          {weekLabel.toUpperCase()}
        </p>
        <p style={{ color: COLORS.text, fontSize: 76, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', lineHeight: 1.1 }}>
          Our top 5 signals this week
        </p>
      </div>
    </AbsoluteFill>
  )
}

function SignalRow({ signal, index, frame }: { signal: WeeklyRecapSignal; index: number; frame: number }) {
  const { fps } = useVideoConfig()
  const delay  = index * STAGGER

  const rowSpring = spring({ fps, frame: frame - delay, config: { damping: 14, stiffness: 80 } })
  const opacity   = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // Confidence bar fills 0.5s after the row appears
  const barDelay = delay + 15
  const barFill  = interpolate(frame, [barDelay, barDelay + fps * 0.6], [0, signal.confidence], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  const color   = signalColor(signal.signalType)
  const isBuy   = signal.signalType === 'BUY'
  const isShort = signal.signalType === 'SHORT'
  const arrow   = isBuy ? '▲' : isShort ? '▼' : '—'

  return (
    <div style={{
      opacity,
      transform:       `translateX(${(1 - rowSpring) * -40}px)`,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderRadius:    24,
      border:          `1px solid ${color}30`,
      padding:         '22px 28px',
      marginBottom:    14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 12 }}>
        {/* Arrow */}
        <span style={{ fontSize: 44, color, lineHeight: 1 }}>{arrow}</span>

        {/* Ticker + company */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span style={{ color: COLORS.text, fontSize: 52, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', lineHeight: 1 }}>
              {signal.ticker}
            </span>
            <span style={{ backgroundColor: `${color}22`, border: `1px solid ${color}`, borderRadius: 10, padding: '4px 16px', color, fontSize: 24, fontWeight: 800, fontFamily: 'Arial, sans-serif' }}>
              {signal.signalType}
            </span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 24, fontFamily: 'Arial, sans-serif', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {signal.companyName}
          </p>
        </div>

        {/* Confidence number */}
        <span style={{ color, fontSize: 40, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', minWidth: 72, textAlign: 'right' }}>
          {Math.round(barFill)}%
        </span>
      </div>

      {/* Confidence bar */}
      <div style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
        <div style={{ height: '100%', width: `${barFill}%`, backgroundColor: color, borderRadius: 4 }} />
      </div>
    </div>
  )
}

function ListScene({ signals }: { signals: WeeklyRecapSignal[] }) {
  const frame = useCurrentFrame()

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, padding: '120px 48px 40px' }}>
      <SceneHeader />
      <p style={{
        color:        'rgba(255,255,255,0.4)',
        fontSize:     26,
        fontFamily:   'Arial, sans-serif',
        fontWeight:   600,
        letterSpacing: '0.08em',
        marginBottom: 20,
        marginTop:    12,
      }}>
        THIS WEEK'S TOP SIGNALS
      </p>
      {signals.map((s, i) => (
        <SignalRow key={s.ticker} signal={s} index={i} frame={frame} />
      ))}
    </AbsoluteFill>
  )
}

function SummaryScene({ signals }: { signals: WeeklyRecapSignal[] }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const buys  = signals.filter(s => s.signalType === 'BUY').length
  const shorts = signals.filter(s => s.signalType === 'SHORT').length
  const avgConf = Math.round(signals.reduce((a, s) => a + s.confidence, 0) / (signals.length || 1))

  const scale  = spring({ fps, frame, config: { damping: 14, stiffness: 100 } })
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${COLORS.accent}18 0%, transparent 70%)` }} />
      <SceneHeader />

      <div style={{ padding: '0 56px', transform: `scale(${scale})`, opacity, width: '100%' }}>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 40 }}>
          {[
            { label: 'BUY signals',   value: buys,    color: COLORS.buy },
            { label: 'SHORT signals', value: shorts,  color: COLORS.short },
            { label: 'Avg confidence', value: `${avgConf}%`, color: COLORS.accent },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 24, padding: '28px 16px', border: `1px solid ${color}30` }}>
              <p style={{ color, fontSize: 56, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', lineHeight: 1, marginBottom: 8 }}>{value}</p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 22, fontFamily: 'Arial, sans-serif' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: COLORS.text, fontSize: 52, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', lineHeight: 1.15, marginBottom: 32 }}>
            Full signal board — free at holoture.com
          </p>
          <span style={{ backgroundColor: COLORS.accent, color: '#fff', fontSize: 36, fontWeight: 800, fontFamily: 'Arial Black, Arial, sans-serif', padding: '18px 56px', borderRadius: 100 }}>
            Start Free →
          </span>
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────

export const WeeklyRecap: React.FC<WeeklyRecapProps> = ({ signals, weekLabel }) => {
  const capped = signals.slice(0, 5)
  return (
    <>
      <Sequence from={0}   durationInFrames={60}>  <HookScene weekLabel={weekLabel} /> </Sequence>
      <Sequence from={60}  durationInFrames={360}> <ListScene signals={capped} /> </Sequence>
      <Sequence from={420} durationInFrames={120}> <SummaryScene signals={capped} /> </Sequence>
    </>
  )
}
