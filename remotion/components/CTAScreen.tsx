import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { Logo, Watermark } from './Logo'
import { COLORS } from '../types'

interface CTAScreenProps {
  /** Frame at which this CTA begins appearing */
  startFrame: number
  headline: string
}

/** Final CTA slide — shared by all compositions */
export function CTAScreen({ startFrame, headline }: CTAScreenProps) {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [startFrame, startFrame + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        justifyContent: 'center',
        alignItems: 'center',
        opacity,
      }}
    >
      {/* Radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 70% 50% at 50% 50%, ${COLORS.accent}22 0%, transparent 70%)`,
        }}
      />

      <div style={{ textAlign: 'center', padding: '0 80px', position: 'relative' }}>
        <Logo size={48} style={{ justifyContent: 'center', marginBottom: 48 }} />

        <p
          style={{
            color: COLORS.text,
            fontSize: 52,
            fontWeight: 800,
            fontFamily: 'Arial Black, Arial, sans-serif',
            lineHeight: 1.2,
            marginBottom: 32,
          }}
        >
          {headline}
        </p>

        <div
          style={{
            display: 'inline-block',
            backgroundColor: COLORS.accent,
            color: '#fff',
            fontSize: 36,
            fontWeight: 700,
            fontFamily: 'Arial, sans-serif',
            padding: '18px 52px',
            borderRadius: 100,
          }}
        >
          holoture.com
        </div>
      </div>

      <Watermark />
    </AbsoluteFill>
  )
}
