/**
 * Template 3 — Weekly Recap Reel
 * 45 seconds · 30 fps · 1080 × 1920 (vertical)
 *
 * Timeline:
 *  0–3 s    (0–89)     Hook
 *  3–40 s   (90–1199)  5 signals, each gets ~7.4 s (222 frames)
 *  40–45 s  (1200–1349) CTA
 */

import React from 'react'
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from 'remotion'
import { Logo, Watermark } from '../components/Logo'
import { CTAScreen } from '../components/CTAScreen'
import { COLORS, WeeklyRecapProps, WeeklyRecapSignal, signalColor } from '../types'

const FRAMES_PER_SIGNAL = 222  // ~7.4 s at 30 fps

function HookScene({ weekLabel }: { weekLabel: string }) {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 20, 70, 89], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const y = interpolate(frame, [0, 20], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ opacity, transform: `translateY(${y}px)`, textAlign: 'center', padding: '0 80px' }}>
        <p style={{ color: COLORS.muted, fontSize: 32, fontFamily: 'Arial, sans-serif', marginBottom: 16, letterSpacing: '0.06em' }}>
          {weekLabel.toUpperCase()}
        </p>
        <p style={{
          color: COLORS.text,
          fontSize: 80,
          fontWeight: 900,
          fontFamily: 'Arial Black, Arial, sans-serif',
          lineHeight: 1.15,
        }}>
          Our top 5 signals this week 🎯
        </p>
      </div>
      <Watermark />
    </AbsoluteFill>
  )
}

function SignalSlide({ signal, index, total }: { signal: WeeklyRecapSignal; index: number; total: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const scale = spring({ fps, frame, config: { damping: 14, stiffness: 80 } })
  const opacity = interpolate(frame, [0, 15, FRAMES_PER_SIGNAL - 20, FRAMES_PER_SIGNAL], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const color = signalColor(signal.signalType)
  const isBuy = signal.signalType === 'BUY'
  const isShort = signal.signalType === 'SHORT'
  const arrow = isBuy ? '▲' : isShort ? '▼' : '—'

  // Confidence bar
  const barWidth = interpolate(frame, [10, 10 + fps * 1.2], [0, signal.confidence], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center', padding: '0 48px' }}>
      <div style={{ position: 'absolute', top: 60, left: 60 }}>
        <Logo size={30} />
      </div>

      {/* Counter */}
      <div style={{ position: 'absolute', top: 60, right: 60, textAlign: 'right' }}>
        <span style={{ color: COLORS.muted, fontSize: 28, fontFamily: 'Arial, sans-serif' }}>
          {index + 1} / {total}
        </span>
      </div>

      <div style={{ width: '100%', transform: `scale(${scale})`, opacity }}>
        {/* Direction arrow */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span style={{ fontSize: 120, color }}>
            {arrow}
          </span>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: COLORS.surface,
          borderRadius: 32,
          border: `2px solid ${color}44`,
          padding: '52px 48px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
            <div>
              <p style={{ color: COLORS.text, fontSize: 96, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', lineHeight: 1 }}>
                {signal.ticker}
              </p>
              <p style={{ color: COLORS.muted, fontSize: 32, fontFamily: 'Arial, sans-serif', marginTop: 8 }}>
                {signal.companyName}
              </p>
            </div>
            <div style={{
              backgroundColor: `${color}22`,
              border: `2px solid ${color}`,
              borderRadius: 14,
              padding: '12px 28px',
            }}>
              <span style={{ color, fontSize: 36, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif' }}>
                {signal.signalType}
              </span>
            </div>
          </div>

          {/* Confidence */}
          <p style={{ color: COLORS.dim, fontSize: 26, fontFamily: 'Arial, sans-serif', marginBottom: 10 }}>
            Confidence
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 7, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${barWidth}%`, backgroundColor: color, borderRadius: 7 }} />
            </div>
            <span style={{ color, fontSize: 36, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', minWidth: 72, textAlign: 'right' }}>
              {signal.confidence}%
            </span>
          </div>
        </div>
      </div>

      <Watermark />
    </AbsoluteFill>
  )
}

// ── Root composition ─────────────────────────────────────────────────────────

export const WeeklyRecap: React.FC<WeeklyRecapProps> = ({ signals, weekLabel }) => {
  const capped = signals.slice(0, 5)

  return (
    <>
      <Sequence from={0} durationInFrames={90}>
        <HookScene weekLabel={weekLabel} />
      </Sequence>

      {capped.map((signal, i) => (
        <Sequence key={signal.ticker} from={90 + i * FRAMES_PER_SIGNAL} durationInFrames={FRAMES_PER_SIGNAL}>
          <SignalSlide signal={signal} index={i} total={capped.length} />
        </Sequence>
      ))}

      <Sequence from={90 + capped.length * FRAMES_PER_SIGNAL} durationInFrames={150}>
        <CTAScreen
          startFrame={90 + capped.length * FRAMES_PER_SIGNAL}
          headline="See this week's full signal board at holoture.com"
        />
      </Sequence>
    </>
  )
}
