/**
 * Template 2 — Politician Trade Reel
 * 15 seconds · 30 fps · 1080 × 1920 (vertical)
 *
 * Timeline:
 *  0–2 s   (0–59)    Hook
 *  2–7 s   (60–209)  Politician profile + trade details
 *  7–13 s  (210–389) AI commentary typewriter + significance
 *  13–15 s (390–449) CTA
 */

import React from 'react'
import {
  AbsoluteFill, Sequence,
  interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion'
import { SceneHeader } from '../components/SceneHeader'
import { COLORS, PoliticianReelProps, partyColor } from '../types'

// ── Scenes ─────────────────────────────────────────────────────────────────────

function HookScene() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const scale  = spring({ fps, frame, config: { damping: 10, stiffness: 120 } })
  const opacity = interpolate(frame, [0, 10, 50, 59], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(167,139,250,0.2) 0%, transparent 70%)' }} />
      <SceneHeader />
      <div style={{ textAlign: 'center', padding: '0 72px', transform: `scale(${scale})`, opacity }}>
        <p style={{ fontSize: 96, lineHeight: 1, marginBottom: 16 }}>🏛️</p>
        <p style={{ color: COLORS.text, fontSize: 76, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', lineHeight: 1.1 }}>
          Congress just made these trades
        </p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 32, fontFamily: 'Arial, sans-serif', marginTop: 20 }}>
          They had to disclose this. We found it.
        </p>
      </div>
    </AbsoluteFill>
  )
}

function TradeScene({ p }: { p: PoliticianReelProps }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const isBuy      = /purchase|buy/i.test(p.tradeType)
  const badgeColor = isBuy ? COLORS.buy : COLORS.short
  const pColor     = partyColor(p.party)
  const partyLabel = p.party === 'Democrat' ? 'DEM' : p.party === 'Republican' ? 'REP' : 'IND'

  // Elements animate in with staggered springs
  const el = (delay: number) => {
    const s = spring({ fps, frame: frame - delay, config: { damping: 14, stiffness: 90 } })
    const op = interpolate(frame, [delay, delay + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    return { transform: `translateY(${(1 - s) * 40}px)`, opacity: op }
  }

  const tradedDate = new Date(p.transactionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, padding: '120px 56px 60px' }}>
      <SceneHeader />

      {/* Party + name */}
      <div style={{ ...el(0), marginTop: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 12 }}>
          <span style={{ backgroundColor: `${pColor}22`, border: `2px solid ${pColor}`, borderRadius: 12, padding: '8px 24px', color: pColor, fontSize: 32, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif' }}>
            {partyLabel}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 26, fontFamily: 'Arial, sans-serif' }}>
            Congress — {p.party}
          </span>
        </div>
        <p style={{ color: COLORS.text, fontSize: 64, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', lineHeight: 1.1, marginBottom: 0 }}>
          {p.politicianName}
        </p>
      </div>

      {/* Trade card */}
      <div style={{ ...el(10), backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 28, border: '1px solid rgba(255,255,255,0.1)', padding: '36px 40px', marginBottom: 20 }}>
        {/* Action badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ backgroundColor: `${badgeColor}20`, border: `2px solid ${badgeColor}`, borderRadius: 14, padding: '10px 28px' }}>
            <span style={{ color: badgeColor, fontSize: 42, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif' }}>
              {isBuy ? '▲ PURCHASE' : '▼ SALE'}
            </span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 26, fontFamily: 'Arial, sans-serif' }}>{tradedDate}</span>
        </div>

        {/* Details grid */}
        {[
          { label: 'Stock',   value: `${p.ticker}  ·  ${p.companyName}`, color: COLORS.text },
          { label: 'Amount',  value: p.amountRange,                        color: COLORS.accent },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 18, marginTop: 18 }}>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 28, fontFamily: 'Arial, sans-serif' }}>{label}</span>
            <span style={{ color, fontSize: 32, fontWeight: 700, fontFamily: 'Arial, sans-serif', maxWidth: '55%', textAlign: 'right' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Disclosure context */}
      <div style={{ ...el(20), backgroundColor: `${COLORS.accent}0F`, borderRadius: 20, border: `1px solid ${COLORS.accent}30`, padding: '20px 28px' }}>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 26, fontFamily: 'Arial, sans-serif', lineHeight: 1.5, margin: 0 }}>
          🔍 Required by the STOCK Act · All members of Congress must disclose trades within 45 days.
        </p>
      </div>
    </AbsoluteFill>
  )
}

function CommentaryScene({ p }: { p: PoliticianReelProps }) {
  const frame = useCurrentFrame()

  // Typewriter: 22 chars/sec
  const visible = Math.min(Math.floor(frame * (22 / 30)), p.aiCommentary.length)
  const blink   = frame % 30 < 15

  const headerOp = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, padding: '120px 56px 60px' }}>
      <SceneHeader />
      <div style={{ marginTop: 12 }}>
        <div style={{ opacity: headerOp }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, backgroundColor: `${COLORS.accent}18`, border: `1px solid ${COLORS.accent}40`, borderRadius: 100, padding: '8px 24px', marginBottom: 28 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: COLORS.accent }} />
            <span style={{ color: COLORS.accent, fontSize: 24, fontWeight: 700, fontFamily: 'Arial, sans-serif', letterSpacing: '0.08em' }}>
              AI ANALYSIS
            </span>
          </div>
        </div>

        <p style={{
          color:       COLORS.text,
          fontSize:    46,
          fontFamily:  'Arial, sans-serif',
          lineHeight:  1.5,
          minHeight:   420,
        }}>
          {p.aiCommentary.slice(0, visible)}
          {visible < p.aiCommentary.length && (
            <span style={{ opacity: blink ? 1 : 0, color: COLORS.accent }}>|</span>
          )}
        </p>

        {/* Holoture tracks all Congress trades */}
        <div style={{
          marginTop: 28,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '18px 28px',
          opacity: interpolate(frame, [80, 100], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 26, fontFamily: 'Arial, sans-serif', margin: 0 }}>
            🏛️ Holoture tracks every congressional stock disclosure in real time.
          </p>
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
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(167,139,250,0.2) 0%, transparent 70%)' }} />
      <SceneHeader />
      <div style={{ textAlign: 'center', padding: '0 72px', transform: `scale(${scale})`, opacity }}>
        <p style={{ color: COLORS.text, fontSize: 66, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif', lineHeight: 1.2, marginBottom: 40 }}>
          Track every congressional trade at holoture.com
        </p>
        <div style={{ backgroundColor: '#a78bfa', color: '#fff', fontSize: 38, fontWeight: 800, fontFamily: 'Arial Black, Arial, sans-serif', padding: '20px 60px', borderRadius: 100, display: 'inline-block' }}>
          Max Plan — holoture.com
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────

export const PoliticianReel: React.FC<PoliticianReelProps> = (props) => (
  <>
    <Sequence from={0}   durationInFrames={60}>  <HookScene /> </Sequence>
    <Sequence from={60}  durationInFrames={150}> <TradeScene p={props} /> </Sequence>
    <Sequence from={210} durationInFrames={180}> <CommentaryScene p={props} /> </Sequence>
    <Sequence from={390} durationInFrames={60}>  <CTAScene /> </Sequence>
  </>
)
