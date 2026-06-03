/**
 * PromoVideo — 40 s vertical iPhone promo (1080 × 1920, 30 fps)
 * Light mode · iPhone 15 Pro frame · TikTok / Reels / Shorts
 *
 * Frame timeline:
 *   0–89    Hook           3 s  — phone springs up, "trade with an edge"
 *   90–449  Signals        12 s — real signal-demo.mp4 inside phone
 *   420–809 Options        13 s — real option-signal-demo.mp4 (overlaps for swipe)
 *   780–1109 Politicians   11 s — real politician-demo.mp4 (overlaps for swipe)
 *   1110–1199 CTA          3 s  — bull logo + URL end card
 */

import React from 'react'
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

// ── Empty props — video content comes from screen recordings ──────────────────

export type PromoVideoProps = Record<string, never>
export const PROMO_FALLBACK: PromoVideoProps = {}

// ── Palette ────────────────────────────────────────────────────────────────────

const L = {
  text:    '#1A1A1A',
  accent:  '#009BFF',
  chassis: '#1C1C1E',
  screen:  '#FFFFFF',
  border:  '#E5E7EB',
} as const

// ── Layout ─────────────────────────────────────────────────────────────────────

const PHONE_W  = 600
const PHONE_H  = 1250
const BEZEL    = 13
const RADIUS   = 56
const SCR_W    = PHONE_W - BEZEL * 2   // 574
const SCR_H    = PHONE_H - BEZEL * 2   // 1224
const DI_H     = 62                    // space reserved for dynamic island
const CONT_H   = SCR_H - DI_H          // 1162 — video fill area
const VW       = 1080
const VH       = 1920
const PHONE_X  = (VW - PHONE_W) / 2   // 240
const PHONE_Y  = (VH - PHONE_H) / 2   // 335

const EO = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ip = (f: number, inp: number[], out: number[]) => interpolate(f, inp, out, EO)

// ── Transition boundaries ─────────────────────────────────────────────────────
//
//  hookEnd    = 90   — signals video starts
//  sig→opt    = 420  — swipe begins; options video starts simultaneously
//  opt→pol    = 780  — swipe begins; politicians video starts simultaneously
//  politEnd   = 1110 — CTA
//  SLIDE      = 30   — 1 s swipe animation

const hookEnd  = 90
const swipe1   = 420
const swipe2   = 780
const politEnd = 1110
const SLIDE    = 30

// ── iPhone Frame ───────────────────────────────────────────────────────────────

function IPhoneFrame({
  translateY,
  opacity,
  children,
}: {
  translateY: number
  opacity: number
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: PHONE_X,
        top: PHONE_Y,
        width: PHONE_W,
        height: PHONE_H,
        transform: `translateY(${translateY}px)`,
        opacity,
        borderRadius: RADIUS,
        backgroundColor: L.chassis,
        boxShadow: [
          '0 0 0 1.5px rgba(255,255,255,0.09) inset',
          '0 50px 140px rgba(0,80,200,0.22)',
          '0 20px 60px rgba(0,0,0,0.28)',
        ].join(', '),
        overflow: 'hidden',
      }}
    >
      {/* Screen glass */}
      <div
        style={{
          position: 'absolute',
          top: BEZEL, left: BEZEL,
          width: SCR_W, height: SCR_H,
          borderRadius: RADIUS - BEZEL,
          backgroundColor: L.screen,
          overflow: 'hidden',
        }}
      >
        {/* Dynamic island */}
        <div
          style={{
            position: 'absolute',
            top: 14, left: '50%',
            transform: 'translateX(-50%)',
            width: 128, height: 36,
            backgroundColor: L.chassis,
            borderRadius: 18,
            zIndex: 200,
          }}
        />

        {/* Time */}
        <div
          style={{
            position: 'absolute',
            top: 18, left: 28,
            fontSize: 17, fontWeight: 700,
            color: L.text,
            fontFamily: 'Arial, sans-serif',
            zIndex: 201,
          }}
        >
          9:41
        </div>

        {/* Video content area */}
        <div
          style={{
            position: 'absolute',
            top: DI_H, left: 0,
            width: SCR_W, height: CONT_H,
            overflow: 'hidden',
            backgroundColor: L.screen,
          }}
        >
          {children}
        </div>
      </div>

      {/* Side buttons */}
      <div style={{ position: 'absolute', left: -3, top: 200, width: 4, height: 70, backgroundColor: '#2A2A2C', borderRadius: '2px 0 0 2px' }} />
      <div style={{ position: 'absolute', left: -3, top: 290, width: 4, height: 70, backgroundColor: '#2A2A2C', borderRadius: '2px 0 0 2px' }} />
      <div style={{ position: 'absolute', right: -3, top: 260, width: 4, height: 115, backgroundColor: '#2A2A2C', borderRadius: '0 2px 2px 0' }} />
    </div>
  )
}

// ── Phone screen content — 3 videos side by side, CSS slide transition ─────────

function PhoneScreens() {
  const frame = useCurrentFrame()

  // Slide left into options at swipe1, then into politicians at swipe2
  const slideX = interpolate(
    frame,
    [swipe1, swipe1 + SLIDE, swipe2, swipe2 + SLIDE],
    [0, -SCR_W, -SCR_W, -SCR_W * 2],
    EO,
  )

  const videoStyle: React.CSSProperties = {
    width: SCR_W,
    height: CONT_H,
    objectFit: 'cover' as const,
    display: 'block',
  }

  return (
    <div
      style={{
        display: 'flex',
        width: SCR_W * 3,
        height: CONT_H,
        transform: `translateX(${slideX}px)`,
      }}
    >
      {/* Screen 1 — Signals */}
      <div style={{ width: SCR_W, height: CONT_H, flexShrink: 0, backgroundColor: L.screen }}>
        {/* Active frames 90–449: covers full signals section + swipe-out period */}
        <Sequence from={hookEnd} durationInFrames={360}>
          <OffthreadVideo src={staticFile('signal-demo.mp4')} style={videoStyle} />
        </Sequence>
      </div>

      {/* Screen 2 — Options */}
      <div style={{ width: SCR_W, height: CONT_H, flexShrink: 0, backgroundColor: L.screen }}>
        {/* Starts at swipe1 so it's live from the moment it slides in */}
        <Sequence from={swipe1} durationInFrames={390}>
          <OffthreadVideo src={staticFile('option-signal-demo.mp4')} style={videoStyle} />
        </Sequence>
      </div>

      {/* Screen 3 — Politicians */}
      <div style={{ width: SCR_W, height: CONT_H, flexShrink: 0, backgroundColor: L.screen }}>
        {/* Starts at swipe2 so it's live from the moment it slides in */}
        <Sequence from={swipe2} durationInFrames={330}>
          <OffthreadVideo src={staticFile('politician-demo.mp4')} style={videoStyle} />
        </Sequence>
      </div>
    </div>
  )
}

// ── Corner logo ────────────────────────────────────────────────────────────────

function CornerLogo({ opacity }: { opacity: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 64, left: 64,
        display: 'flex', alignItems: 'center', gap: 14,
        opacity,
      }}
    >
      <Img
        src={staticFile('bull-logo.png')}
        style={{ width: 48, height: 48, objectFit: 'contain' }}
      />
      <span
        style={{
          fontSize: 28, fontWeight: 800, color: L.text,
          fontFamily: 'Arial Black, Arial, sans-serif',
          letterSpacing: '-0.02em',
        }}
      >
        Holo<span style={{ color: L.accent }}>ture</span>
      </span>
    </div>
  )
}

// ── Root composition ───────────────────────────────────────────────────────────

export const PromoVideo: React.FC<PromoVideoProps> = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Phone springs up from below on first frame
  const entranceSpring = spring({ fps, frame, config: { damping: 18, stiffness: 75, mass: 1.3 } })
  const entranceY = ip(entranceSpring, [0, 1], [780, 0])

  // Gentle float throughout
  const floatY = Math.sin(frame * 0.025) * 9

  // Phone fades out going into CTA
  const phoneOpacity = ip(frame, [politEnd + 20, politEnd + 55], [1, 0])

  // Combined phone vertical position
  const phoneY = entranceY + floatY

  // Hook text
  const hookOp = ip(frame, [8, 22, 72, 88], [0, 1, 1, 0])
  const hookY  = ip(frame, [8, 22], [28, 0])

  // Corner logo: fade in early, fade out just before CTA
  const logoOp = ip(frame, [5, 28, politEnd + 10, politEnd + 45], [0, 1, 1, 0])

  // CTA
  const ctaLogoSp  = spring({ fps, frame: Math.max(0, frame - (politEnd + 20)), config: { damping: 12, stiffness: 95 } })
  const ctaTextOp  = ip(frame, [politEnd + 42, politEnd + 65], [0, 1])

  return (
    <AbsoluteFill
      style={{ background: 'linear-gradient(155deg, #E6EEFF 0%, #F2F6FF 45%, #EBF0FF 100%)' }}
    >
      {/* Soft radial glow behind phone */}
      <div
        style={{
          position: 'absolute',
          left: '50%', top: '46%',
          transform: 'translate(-50%, -50%)',
          width: 900, height: 1500,
          background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,155,255,0.13) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Corner wordmark */}
      <CornerLogo opacity={logoOp} />

      {/* Hook text — "trade with an edge" */}
      {frame < hookEnd + 5 && (
        <div
          style={{
            position: 'absolute',
            top: 175, left: 0, right: 0,
            textAlign: 'center',
            padding: '0 80px',
            opacity: hookOp,
            transform: `translateY(${hookY}px)`,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: L.text,
              fontFamily: 'Arial Black, Arial, sans-serif',
              lineHeight: 1.1,
            }}
          >
            trade with<br />
            <span style={{ color: L.accent }}>an edge</span>
          </div>
        </div>
      )}

      {/* iPhone */}
      {phoneOpacity > 0 && (
        <IPhoneFrame translateY={phoneY} opacity={phoneOpacity}>
          <PhoneScreens />
        </IPhoneFrame>
      )}

      {/* CTA end card */}
      {frame >= politEnd + 10 && (
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 44,
          }}
        >
          {/* Bull logo + wordmark */}
          <div
            style={{
              transform: `scale(${ctaLogoSp})`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
            }}
          >
            <Img
              src={staticFile('bull-logo.png')}
              style={{ width: 160, height: 160, objectFit: 'contain' }}
            />
            <span
              style={{
                fontSize: 58, fontWeight: 900, color: L.text,
                fontFamily: 'Arial Black, Arial, sans-serif', letterSpacing: '-0.02em',
              }}
            >
              Holo<span style={{ color: L.accent }}>ture</span>
            </span>
          </div>

          {/* URL + button */}
          <div
            style={{
              opacity: ctaTextOp,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22,
            }}
          >
            <span
              style={{
                fontSize: 36, fontWeight: 600,
                color: 'rgba(26,26,26,0.55)',
                fontFamily: 'Arial, sans-serif',
              }}
            >
              Start free — holoture.com
            </span>
            <div
              style={{
                backgroundColor: L.accent,
                padding: '24px 80px', borderRadius: 100,
                boxShadow: `0 14px 44px rgba(0,155,255,0.38)`,
              }}
            >
              <span
                style={{
                  fontSize: 42, fontWeight: 900, color: '#FFF',
                  fontFamily: 'Arial Black, Arial, sans-serif',
                }}
              >
                Try Free →
              </span>
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  )
}
