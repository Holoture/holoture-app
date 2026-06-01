/**
 * Template 4 — Sector Trends Reel
 * 12 seconds · 30 fps · 1080 × 1920 (vertical)
 *
 * Timeline:
 *  0–1.5 s (0–44)    Hook
 *  1.5–10 s (45–299) All sectors visible with staggered bar animations
 *  10–12 s  (300–359) Market summary + CTA
 */

import React from 'react'
import {
  AbsoluteFill, Sequence,
  interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion'
import { SceneHeader } from '../components/SceneHeader'
import { COLORS, SectorTrendsProps } from '../types'

// Sort sectors: biggest movers first (absolute change)
function sortSectors(sectors: SectorTrendsProps['sectors']) {
  return [...sectors].sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
}

// ── Scenes ─────────────────────────────────────────────────────────────────────

function HookScene() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const scale  = spring({ fps, frame, config: { damping: 10, stiffness: 130 } })
  const opacity = interpolate(frame, [0, 8, 36, 44], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 50% at 50% 50%, rgba(251,191,36,0.18) 0%, transparent 70%)` }} />
      <SceneHeader />
      <div style={{ textAlign: 'center', padding: '0 72px', transform: `scale(${scale})`, opacity }}>
        <p style={{ fontSize: 96, lineHeight: 1, marginBottom: 16 }}>📊</p>
        <p style={{ color: COLORS.text, fontSize: 72, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', lineHeight: 1.1 }}>
          Here's where the market is moving today
        </p>
      </div>
    </AbsoluteFill>
  )
}

function SectorsScene({ sectors, marketSummary }: SectorTrendsProps) {
  const frame   = useCurrentFrame()
  const { fps } = useVideoConfig()
  const sorted  = sortSectors(sectors)
  const maxAbs  = Math.max(...sorted.map(s => Math.abs(s.change)), 0.01)

  const STAGGER = 18  // frames between each sector row

  // Summary fades in after all bars are done
  const summaryOpacity = interpolate(frame, [sorted.length * STAGGER + 30, sorted.length * STAGGER + 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, padding: '120px 56px 60px' }}>
      <SceneHeader />

      <p style={{
        color:         'rgba(255,255,255,0.4)',
        fontSize:      24,
        fontFamily:    'Arial, sans-serif',
        fontWeight:    700,
        letterSpacing: '0.1em',
        marginBottom:  20,
        marginTop:     12,
      }}>
        SECTOR PERFORMANCE TODAY
      </p>

      {/* Sector rows */}
      {sorted.map((s, i) => {
        const delay   = i * STAGGER
        const rowOp   = interpolate(frame, [delay, delay + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        const rowY    = interpolate(frame, [delay, delay + 14], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        const barFill = interpolate(frame, [delay + 8, delay + 8 + fps * 0.5], [0, (Math.abs(s.change) / maxAbs) * 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        // Animated count-up for the percentage
        const countUp = interpolate(frame, [delay + 8, delay + 8 + fps * 0.5], [0, Math.abs(s.change)], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

        const color     = s.change >= 0 ? COLORS.buy : COLORS.short
        const prefix    = s.change >= 0 ? '+' : '-'
        const isWinner  = Math.abs(s.change) === maxAbs

        return (
          <div key={s.sector} style={{ opacity: rowOp, transform: `translateY(${rowY}px)`, marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 28, fontFamily: 'Arial, sans-serif', fontWeight: 600 }}>
                  {s.sector}
                </span>
                {isWinner && (
                  <span style={{ backgroundColor: `${color}22`, border: `1px solid ${color}`, borderRadius: 100, padding: '2px 14px', color, fontSize: 18, fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>
                    TOP MOVER
                  </span>
                )}
              </div>
              <span style={{ color, fontSize: 32, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', minWidth: 88, textAlign: 'right' }}>
                {prefix}{countUp.toFixed(2)}%
              </span>
            </div>
            <div style={{ height: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 7 }}>
              <div style={{ height: '100%', width: `${barFill}%`, backgroundColor: color, borderRadius: 7, opacity: 0.9 }} />
            </div>
          </div>
        )
      })}

      {/* Market summary */}
      {marketSummary && (
        <div style={{
          opacity:         summaryOpacity,
          marginTop:       24,
          backgroundColor: `${COLORS.accent}0E`,
          border:          `1px solid ${COLORS.accent}28`,
          borderRadius:    20,
          padding:         '20px 24px',
        }}>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 26, fontFamily: 'Arial, sans-serif', lineHeight: 1.5, margin: 0 }}>
            {marketSummary.length > 200 ? marketSummary.slice(0, 200) + '…' : marketSummary}
          </p>
        </div>
      )}
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
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 50% at 50% 50%, rgba(251,191,36,0.15) 0%, transparent 70%)` }} />
      <SceneHeader />
      <div style={{ textAlign: 'center', padding: '0 72px', transform: `scale(${scale})`, opacity }}>
        <p style={{ color: COLORS.text, fontSize: 64, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', lineHeight: 1.2, marginBottom: 36 }}>
          Full market trends dashboard — free on Holoture
        </p>
        <span style={{ backgroundColor: '#fbbf24', color: '#0F0F0F', fontSize: 36, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', padding: '18px 56px', borderRadius: 100 }}>
          holoture.com
        </span>
      </div>
    </AbsoluteFill>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────

export const SectorTrends: React.FC<SectorTrendsProps> = (props) => (
  <>
    <Sequence from={0}   durationInFrames={45}>  <HookScene /> </Sequence>
    <Sequence from={45}  durationInFrames={255}> <SectorsScene {...props} /> </Sequence>
    <Sequence from={300} durationInFrames={60}>  <CTAScene /> </Sequence>
  </>
)
