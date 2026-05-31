import React from 'react'
import { COLORS } from '../types'

interface LogoProps {
  size?: number
  style?: React.CSSProperties
}

/** Holoture wordmark — used in every composition corner */
export function Logo({ size = 32, style }: LogoProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: size * 0.3,
        ...style,
      }}
    >
      {/* Square icon mark */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.18,
          backgroundColor: COLORS.accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: '#fff', fontWeight: 900, fontSize: size * 0.55, fontFamily: 'Arial, sans-serif' }}>
          H
        </span>
      </div>

      {/* Wordmark */}
      <span
        style={{
          color: COLORS.text,
          fontWeight: 800,
          fontSize: size,
          fontFamily: 'Arial Black, Arial, sans-serif',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        Holo<span style={{ color: COLORS.accent }}>ture</span>
      </span>
    </div>
  )
}

/** Bottom-of-frame watermark with holoture.com */
export function Watermark({ opacity = 0.7 }: { opacity?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 60,
        left: 0,
        right: 0,
        textAlign: 'center',
        opacity,
      }}
    >
      <span
        style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: 28,
          fontFamily: 'Arial, sans-serif',
          fontWeight: 600,
          letterSpacing: '0.04em',
        }}
      >
        holoture.com
      </span>
    </div>
  )
}
