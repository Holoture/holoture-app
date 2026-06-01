/**
 * SceneHeader — persistent top bar on every scene in every composition.
 * Logo left, holoture.com right, subtle gradient fade so it sits above any BG.
 */
import React from 'react'
import { COLORS } from '../types'

export function SceneHeader() {
  return (
    <div
      style={{
        position:   'absolute',
        top:        0,
        left:       0,
        right:      0,
        height:     110,
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding:    '0 64px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)',
        zIndex:     10,
      }}
    >
      {/* ── Holoture wordmark ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Square icon tile */}
        <div
          style={{
            width:           52,
            height:          52,
            borderRadius:    12,
            backgroundColor: COLORS.accent,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            flexShrink:      0,
          }}
        >
          <span
            style={{
              color:      '#fff',
              fontWeight: 900,
              fontSize:   30,
              fontFamily: 'Arial Black, Arial, sans-serif',
              lineHeight: 1,
            }}
          >
            H
          </span>
        </div>

        {/* Wordmark */}
        <span
          style={{
            color:       '#fff',
            fontWeight:  900,
            fontSize:    40,
            fontFamily:  'Arial Black, Arial, sans-serif',
            letterSpacing: '-0.02em',
            lineHeight:  1,
          }}
        >
          Holo
          <span style={{ color: COLORS.accent }}>ture</span>
        </span>
      </div>

      {/* ── Domain pill ── */}
      <div
        style={{
          backgroundColor: 'rgba(255,255,255,0.08)',
          border:          '1px solid rgba(255,255,255,0.18)',
          borderRadius:    100,
          padding:         '10px 28px',
        }}
      >
        <span
          style={{
            color:       'rgba(255,255,255,0.75)',
            fontSize:    26,
            fontFamily:  'Arial, sans-serif',
            fontWeight:  600,
            letterSpacing: '0.02em',
          }}
        >
          holoture.com
        </span>
      </div>
    </div>
  )
}
