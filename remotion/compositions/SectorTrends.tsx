/**
 * Template 4 — Sector Trends Reel
 * 20 seconds · 30 fps · 1080 × 1920 (vertical)
 *
 * Timeline:
 *  0–3 s   (0–89)   Hook
 *  3–17 s  (90–509) Sectors animate in one-by-one with bars
 *  17–20 s (510–599) Market summary fades in + CTA overlay throughout
 */

import React from 'react'
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  Sequence,
} from 'remotion'
import { Logo, Watermark } from '../components/Logo'
import { COLORS, SectorTrendsProps } from '../types'

const FRAMES_PER_BAR = 30   // each sector animates in over ~1 s

function HookScene() {
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
        <p style={{
          color: COLORS.text,
          fontSize: 76,
          fontWeight: 900,
          fontFamily: 'Arial Black, Arial, sans-serif',
          lineHeight: 1.15,
        }}>
          Here's where the market is moving today 📊
        </p>
      </div>
      <Watermark />
    </AbsoluteFill>
  )
}

function SectorsScene({ sectors, marketSummary }: SectorTrendsProps) {
  const frame = useCurrentFrame()
  const maxAbs = Math.max(...sectors.map(s => Math.abs(s.change)), 0.01)

  // Market summary fades in at frame 420 (14 s into this scene = 17 s total)
  const summaryOpacity = interpolate(frame, [360, 390], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // CTA pill is always visible
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, padding: '120px 60px 160px' }}>
      <div style={{ position: 'absolute', top: 60, left: 60 }}>
        <Logo size={30} />
      </div>

      <p style={{ color: COLORS.accent, fontSize: 28, fontFamily: 'Arial, sans-serif', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 36, marginTop: 0 }}>
        SECTOR PERFORMANCE TODAY
      </p>

      {/* Sector bars */}
      {sectors.map((s, i) => {
        const entryStart = i * FRAMES_PER_BAR
        const barFill = interpolate(frame, [entryStart, entryStart + FRAMES_PER_BAR], [0, Math.abs(s.change)], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
        const rowOpacity = interpolate(frame, [entryStart, entryStart + 10], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
        const pct = (Math.abs(s.change) / maxAbs) * 100
        const color = s.change >= 0 ? COLORS.buy : COLORS.short

        return (
          <div key={s.sector} style={{ marginBottom: 22, opacity: rowOpacity }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: COLORS.muted, fontSize: 26, fontFamily: 'Arial, sans-serif' }}>{s.sector}</span>
              <span style={{ color, fontSize: 28, fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>
                {s.change >= 0 ? '+' : ''}{barFill.toFixed(2)}%
              </span>
            </div>
            <div style={{ height: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6 }}>
              <div style={{
                height: '100%',
                width: `${(Math.abs(s.change) / maxAbs) * 100}%`,
                backgroundColor: color,
                opacity: 0.85,
                borderRadius: 6,
              }} />
            </div>
          </div>
        )
      })}

      {/* Market summary */}
      {marketSummary && (
        <div style={{
          marginTop: 32,
          opacity: summaryOpacity,
          backgroundColor: `${COLORS.accent}12`,
          border: `1px solid ${COLORS.accent}30`,
          borderRadius: 20,
          padding: '24px 28px',
        }}>
          <p style={{ color: COLORS.text, fontSize: 28, fontFamily: 'Arial, sans-serif', lineHeight: 1.5, margin: 0 }}>
            {marketSummary.length > 180 ? marketSummary.slice(0, 180) + '…' : marketSummary}
          </p>
        </div>
      )}

      {/* Persistent CTA overlay at bottom */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        textAlign: 'center',
        padding: '24px 0 48px',
        background: 'linear-gradient(to bottom, transparent, rgba(15,15,15,0.95))',
      }}>
        <span style={{
          backgroundColor: COLORS.accent,
          color: '#fff',
          fontSize: 30,
          fontWeight: 700,
          fontFamily: 'Arial, sans-serif',
          padding: '14px 40px',
          borderRadius: 100,
        }}>
          Full dashboard at holoture.com
        </span>
      </div>
    </AbsoluteFill>
  )
}

// ── Root composition ─────────────────────────────────────────────────────────

export const SectorTrends: React.FC<SectorTrendsProps> = (props) => {
  return (
    <>
      <Sequence from={0} durationInFrames={90}>
        <HookScene />
      </Sequence>
      <Sequence from={90} durationInFrames={510}>
        <SectorsScene {...props} />
      </Sequence>
    </>
  )
}
