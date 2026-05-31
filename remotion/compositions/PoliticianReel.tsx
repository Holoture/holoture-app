/**
 * Template 2 — Politician Trade Reel
 * 30 seconds · 30 fps · 1080 × 1920 (vertical)
 *
 * Timeline:
 *  0–3 s   (0–89)    Hook
 *  3–10 s  (90–299)  Politician name + party badge
 *  10–20 s (300–599) Trade details animate in
 *  20–27 s (600–809) AI commentary types out character-by-character
 *  27–30 s (810–899) CTA
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
import { COLORS, PoliticianReelProps, partyColor } from '../types'

// ── Scene components ─────────────────────────────────────────────────────────

function HookScene() {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 20, 70, 89], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const translateY = interpolate(frame, [0, 20], [50, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ opacity, transform: `translateY(${translateY}px)`, textAlign: 'center', padding: '0 80px' }}>
        <p style={{
          color: COLORS.text,
          fontSize: 80,
          fontWeight: 900,
          fontFamily: 'Arial Black, Arial, sans-serif',
          lineHeight: 1.15,
        }}>
          Congress just made these trades 👀
        </p>
      </div>
      <Watermark />
    </AbsoluteFill>
  )
}

function PoliticianScene({ name, party }: { name: string; party: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const scale = spring({ fps, frame, config: { damping: 12, stiffness: 90 } })
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const pColor = partyColor(party)
  const partyLabel = party === 'Democrat' ? 'DEM' : party === 'Republican' ? 'REP' : 'IND'

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center', padding: '0 60px' }}>
      <div style={{ position: 'absolute', top: 60, left: 60 }}>
        <Logo size={30} />
      </div>

      <div style={{ textAlign: 'center', transform: `scale(${scale})`, opacity }}>
        {/* Party badge */}
        <div style={{
          display: 'inline-block',
          backgroundColor: `${pColor}22`,
          border: `2px solid ${pColor}`,
          borderRadius: 16,
          padding: '12px 36px',
          marginBottom: 36,
        }}>
          <span style={{ color: pColor, fontSize: 40, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif' }}>
            {partyLabel}
          </span>
        </div>

        {/* Name */}
        <p style={{
          color: COLORS.text,
          fontSize: 72,
          fontWeight: 900,
          fontFamily: 'Arial Black, Arial, sans-serif',
          lineHeight: 1.1,
        }}>
          {name}
        </p>
        <p style={{ color: COLORS.muted, fontSize: 36, fontFamily: 'Arial, sans-serif', marginTop: 12 }}>
          Member of Congress
        </p>
      </div>

      <Watermark />
    </AbsoluteFill>
  )
}

function TradeDetailsScene({ props }: { props: PoliticianReelProps }) {
  const frame = useCurrentFrame()
  const isBuy = /purchase|buy/i.test(props.tradeType)
  const badgeColor = isBuy ? COLORS.buy : COLORS.short

  const rows = [
    { label: 'Stock',   value: `${props.ticker} — ${props.companyName}` },
    { label: 'Action',  value: isBuy ? 'Purchase' : 'Sale' },
    { label: 'Amount',  value: props.amountRange },
    { label: 'Filed',   value: new Date(props.transactionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
  ]

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center', padding: '0 48px' }}>
      <div style={{ position: 'absolute', top: 60, left: 60 }}>
        <Logo size={30} />
      </div>

      <div style={{ width: '100%' }}>
        {/* Trade badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 16,
          backgroundColor: `${badgeColor}22`,
          border: `2px solid ${badgeColor}`,
          borderRadius: 16,
          padding: '12px 32px',
          marginBottom: 48,
        }}>
          <span style={{ color: badgeColor, fontSize: 44, fontWeight: 900, fontFamily: 'Arial Black, Arial, sans-serif' }}>
            {isBuy ? '▲ PURCHASE' : '▼ SALE'}
          </span>
        </div>

        {/* Detail rows */}
        {rows.map(({ label, value }, i) => {
          const entryOpacity = interpolate(frame, [i * 15, i * 15 + 20], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
          const entryX = interpolate(frame, [i * 15, i * 15 + 20], [-40, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
          return (
            <div
              key={label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                paddingBottom: 24,
                marginBottom: 24,
                opacity: entryOpacity,
                transform: `translateX(${entryX}px)`,
              }}
            >
              <span style={{ color: COLORS.muted, fontSize: 30, fontFamily: 'Arial, sans-serif' }}>{label}</span>
              <span style={{ color: COLORS.text, fontSize: 36, fontWeight: 700, fontFamily: 'Arial, sans-serif', maxWidth: '60%', textAlign: 'right' }}>{value}</span>
            </div>
          )
        })}
      </div>

      <Watermark />
    </AbsoluteFill>
  )
}

function CommentaryScene({ text }: { text: string }) {
  const frame = useCurrentFrame()

  // Type out at 20 characters per second (≈ 0.67 chars/frame at 30fps)
  const charsPerFrame = 20 / 30
  const visible = Math.min(Math.floor(frame * charsPerFrame), text.length)
  const displayedText = text.slice(0, visible)

  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center', padding: '0 60px', opacity }}>
      <div style={{ position: 'absolute', top: 60, left: 60 }}>
        <Logo size={30} />
      </div>

      <div>
        <p style={{ color: COLORS.accent, fontSize: 28, fontFamily: 'Arial, sans-serif', fontWeight: 600, marginBottom: 24, letterSpacing: '0.08em' }}>
          AI ANALYSIS
        </p>
        <p style={{
          color: COLORS.text,
          fontSize: 44,
          fontFamily: 'Arial, sans-serif',
          lineHeight: 1.5,
          minHeight: 400,
        }}>
          {displayedText}
          <span style={{ opacity: frame % 30 < 15 ? 1 : 0, color: COLORS.accent }}>|</span>
        </p>
      </div>

      <Watermark />
    </AbsoluteFill>
  )
}

// ── Root composition ─────────────────────────────────────────────────────────

export const PoliticianReel: React.FC<PoliticianReelProps> = (props) => {
  return (
    <>
      <Sequence from={0} durationInFrames={90}>
        <HookScene />
      </Sequence>
      <Sequence from={90} durationInFrames={210}>
        <PoliticianScene name={props.politicianName} party={props.party} />
      </Sequence>
      <Sequence from={300} durationInFrames={300}>
        <TradeDetailsScene props={props} />
      </Sequence>
      <Sequence from={600} durationInFrames={210}>
        <CommentaryScene text={props.aiCommentary} />
      </Sequence>
      <Sequence from={810} durationInFrames={90}>
        <CTAScreen startFrame={810} headline="Track every congressional trade at holoture.com" />
      </Sequence>
    </>
  )
}
