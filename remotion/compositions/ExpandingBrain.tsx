/**
 * ExpandingBrain — Holoture "expanding brain" meme
 *
 * Canvas : 1080 × 1080 px  (square, social-ready)
 * FPS    : 30
 * Length : 150 frames (5 seconds)
 *
 * Timeline:
 *   frame   0  — Panel 1 springs in (dim brain)
 *   frame  40  — Panel 2 springs in (medium glow)
 *   frame  80  — Panel 3 springs in (galaxy brain, rays + sparkles)
 *   frame 110+ — all panels held; galaxy brain pulses
 */

import React from 'react'
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { loadFont } from '@remotion/google-fonts/DMSans'

const { fontFamily: DM } = loadFont('normal', { weights: ['400', '700', '800'] })

// ── Layout ────────────────────────────────────────────────────────────────────
const W  = 1080
const PH = 360          // panel height  (W / 3)
const HW = W / 2        // half width — left=text, right=brain

// ── Helpers ───────────────────────────────────────────────────────────────────
const EO  = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ip  = (f: number, i: number[], o: number[]) => interpolate(f, i, o, EO)
const sp  = (fps: number, f: number) =>
  spring({ fps, frame: Math.max(0, f), config: { damping: 14, mass: 1.1, stiffness: 110 } })

// ── Panel text configs ────────────────────────────────────────────────────────
const PANELS = [
  {
    lines: ["Googling", "'ERR_SSL_VERSION_OR_CIPHER_MISMATCH fix'"],
    meme:  false,
  },
  {
    lines: ["Clearing cache and", "disabling browser shields"],
    meme:  false,
  },
  {
    lines: ["Diagnosing the exact", "TLS cipher negotiation", "failure like a network", "engineer"],
    meme:  true,   // Impact + outline
  },
]

// ══════════════════════════════════════════════════════════════════════════════
// BRAIN SVGs  (each fits inside a 540 × 360 viewport, brain centred at 270,175)
// ══════════════════════════════════════════════════════════════════════════════

/** Level 1 — small, dim, barely glowing */
function Brain1() {
  return (
    <svg width={HW} height={PH} viewBox={`0 0 ${HW} ${PH}`} style={{ display: 'block' }}>
      <defs>
        <radialGradient id="b1bg" cx="50%" cy="48%" r="50%">
          <stop offset="0%"   stopColor="#001a44" stopOpacity="1" />
          <stop offset="100%" stopColor="#000000" stopOpacity="1" />
        </radialGradient>
        <radialGradient id="b1glow" cx="50%" cy="46%" r="50%">
          <stop offset="0%"   stopColor="#0044aa" stopOpacity="0.45" />
          <stop offset="70%"  stopColor="#001133" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0"    />
        </radialGradient>
      </defs>

      {/* Background */}
      <rect width={HW} height={PH} fill="url(#b1bg)" />

      {/* Outer glow blob */}
      <ellipse cx="270" cy="175" rx="135" ry="145" fill="url(#b1glow)" />

      {/* Skull outline */}
      <ellipse cx="270" cy="170" rx="105" ry="118"
        fill="none" stroke="#1a4488" strokeWidth="2.5" opacity="0.55" />
      {/* Jaw */}
      <path d="M185,235 Q215,270 270,275 Q325,270 355,235"
        fill="none" stroke="#1a3366" strokeWidth="2" opacity="0.45" />

      {/* Dim brain ring */}
      <ellipse cx="270" cy="162" rx="72" ry="78"
        fill="none" stroke="#1e3a77" strokeWidth="2" opacity="0.40" />
      <ellipse cx="270" cy="162" rx="44" ry="48"
        fill="none" stroke="#22448a" strokeWidth="1.5" opacity="0.30" />

      {/* Very faint brain-fold lines */}
      <path d="M235,148 Q252,138 270,148 Q288,158 305,148"
        fill="none" stroke="#1a3366" strokeWidth="1.5" opacity="0.20" />
      <path d="M245,165 Q262,156 280,165"
        fill="none" stroke="#1a3366" strokeWidth="1"   opacity="0.15" />

      {/* Single dim neuron dot */}
      <circle cx="270" cy="162" r="4" fill="#1e5599" opacity="0.35" />
    </svg>
  )
}

/** Level 2 — medium brightness, active neurons, strong blue-cyan glow */
function Brain2() {
  const frame = useCurrentFrame()
  const pulse = 0.85 + Math.sin((frame - 40) * 0.18) * 0.10

  return (
    <svg width={HW} height={PH} viewBox={`0 0 ${HW} ${PH}`} style={{ display: 'block' }}>
      <defs>
        <radialGradient id="b2bg" cx="50%" cy="48%" r="55%">
          <stop offset="0%"   stopColor="#001833" stopOpacity="1" />
          <stop offset="100%" stopColor="#000000" stopOpacity="1" />
        </radialGradient>
        <radialGradient id="b2outer" cx="50%" cy="46%" r="55%">
          <stop offset="0%"   stopColor="#0088ee" stopOpacity={0.55 * pulse} />
          <stop offset="55%"  stopColor="#003388" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#000"    stopOpacity="0"    />
        </radialGradient>
        <radialGradient id="b2inner" cx="50%" cy="46%" r="40%">
          <stop offset="0%"   stopColor="#55ddff" stopOpacity={0.85 * pulse} />
          <stop offset="60%"  stopColor="#0066cc" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#000"    stopOpacity="0"    />
        </radialGradient>
      </defs>

      <rect width={HW} height={PH} fill="url(#b2bg)" />

      {/* Outer atmosphere */}
      <ellipse cx="270" cy="175" rx="165" ry="160" fill="url(#b2outer)" />

      {/* Skull */}
      <ellipse cx="270" cy="170" rx="108" ry="121"
        fill="none" stroke="#00aaff" strokeWidth="3" opacity={0.72 * pulse} />
      <path d="M182,238 Q215,276 270,280 Q325,276 358,238"
        fill="none" stroke="#0088dd" strokeWidth="2.5" opacity="0.60" />

      {/* Brain body glow */}
      <ellipse cx="270" cy="160" rx="82" ry="88" fill="url(#b2inner)" />

      {/* Concentric rings */}
      <ellipse cx="270" cy="160" rx="68" ry="74"
        fill="none" stroke="#00ccff" strokeWidth="2.5" opacity={0.60 * pulse} />
      <ellipse cx="270" cy="160" rx="48" ry="52"
        fill="none" stroke="#44eeff" strokeWidth="2.5" opacity={0.65 * pulse} />
      <ellipse cx="270" cy="160" rx="28" ry="30"
        fill="none" stroke="#88ffff" strokeWidth="2"   opacity="0.55" />

      {/* Brain fold lines */}
      <path d="M230,145 Q252,132 272,145 Q292,158 312,145"
        fill="none" stroke="#44bbdd" strokeWidth="2" opacity="0.40" />
      <path d="M240,165 Q262,153 282,165"
        fill="none" stroke="#33aacc" strokeWidth="1.5" opacity="0.35" />

      {/* Active neuron sparks */}
      {[
        [255, 148, 5, 0.90], [285, 143, 4, 0.80], [268, 172, 6.5, 1.00],
        [244, 170, 3, 0.70], [296, 167, 4, 0.75],
      ].map(([cx, cy, r, op], i) => (
        <circle key={i} cx={cx} cy={cy} r={r}
          fill="#00ffff" opacity={op * pulse} />
      ))}

      {/* Jaw */}
      <path d="M182,238 Q215,276 270,280 Q325,276 358,238"
        fill="none" stroke="#0066bb" strokeWidth="1.5" opacity="0.40" />
    </svg>
  )
}

/** Level 3 — full galaxy brain: blinding core, 16 rays, sparkle stars */
function Brain3() {
  const frame = useCurrentFrame()
  const rel   = Math.max(0, frame - 80)
  const pulse = 0.88 + Math.sin(rel * 0.22) * 0.10
  const spin  = rel * 0.8   // degrees — very slow ray shimmer

  const NUM_RAYS = 16
  const rays = Array.from({ length: NUM_RAYS }, (_, i) => {
    const angle  = (i / NUM_RAYS) * Math.PI * 2 + (spin * Math.PI / 180)
    const inner  = 88
    const outer  = 158 + (i % 4 === 0 ? 34 : i % 2 === 0 ? 18 : 8)
    const thick  = i % 4 === 0 ? 2.8 : i % 2 === 0 ? 1.8 : 1.2
    const op     = (i % 4 === 0 ? 0.95 : i % 2 === 0 ? 0.75 : 0.55) * pulse
    return {
      x1: 270 + Math.cos(angle) * inner,
      y1: 170 + Math.sin(angle) * inner,
      x2: 270 + Math.cos(angle) * outer,
      y2: 170 + Math.sin(angle) * outer,
      thick, op,
    }
  })

  const sparkles = [
    [270, 22, 3.5], [378, 52, 2.8], [152, 60, 3.2],
    [438, 172, 4.0], [100, 160, 2.8], [388, 278, 3.0],
    [148, 285, 3.5], [270, 330, 2.5], [424, 108, 2.2],
    [118, 108, 2.2], [450, 240, 2.8], [88, 240, 2.5],
  ] as [number, number, number][]

  return (
    <svg width={HW} height={PH} viewBox={`0 0 ${HW} ${PH}`} style={{ display: 'block' }}>
      <defs>
        <radialGradient id="b3atm" cx="50%" cy="47%" r="58%">
          <stop offset="0%"   stopColor="#aaeeff" stopOpacity={0.30 * pulse} />
          <stop offset="40%"  stopColor="#2266ff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0"    />
        </radialGradient>
        <radialGradient id="b3brain" cx="50%" cy="47%" r="38%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="30%"  stopColor="#88eeff" stopOpacity="0.90" />
          <stop offset="65%"  stopColor="#0077ff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#000022" stopOpacity="0"    />
        </radialGradient>
        <radialGradient id="b3core" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="1"    />
          <stop offset="100%" stopColor="#aaffff" stopOpacity="0.85" />
        </radialGradient>
        <filter id="b3blur">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Black background */}
      <rect width={HW} height={PH} fill="#000000" />

      {/* Wide atmosphere glow */}
      <ellipse cx="270" cy="170" rx="230" ry="200" fill="url(#b3atm)" />

      {/* Soft ray glow layer (blurred) */}
      <g filter="url(#b3blur)" opacity={0.45 * pulse}>
        {rays.filter((_, i) => i % 4 === 0).map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
            stroke="#ffffff" strokeWidth={r.thick * 5} strokeLinecap="round" />
        ))}
      </g>

      {/* Sharp light rays */}
      {rays.map((r, i) => (
        <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
          stroke="#ffffff" strokeWidth={r.thick} strokeLinecap="round" opacity={r.op} />
      ))}

      {/* Brain glow body */}
      <ellipse cx="270" cy="165" rx="105" ry="115" fill="url(#b3brain)" />

      {/* Skull — brilliant white */}
      <ellipse cx="270" cy="168" rx="108" ry="122"
        fill="none" stroke="#ffffff" strokeWidth="4" opacity={0.90 * pulse} />
      <path d="M182,242 Q215,280 270,284 Q325,280 358,242"
        fill="none" stroke="#ccffff" strokeWidth="3" opacity="0.75" />

      {/* Concentric rings */}
      <ellipse cx="270" cy="160" rx="85" ry="92"
        fill="none" stroke="#ffffff" strokeWidth="3.5" opacity={0.75 * pulse} />
      <ellipse cx="270" cy="160" rx="62" ry="68"
        fill="none" stroke="#aaffff" strokeWidth="3"   opacity={0.80 * pulse} />
      <ellipse cx="270" cy="160" rx="40" ry="44"
        fill="none" stroke="#ffffff" strokeWidth="3"   opacity={0.82 * pulse} />
      <ellipse cx="270" cy="160" rx="22" ry="24"
        fill="none" stroke="#ffffff" strokeWidth="2.5" opacity="0.90" />

      {/* Brain folds — bright */}
      <path d="M226,140 Q250,126 272,140 Q294,154 318,140"
        fill="none" stroke="#88eeff" strokeWidth="2.5" opacity="0.55" />
      <path d="M237,162 Q262,148 287,162"
        fill="none" stroke="#aaffff" strokeWidth="2"   opacity="0.50" />

      {/* Blazing core */}
      <circle cx="270" cy="162" r="22" fill="url(#b3core)" opacity={pulse} />
      <circle cx="270" cy="162" r="11" fill="#ffffff" />
      <circle cx="270" cy="162" r="5"  fill="#ffffff" />

      {/* Sparkle stars at ray tips */}
      {sparkles.map(([sx, sy, sr], i) => (
        <g key={i} opacity={0.88 * pulse}>
          <circle cx={sx} cy={sy} r={sr} fill="#ffffff" />
          <line x1={sx - sr * 2.8} y1={sy}         x2={sx + sr * 2.8} y2={sy}
            stroke="#ffffff" strokeWidth="0.9" />
          <line x1={sx}         y1={sy - sr * 2.8} x2={sx}         y2={sy + sr * 2.8}
            stroke="#ffffff" strokeWidth="0.9" />
        </g>
      ))}
    </svg>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PANEL
// ══════════════════════════════════════════════════════════════════════════════

function Panel({
  idx, startFrame, BrainComponent,
}: {
  idx:           number
  startFrame:    number
  BrainComponent: () => React.ReactElement
}) {
  const frame     = useCurrentFrame()
  const { fps }   = useVideoConfig()
  const panelSp   = sp(fps, frame - startFrame)
  const opacity   = panelSp
  const translateY = (1 - panelSp) * 18

  const cfg   = PANELS[idx]
  const isMeme = cfg.meme

  const textStyle: React.CSSProperties = isMeme
    ? {
        fontSize:       idx === 2 ? 42 : 46,
        fontWeight:     900,
        color:          '#ffffff',
        fontFamily:     `Impact, Arial Black, ${DM}, sans-serif`,
        lineHeight:     1.18,
        textAlign:      'center' as const,
        textShadow:     [
          '-3px -3px 0 #000', '3px -3px 0 #000',
          '-3px  3px 0 #000', '3px  3px 0 #000',
          '-4px -4px 0 #000', '4px -4px 0 #000',
          '-4px  4px 0 #000', '4px  4px 0 #000',
          '0 0 12px #000',
        ].join(', '),
        letterSpacing: '-0.01em',
      }
    : {
        fontSize:    idx === 0 ? 36 : 40,
        fontWeight:  idx === 0 ? 400 : 700,
        color:       '#111111',
        fontFamily:  DM,
        lineHeight:  1.35,
        textAlign:   'center' as const,
      }

  return (
    <div
      style={{
        position:  'absolute',
        top:       idx * PH,
        left:      0,
        width:     W,
        height:    PH,
        opacity,
        transform: `translateY(${translateY}px)`,
        display:   'flex',
        flexDirection: 'row',
      }}
    >
      {/* Left — white, text */}
      <div
        style={{
          width:           HW,
          height:          PH,
          backgroundColor: '#ffffff',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          padding:         '0 36px',
          boxSizing:       'border-box',
        }}
      >
        <div style={textStyle}>
          {cfg.lines.map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < cfg.lines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Right — black, brain */}
      <div
        style={{
          width:           HW,
          height:          PH,
          backgroundColor: '#000000',
          overflow:        'hidden',
          position:        'relative',
        }}
      >
        <BrainComponent />
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════════════════════

export const ExpandingBrain: React.FC = () => {
  const frame   = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Panel dividers fade in with their panel
  const div1Op = ip(sp(fps, Math.max(0, frame - 40)), [0, 1], [0, 1])
  const div2Op = ip(sp(fps, Math.max(0, frame - 80)), [0, 1], [0, 1])

  return (
    <AbsoluteFill style={{ backgroundColor: '#ffffff', overflow: 'hidden' }}>

      <Panel idx={0} startFrame={0}  BrainComponent={Brain1} />
      <Panel idx={1} startFrame={40} BrainComponent={Brain2} />
      <Panel idx={2} startFrame={80} BrainComponent={Brain3} />

      {/* Horizontal dividers */}
      <div style={{
        position: 'absolute', top: PH - 1, left: 0, width: W, height: 2,
        backgroundColor: '#000000', opacity: div1Op,
      }} />
      <div style={{
        position: 'absolute', top: PH * 2 - 1, left: 0, width: W, height: 2,
        backgroundColor: '#000000', opacity: div2Op,
      }} />

      {/* HOLOTURE watermark */}
      <div style={{
        position:   'absolute',
        bottom:     18,
        right:      24,
        display:    'flex',
        alignItems: 'center',
        gap:        8,
        opacity:    ip(frame, [105, 130], [0, 0.70]),
      }}>
        <Img
          src={staticFile('logo.png')}
          style={{ width: 28, height: 28, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
        />
        <span style={{
          fontSize:    22,
          fontWeight:  800,
          color:       '#ffffff',
          fontFamily:  DM,
          letterSpacing: '0.12em',
        }}>
          HOLOTURE
        </span>
      </div>

    </AbsoluteFill>
  )
}
