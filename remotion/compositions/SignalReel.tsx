/**
 * Template 1 — Daily Signal Reel
 * 30 seconds · 30 fps · 1080 × 1920 (vertical)
 *
 * Timeline:
 *  0–3 s   (0–89)    Hook text fades in
 *  3–8 s   (90–239)  Logo + tagline spring in
 *  8–20 s  (240–599) Signal card with animated confidence bar
 *  20–27 s (600–809) Price chart draws itself left-to-right
 *  27–30 s (810–899) CTA screen
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
import { COLORS, SignalReelProps, signalColor } from '../types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return `$${n.toFixed(2)}`
}

// Build an SVG polyline path from an array of price values
function buildPath(data: number[], w: number, h: number): string {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const margin = 20
  return data
    .map((v, i) => {
      const x = margin + ((i / (data.length - 1)) * (w - margin * 2))
      const y = h - margin - ((v - min) / range) * (h - margin * 2)
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
}

// ── Scene components ─────────────────────────────────────────────────────────

function HookScene() {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 20, 70, 89], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const translateY = interpolate(frame, [0, 20], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{ backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          textAlign: 'center',
          padding: '0 80px',
        }}
      >
        <p
          style={{
            color: COLORS.text,
            fontSize: 80,
            fontWeight: 900,
            fontFamily: 'Arial Black, Arial, sans-serif',
            lineHeight: 1.15,
          }}
        >
          Today's top signal just dropped 📈
        </p>
        <div
          style={{
            width: 80,
            height: 4,
            backgroundColor: COLORS.accent,
            borderRadius: 2,
            margin: '32px auto 0',
          }}
        />
      </div>
      <Watermark />
    </AbsoluteFill>
  )
}

function LogoScene() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const scale = spring({ fps, frame, config: { damping: 14, stiffness: 80 } })
  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{ backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}
    >
      <div style={{ textAlign: 'center', transform: `scale(${scale})`, opacity }}>
        <Logo size={64} style={{ justifyContent: 'center', marginBottom: 24 }} />
        <p
          style={{
            color: COLORS.muted,
            fontSize: 44,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 600,
            letterSpacing: '0.08em',
          }}
        >
          Data. Not hype.
        </p>
      </div>
      <Watermark />
    </AbsoluteFill>
  )
}

function SignalCardScene({ signal }: { signal: SignalReelProps }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Card slides up
  const cardY = interpolate(frame, [0, 20], [120, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const cardOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Confidence bar fills from 0 → actual value over 1.5 s starting at frame 20
  const barProgress = interpolate(
    frame,
    [20, 20 + fps * 1.5],
    [0, signal.confidence],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  // Numbers count up
  const displayConf = Math.round(
    interpolate(frame, [20, 20 + fps * 1.5], [0, signal.confidence], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  )

  const badgeColor = signalColor(signal.signalType)
  const barColor   = signal.confidence >= 75 ? COLORS.buy : signal.confidence >= 50 ? COLORS.watch : COLORS.short

  return (
    <AbsoluteFill
      style={{ backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center', padding: '0 48px' }}
    >
      {/* Logo in top-left corner */}
      <div style={{ position: 'absolute', top: 60, left: 60 }}>
        <Logo size={30} />
      </div>

      {/* Card */}
      <div
        style={{
          width: '100%',
          backgroundColor: COLORS.surface,
          borderRadius: 32,
          border: `2px solid ${COLORS.accent}44`,
          padding: '60px 56px',
          transform: `translateY(${cardY}px)`,
          opacity: cardOpacity,
        }}
      >
        {/* Ticker + badge row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <p style={{ color: COLORS.text, fontSize: 88, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', lineHeight: 1 }}>
              {signal.ticker}
            </p>
            <p style={{ color: COLORS.muted, fontSize: 32, fontFamily: 'Arial, sans-serif', marginTop: 8 }}>
              {signal.companyName}
            </p>
          </div>
          <div
            style={{
              backgroundColor: `${badgeColor}22`,
              border: `2px solid ${badgeColor}`,
              borderRadius: 16,
              padding: '16px 32px',
            }}
          >
            <span style={{ color: badgeColor, fontSize: 40, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif' }}>
              {signal.signalType}
            </span>
          </div>
        </div>

        {/* Confidence */}
        <p style={{ color: COLORS.muted, fontSize: 28, fontFamily: 'Arial, sans-serif', marginBottom: 12 }}>
          Confidence
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 48 }}>
          <div style={{ flex: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${barProgress}%`,
                backgroundColor: barColor,
                borderRadius: 8,
                transition: 'width 0.05s linear',
              }}
            />
          </div>
          <span style={{ color: barColor, fontSize: 40, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', minWidth: 80, textAlign: 'right' }}>
            {displayConf}%
          </span>
        </div>

        {/* Price levels */}
        {[
          { label: 'Entry Zone', value: `${formatCurrency(signal.entryZoneLow)} – ${formatCurrency(signal.entryZoneHigh)}`, color: COLORS.text },
          { label: 'Target',     value: formatCurrency(signal.targetPrice),  color: COLORS.buy },
          { label: 'Stop Loss',  value: formatCurrency(signal.stopLoss),     color: COLORS.short },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
            <span style={{ color: COLORS.muted, fontSize: 28, fontFamily: 'Arial, sans-serif' }}>{label}</span>
            <span style={{ color, fontSize: 36, fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>{value}</span>
          </div>
        ))}
      </div>

      <Watermark />
    </AbsoluteFill>
  )
}

function ChartScene({ priceHistory }: { priceHistory: number[] }) {
  const frame = useCurrentFrame()
  const chartW = 984  // 1080 - 96px padding
  const chartH = 500

  // Clip grows left → right over 7 s (210 frames)
  const clipWidth = interpolate(frame, [0, 210], [0, chartW], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const path = buildPath(priceHistory, chartW, chartH)
  const last  = priceHistory[priceHistory.length - 1]
  const first = priceHistory[0]
  const isUp  = last >= first

  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{ backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center', padding: '0 48px', opacity }}
    >
      <div style={{ position: 'absolute', top: 60, left: 60 }}>
        <Logo size={30} />
      </div>

      <div style={{ width: '100%' }}>
        <p style={{ color: COLORS.muted, fontSize: 30, fontFamily: 'Arial, sans-serif', marginBottom: 16 }}>
          30-Day Price History
        </p>

        {/* SVG chart with animated clip */}
        <div style={{ position: 'relative', width: chartW, height: chartH }}>
          {/* Clip mask growing from left */}
          <svg width={chartW} height={chartH} style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <clipPath id="grow">
                <rect x={0} y={0} width={clipWidth} height={chartH} />
              </clipPath>
            </defs>
            {/* Gradient fill under the line */}
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isUp ? COLORS.buy : COLORS.short} stopOpacity={0.3} />
                <stop offset="100%" stopColor={isUp ? COLORS.buy : COLORS.short} stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* Area fill (approximate) */}
            <path
              d={`${path} L ${chartW - 20} ${chartH - 20} L 20 ${chartH - 20} Z`}
              fill="url(#areaGrad)"
              clipPath="url(#grow)"
            />
            {/* Price line */}
            <path
              d={path}
              fill="none"
              stroke={isUp ? COLORS.buy : COLORS.short}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              clipPath="url(#grow)"
            />
          </svg>
        </div>

        {/* Change label */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <span style={{ color: isUp ? COLORS.buy : COLORS.short, fontSize: 36, fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>
            {isUp ? '+' : ''}{(((last - first) / first) * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      <Watermark />
    </AbsoluteFill>
  )
}

// ── Root composition ─────────────────────────────────────────────────────────

export const SignalReel: React.FC<SignalReelProps> = (props) => {
  return (
    <>
      <Sequence from={0} durationInFrames={90}>
        <HookScene />
      </Sequence>
      <Sequence from={90} durationInFrames={150}>
        <LogoScene />
      </Sequence>
      <Sequence from={240} durationInFrames={360}>
        <SignalCardScene signal={props} />
      </Sequence>
      <Sequence from={600} durationInFrames={210}>
        <ChartScene priceHistory={props.priceHistory} />
      </Sequence>
      <Sequence from={810} durationInFrames={90}>
        <CTAScreen
          startFrame={810}
          headline="See all signals free at holoture.com"
        />
      </Sequence>
    </>
  )
}
