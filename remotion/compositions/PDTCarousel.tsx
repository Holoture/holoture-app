/**
 * PDTCarousel — Holoture Instagram carousel about PDT rule elimination
 *
 * Canvas : 1080 × 1350 px (4:5)
 * FPS    : 30
 * Slides : 5 × 90 frames = 450 frames total
 *
 * Compositions registered:
 *   PDTCarousel  — full 450-frame sequence (all slides)
 *   PDTSlide1–5  — individual 90-frame compositions for renderStill
 *
 * Render individual PNGs:
 *   npx tsx scripts/render-pdt-carousel.ts
 */

import React from 'react'
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { loadFont as loadSora }   from '@remotion/google-fonts/Sora'
import { loadFont as loadDMSans } from '@remotion/google-fonts/DMSans'

// ── Fonts ──────────────────────────────────────────────────────────────────────
const { fontFamily: SORA } = loadSora('normal',  { weights: ['400','600','700','800'] })
const { fontFamily: DM }   = loadDMSans('normal', { weights: ['400','500','600'] })

// ── Brand palette ──────────────────────────────────────────────────────────────
const C = {
  bg:       '#0a0f1e',
  cyan:     '#00d2ff',
  blue:     '#0055ff',
  green:    '#00e87a',
  red:      '#ff5050',
  amber:    '#ffb300',
  white:    '#ffffff',
  muted:    'rgba(255,255,255,0.62)',
  dim:      'rgba(255,255,255,0.38)',
  dimmer:   'rgba(255,255,255,0.16)',
  cardBg:   'rgba(255,255,255,0.05)',
  cardBdr:  'rgba(255,255,255,0.10)',
  beforeBg: 'rgba(255,80,80,0.13)',
  afterBg:  'rgba(0,232,122,0.11)',
  warnBg:   'rgba(255,179,0,0.10)',
  warnBdr:  'rgba(255,179,0,0.35)',
} as const

const GRAD     = 'linear-gradient(135deg, #00d2ff 0%, #0055ff 100%)'
const GRAD_TXT = `linear-gradient(135deg, ${C.cyan} 0%, #4488ff 100%)`

// ── Layout ─────────────────────────────────────────────────────────────────────
const W  = 1080
const H  = 1350
const PX = 56    // horizontal page padding

// ── Helpers ────────────────────────────────────────────────────────────────────
const EO  = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ip  = (f: number, i: number[], o: number[]) => interpolate(f, i, o, EO)
const sp  = (fps: number, f: number, cfg: Record<string,number> = {}) =>
  spring({ fps, frame: Math.max(0, f), config: { damping: 14, mass: 1.1, stiffness: 110, ...cfg } })
const fadeIn  = (f: number, start: number, dur = 16) => ip(f, [start, start + dur], [0, 1])
const slideUp = (fps: number, f: number, start: number, dist = 24) =>
  ip(sp(fps, f - start), [0, 1], [dist, 0])

// ══════════════════════════════════════════════════════════════════════════════
// SHARED ATOMS
// ══════════════════════════════════════════════════════════════════════════════

/** Subtle cyan grid overlay — covers entire slide */
function GridOverlay() {
  const spacing = 36
  const hCount  = Math.ceil(H / spacing) + 1
  const vCount  = Math.ceil(W / spacing) + 1
  return (
    <svg style={{ position:'absolute', inset:0, pointerEvents:'none' }}
      width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {Array.from({ length: hCount }, (_, i) => (
        <line key={`h${i}`} x1="0" y1={i*spacing} x2={W} y2={i*spacing}
          stroke="#00d2ff" strokeWidth="0.7" opacity="0.04" />
      ))}
      {Array.from({ length: vCount }, (_, i) => (
        <line key={`v${i}`} x1={i*spacing} y1="0" x2={i*spacing} y2={H}
          stroke="#00d2ff" strokeWidth="0.7" opacity="0.04" />
      ))}
    </svg>
  )
}

/** Holoture bull logo mark — white rounded-square container so the
 *  blue bull reads cleanly against the dark navy background */
function LogoMark({ size = 42 }: { size?: number }) {
  const pad = Math.round(size * 0.10)
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      backgroundColor: '#ffffff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: pad,
      boxSizing: 'border-box' as const,
      boxShadow: `0 2px 12px rgba(0,0,0,0.35)`,
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      <Img
        src={staticFile('logo.png')}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
    </div>
  )
}

/** Full logo lockup: mark + wordmark */
function LogoBar({ opacity = 1 }: { opacity?: number }) {
  return (
    <div style={{
      position: 'absolute', top: 46, left: PX, right: PX,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      opacity,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <LogoMark size={42} />
        <span style={{
          fontSize: 20, fontWeight: 700, color: C.white,
          fontFamily: SORA, letterSpacing: '0.10em',
        }}>
          HOLOTURE
        </span>
      </div>
    </div>
  )
}

/** Gradient text via background-clip trick */
function GradText({ children, size, weight = 800, style = {} }: {
  children: React.ReactNode
  size: number
  weight?: number
  style?: React.CSSProperties
}) {
  return (
    <span style={{
      fontSize: size, fontWeight: weight, fontFamily: SORA,
      background: GRAD_TXT,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      lineHeight: 1.12,
      letterSpacing: '-0.02em',
      ...style,
    }}>
      {children}
    </span>
  )
}

/** Slide base — dark navy bg + grid */
function SlideBase({ children }: { children: React.ReactNode }) {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: DM, overflow: 'hidden' }}>
      {/* Subtle radial depth */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 80% 60% at 50% 30%, rgba(0,100,180,0.18) 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />
      <GridOverlay />
      {children}
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 1 — BREAKING NEWS HOOK
// ══════════════════════════════════════════════════════════════════════════════

export function PDTSlide1Component() {
  const frame   = useCurrentFrame()
  const { fps } = useVideoConfig()

  const logoOp    = fadeIn(frame, 0, 18)
  const badgeOp   = fadeIn(frame, 8, 16)
  const badgeSc   = ip(sp(fps, frame - 8, { damping: 12, stiffness: 130 }), [0,1], [0,1])
  // Single pulse at frame 32
  const pulse     = 1 + Math.sin(Math.max(0, (frame - 30)) * 0.28) * 0.04 *
                    ip(frame, [30, 32, 55, 58], [0, 1, 1, 0])

  const h1Op      = fadeIn(frame, 18, 18)
  const h1Y       = slideUp(fps, frame, 18)
  const h2Op      = fadeIn(frame, 26, 18)
  const h2Y       = slideUp(fps, frame, 26)
  const h3Op      = fadeIn(frame, 34, 18)
  const h3Y       = slideUp(fps, frame, 34)

  const subOp     = fadeIn(frame, 48, 18)
  const subY      = slideUp(fps, frame, 48)
  const statOp    = fadeIn(frame, 58, 18)
  const statY     = slideUp(fps, frame, 58)
  const bottomOp  = fadeIn(frame, 66, 18)

  return (
    <SlideBase>
      <LogoBar opacity={logoOp} />

      {/* BREAKING badge */}
      <div style={{
        position: 'absolute', top: 148, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        opacity: badgeOp,
        transform: `scale(${badgeSc * pulse})`,
      }}>
        <div style={{
          backgroundColor: C.red,
          borderRadius: 50, paddingTop: 10, paddingBottom: 10,
          paddingLeft: 28, paddingRight: 28,
          boxShadow: `0 0 30px rgba(255,80,80,0.50)`,
        }}>
          <span style={{
            fontSize: 26, fontWeight: 800, color: C.white,
            fontFamily: SORA, letterSpacing: '0.18em',
          }}>
            ⚡ BREAKING NEWS
          </span>
        </div>
      </div>

      {/* Headline — 3 lines */}
      <div style={{ position:'absolute', top:228, left:PX, right:PX, textAlign:'center' }}>
        <div style={{ opacity:h1Op, transform:`translateY(${h1Y}px)` }}>
          <span style={{ fontSize:100, fontWeight:800, color:C.white, fontFamily:SORA,
            lineHeight:1.05, letterSpacing:'-0.03em' }}>
            Anyone Can
          </span>
        </div>
        <div style={{ opacity:h2Op, transform:`translateY(${h2Y}px)`, marginTop:4 }}>
          <span style={{ fontSize:100, fontWeight:800, color:C.white, fontFamily:SORA,
            lineHeight:1.05, letterSpacing:'-0.03em' }}>
            Day Trade
          </span>
        </div>
        <div style={{ opacity:h3Op, transform:`translateY(${h3Y}px)`, marginTop:4 }}>
          <GradText size={100}>Now.</GradText>
        </div>
      </div>

      {/* Subline */}
      <div style={{
        position:'absolute', top:570, left:PX, right:PX,
        textAlign:'center', opacity:subOp, transform:`translateY(${subY}px)`,
      }}>
        <span style={{ fontSize:34, fontWeight:500, color:C.muted, fontFamily:DM, lineHeight:1.45 }}>
          The SEC just eliminated the Pattern Day Trader rule — effective today.
        </span>
      </div>

      {/* Big stat */}
      <div style={{
        position:'absolute', top:720, left:PX, right:PX,
        display:'flex', justifyContent:'center', gap:0,
        opacity:statOp, transform:`translateY(${statY}px)`,
      }}>
        <div style={{
          display:'flex', alignItems:'center', gap:24,
          backgroundColor:'rgba(0,210,255,0.08)',
          border:`1px solid rgba(0,210,255,0.22)`,
          borderRadius:16, padding:'22px 44px',
        }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:52, fontWeight:800, color:C.red, fontFamily:SORA,
              lineHeight:1, letterSpacing:'-0.02em', textDecoration:'line-through',
              textDecorationColor:'rgba(255,80,80,0.6)' }}>
              $25,000
            </div>
            <div style={{ fontSize:22, color:C.dim, fontFamily:DM, marginTop:6 }}>Old minimum</div>
          </div>
          <div style={{ fontSize:44, color:C.cyan, fontFamily:SORA, fontWeight:700 }}>→</div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:52, fontWeight:800, color:C.green, fontFamily:SORA,
              lineHeight:1, letterSpacing:'-0.02em' }}>
              $2,000
            </div>
            <div style={{ fontSize:22, color:C.dim, fontFamily:DM, marginTop:6 }}>New minimum</div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        position:'absolute', bottom:52, left:PX, right:PX,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        opacity:bottomOp,
        borderTop:`1px solid ${C.dimmer}`, paddingTop:22,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <LogoMark size={34} />
          <span style={{ fontSize:18, fontWeight:700, color:C.white, fontFamily:SORA, letterSpacing:'0.08em' }}>
            HOLOTURE
          </span>
        </div>
        <span style={{ fontSize:20, fontWeight:500, color:C.dim, fontFamily:DM }}>
          June 4, 2026
        </span>
      </div>
    </SlideBase>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 2 — WHAT CHANGED (Before vs After)
// ══════════════════════════════════════════════════════════════════════════════

function CompareCard({
  side, title, items, bg, border, textColor, frame, fps, delay,
}: {
  side: 'left'|'right'; title: string; items: string[];
  bg: string; border: string; textColor: string;
  frame: number; fps: number; delay: number
}) {
  const x0 = side === 'left' ? -60 : 60
  const sp1 = sp(fps, frame - delay)
  const cardX = ip(sp1, [0,1], [x0, 0])
  const cardOp = fadeIn(frame, delay, 18)

  return (
    <div style={{
      flex:1, backgroundColor:bg, borderRadius:16,
      border:`1.5px solid ${border}`, padding:'26px 24px',
      opacity:cardOp, transform:`translateX(${cardX}px)`,
    }}>
      <div style={{
        fontSize:26, fontWeight:800, color:textColor, fontFamily:SORA,
        letterSpacing:'0.04em', textTransform:'uppercase' as const,
        marginBottom:20,
        paddingBottom:14, borderBottom:`1px solid ${border}`,
      }}>
        {title}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {items.map((item, i) => {
          const iop = fadeIn(frame, delay + 10 + i * 7, 14)
          return (
            <div key={i} style={{
              display:'flex', alignItems:'flex-start', gap:12,
              opacity:iop,
            }}>
              <div style={{
                width:8, height:8, borderRadius:'50%',
                backgroundColor:textColor, marginTop:8, flexShrink:0,
              }} />
              <span style={{ fontSize:26, fontWeight:500, color:C.white, fontFamily:DM, lineHeight:1.4 }}>
                {item}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PDTSlide2Component() {
  const frame   = useCurrentFrame()
  const { fps } = useVideoConfig()

  const titleOp = fadeIn(frame, 5, 18)
  const titleY  = slideUp(fps, frame, 5)

  return (
    <SlideBase>
      <LogoBar opacity={fadeIn(frame, 0, 14)} />

      {/* Title */}
      <div style={{
        position:'absolute', top:118, left:PX, right:PX,
        opacity:titleOp, transform:`translateY(${titleY}px)`,
      }}>
        <div style={{ fontSize:58, fontWeight:800, color:C.white, fontFamily:SORA,
          lineHeight:1.1, letterSpacing:'-0.02em' }}>
          What Just Changed
        </div>
        <div style={{ fontSize:30, fontWeight:500, color:C.dim, fontFamily:DM, marginTop:10 }}>
          PDT rule — before vs. after
        </div>
      </div>

      {/* Comparison cards */}
      <div style={{
        position:'absolute', top:264, left:PX, right:PX,
        display:'flex', gap:20,
      }}>
        <CompareCard
          side="left" title="Before ✕"
          items={['$25,000 minimum balance', 'Max 3 day trades per 5 days', 'PDT flag restricts trading', 'End-of-day margining only']}
          bg={C.beforeBg} border="rgba(255,80,80,0.40)" textColor={C.red}
          frame={frame} fps={fps} delay={18}
        />
        <CompareCard
          side="right" title="After ✓"
          items={['$2,000 margin minimum', 'Unlimited day trades', 'No PDT designation', 'Real-time intraday margining']}
          bg={C.afterBg} border="rgba(0,232,122,0.40)" textColor={C.green}
          frame={frame} fps={fps} delay={26}
        />
      </div>

      {/* Bottom note */}
      <div style={{
        position:'absolute', bottom:52, left:PX, right:PX,
        opacity:fadeIn(frame, 62, 18),
        display:'flex', alignItems:'center', justifyContent:'space-between',
        borderTop:`1px solid ${C.dimmer}`, paddingTop:20,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <LogoMark size={34} />
          <span style={{ fontSize:18, fontWeight:700, color:C.white, fontFamily:SORA, letterSpacing:'0.08em' }}>
            HOLOTURE
          </span>
        </div>
        <span style={{ fontSize:20, color:C.dim, fontFamily:DM }}>Slide 2 / 5</span>
      </div>
    </SlideBase>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 3 — KEY RULE DETAILS
// ══════════════════════════════════════════════════════════════════════════════

const RULES = [
  {
    icon: '🚫',
    title: 'No PDT Designation',
    body: 'Trade freely without being flagged or restricted by the pattern day trader label.',
  },
  {
    icon: '💵',
    title: '$2,000 Margin Minimum',
    body: 'Minimum equity requirement dropped from $25,000 — accessible to far more traders.',
  },
  {
    icon: '⚡',
    title: 'Real-Time Buying Power',
    body: 'Intraday margin updates live throughout the session, not just at end of day.',
  },
  {
    icon: '📈',
    title: 'Expanded Buying Power',
    body: 'Bank sweeps and intraday profits now count toward your available margin.',
  },
]

export function PDTSlide3Component() {
  const frame   = useCurrentFrame()
  const { fps } = useVideoConfig()

  return (
    <SlideBase>
      <LogoBar opacity={fadeIn(frame, 0, 14)} />

      {/* Title */}
      <div style={{
        position:'absolute', top:118, left:PX, right:PX,
        opacity: fadeIn(frame, 5, 18),
        transform:`translateY(${slideUp(fps, frame, 5)})`,
      }}>
        <div style={{ fontSize:54, fontWeight:800, color:C.white, fontFamily:SORA,
          lineHeight:1.1, letterSpacing:'-0.02em' }}>
          The New Rules,{' '}
          <GradText size={54}>Explained</GradText>
        </div>
      </div>

      {/* Rule rows */}
      <div style={{
        position:'absolute', top:224, left:PX, right:PX,
        display:'flex', flexDirection:'column', gap:18,
      }}>
        {RULES.map((rule, i) => {
          const start = 18 + i * 10
          const rowOp = fadeIn(frame, start, 16)
          const rowX  = ip(sp(fps, frame - start), [0,1], [-30, 0])

          return (
            <div key={i} style={{
              display:'flex', alignItems:'flex-start', gap:20,
              backgroundColor: C.cardBg,
              borderRadius: 14,
              border: `1px solid ${C.cardBdr}`,
              borderLeft: `3px solid ${C.cyan}`,
              padding: '20px 24px',
              opacity: rowOp,
              transform: `translateX(${rowX}px)`,
            }}>
              {/* Icon circle */}
              <div style={{
                width:52, height:52, borderRadius:'50%', flexShrink:0,
                background: 'rgba(0,210,255,0.12)',
                border: `1px solid rgba(0,210,255,0.28)`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize: 24,
              }}>
                {rule.icon}
              </div>

              {/* Text */}
              <div>
                <div style={{ fontSize:28, fontWeight:700, color:C.white, fontFamily:SORA,
                  lineHeight:1.2, marginBottom:6 }}>
                  {rule.title}
                </div>
                <div style={{ fontSize:24, fontWeight:400, color:C.muted, fontFamily:DM,
                  lineHeight:1.45 }}>
                  {rule.body}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom */}
      <div style={{
        position:'absolute', bottom:52, left:PX, right:PX,
        opacity:fadeIn(frame, 60, 18),
        display:'flex', alignItems:'center', justifyContent:'space-between',
        borderTop:`1px solid ${C.dimmer}`, paddingTop:20,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <LogoMark size={34} />
          <span style={{ fontSize:18, fontWeight:700, color:C.white, fontFamily:SORA, letterSpacing:'0.08em' }}>
            HOLOTURE
          </span>
        </div>
        <span style={{ fontSize:20, color:C.dim, fontFamily:DM }}>Slide 3 / 5</span>
      </div>
    </SlideBase>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 4 — RISK REMINDER
// ══════════════════════════════════════════════════════════════════════════════

const RISKS = [
  {
    icon: '⚠️',
    title: 'Margin Calls Still Apply',
    body: 'You must maintain enough equity to cover your open positions. Falling short triggers a margin call.',
  },
  {
    icon: '🔁',
    title: 'Repeated Deficits Have Consequences',
    body: 'Brokers can impose trading restrictions if your account repeatedly falls below required equity.',
  },
  {
    icon: '⏱️',
    title: 'Real-Time Risk Means Faster Exposure',
    body: 'Intraday margining updates instantly — losses move quickly and can escalate in volatile markets.',
  },
]

export function PDTSlide4Component() {
  const frame   = useCurrentFrame()
  const { fps } = useVideoConfig()

  return (
    <SlideBase>
      <LogoBar opacity={fadeIn(frame, 0, 14)} />

      {/* Title */}
      <div style={{
        position:'absolute', top:118, left:PX, right:PX,
        opacity:fadeIn(frame, 5, 18),
        transform:`translateY(${slideUp(fps, frame, 5)})`,
      }}>
        <div style={{ fontSize:52, fontWeight:800, color:C.white, fontFamily:SORA,
          lineHeight:1.1, letterSpacing:'-0.02em', marginBottom:10 }}>
          Freedom Comes With{' '}
          <span style={{ color: C.amber }}>Responsibility</span>
        </div>
        <div style={{ fontSize:28, fontWeight:500, color:C.dim, fontFamily:DM }}>
          The new rules don't remove risk — they shift responsibility to you.
        </div>
      </div>

      {/* Risk cards */}
      <div style={{
        position:'absolute', top:292, left:PX, right:PX,
        display:'flex', flexDirection:'column', gap:20,
      }}>
        {RISKS.map((risk, i) => {
          const start = 20 + i * 12
          const cardOp = fadeIn(frame, start, 18)
          const cardY  = slideUp(fps, frame, start)

          return (
            <div key={i} style={{
              display:'flex', alignItems:'flex-start', gap:20,
              backgroundColor: C.warnBg,
              borderRadius:16,
              border:`1.5px solid ${C.warnBdr}`,
              padding:'22px 24px',
              opacity: cardOp,
              transform:`translateY(${cardY}px)`,
            }}>
              <div style={{
                width:56, height:56, borderRadius:'50%', flexShrink:0,
                background:'rgba(255,179,0,0.15)',
                border:'1px solid rgba(255,179,0,0.35)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:26,
              }}>
                {risk.icon}
              </div>
              <div>
                <div style={{ fontSize:28, fontWeight:700, color:C.amber, fontFamily:SORA,
                  marginBottom:8, lineHeight:1.2 }}>
                  {risk.title}
                </div>
                <div style={{ fontSize:24, fontWeight:400, color:C.muted, fontFamily:DM,
                  lineHeight:1.48 }}>
                  {risk.body}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Know your risk */}
      <div style={{
        position:'absolute', top:910, left:PX, right:PX,
        textAlign:'center',
        opacity:fadeIn(frame, 60, 18),
        transform:`translateY(${slideUp(fps, frame, 60)})`,
      }}>
        <div style={{
          display:'inline-block',
          border:`1px solid rgba(255,179,0,0.30)`,
          borderRadius:50, padding:'14px 36px',
          backgroundColor:'rgba(255,179,0,0.07)',
        }}>
          <span style={{ fontSize:28, fontWeight:600, color:C.amber, fontFamily:SORA }}>
            Know your risk before you trade.
          </span>
        </div>
      </div>

      {/* Bottom */}
      <div style={{
        position:'absolute', bottom:52, left:PX, right:PX,
        opacity:fadeIn(frame, 66, 18),
        display:'flex', alignItems:'center', justifyContent:'space-between',
        borderTop:`1px solid ${C.dimmer}`, paddingTop:20,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <LogoMark size={34} />
          <span style={{ fontSize:18, fontWeight:700, color:C.white, fontFamily:SORA, letterSpacing:'0.08em' }}>
            HOLOTURE
          </span>
        </div>
        <span style={{ fontSize:20, color:C.dim, fontFamily:DM }}>Slide 4 / 5</span>
      </div>
    </SlideBase>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 5 — CTA
// ══════════════════════════════════════════════════════════════════════════════

export function PDTSlide5Component() {
  const frame   = useCurrentFrame()
  const { fps } = useVideoConfig()

  const logoSp = sp(fps, frame - 8, { damping: 12, mass: 1.3, stiffness: 90 })
  const logoSc = ip(logoSp, [0,1], [0.4, 1])
  const logoOp = fadeIn(frame, 8, 18)

  const hlOp   = fadeIn(frame, 30, 18)
  const hlY    = slideUp(fps, frame, 30)
  const bodyOp = fadeIn(frame, 42, 18)
  const bodyY  = slideUp(fps, frame, 42)
  const ctaSp  = sp(fps, frame - 56, { damping: 11, mass: 1.2, stiffness: 100 })
  const ctaSc  = ip(ctaSp, [0,1], [0.7, 1])
  const ctaOp  = fadeIn(frame, 56, 18)
  const subOp  = fadeIn(frame, 68, 18)

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: DM, overflow: 'hidden' }}>
      {/* Brighter glow for CTA slide */}
      <div style={{
        position:'absolute', inset:0,
        background:`radial-gradient(ellipse 75% 55% at 50% 42%, rgba(0,180,255,0.22) 0%, transparent 65%)`,
        pointerEvents:'none',
      }} />
      <GridOverlay />

      {/* Large logo mark + wordmark — centered */}
      <div style={{
        position:'absolute', top:380, left:0, right:0,
        display:'flex', flexDirection:'column', alignItems:'center', gap:18,
        opacity: logoOp,
        transform:`scale(${logoSc})`,
      }}>
        <LogoMark size={72} />
        <span style={{
          fontSize:26, fontWeight:700, color:C.white,
          fontFamily:SORA, letterSpacing:'0.14em',
        }}>
          HOLOTURE
        </span>
      </div>

      {/* Headline */}
      <div style={{
        position:'absolute', top:554, left:PX, right:PX,
        textAlign:'center',
        opacity:hlOp, transform:`translateY(${hlY}px)`,
      }}>
        <div style={{ fontSize:72, fontWeight:800, fontFamily:SORA,
          lineHeight:1.08, letterSpacing:'-0.03em', color:C.white }}>
          Trade Smarter,
        </div>
        <GradText size={72} style={{ lineHeight:1.08, letterSpacing:'-0.03em', display:'block', marginTop:4 }}>
          Not Harder.
        </GradText>
      </div>

      {/* Body */}
      <div style={{
        position:'absolute', top:762, left:PX + 20, right:PX + 20,
        textAlign:'center',
        opacity:bodyOp, transform:`translateY(${bodyY}px)`,
      }}>
        <span style={{ fontSize:30, fontWeight:400, color:C.muted, fontFamily:DM, lineHeight:1.55 }}>
          Holoture's algorithmic signals help you navigate the new rules with confidence.
        </span>
      </div>

      {/* CTA pill */}
      <div style={{
        position:'absolute', top:922, left:0, right:0,
        display:'flex', flexDirection:'column', alignItems:'center', gap:16,
        opacity:ctaOp, transform:`scale(${ctaSc})`,
      }}>
        <div style={{
          background: GRAD,
          borderRadius:100, paddingTop:22, paddingBottom:22,
          paddingLeft:72, paddingRight:72,
          boxShadow:`0 14px 48px rgba(0,210,255,0.38)`,
        }}>
          <span style={{ fontSize:36, fontWeight:800, color:C.white, fontFamily:SORA, letterSpacing:'-0.01em' }}>
            Start Free Today
          </span>
        </div>
      </div>

      {/* Sub CTA */}
      <div style={{
        position:'absolute', top:1018, left:0, right:0,
        textAlign:'center',
        opacity:subOp,
      }}>
        <span style={{ fontSize:24, fontWeight:400, color:C.dim, fontFamily:DM }}>
          holoture.com — No credit card required
        </span>
      </div>

      {/* Bottom */}
      <div style={{
        position:'absolute', bottom:52, left:PX, right:PX,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        opacity:subOp,
        borderTop:`1px solid ${C.dimmer}`, paddingTop:20,
      }}>
        <span style={{ fontSize:20, color:C.dim, fontFamily:DM }}>Not financial advice.</span>
        <span style={{ fontSize:20, color:C.dim, fontFamily:DM }}>Slide 5 / 5</span>
      </div>
    </AbsoluteFill>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// FULL CAROUSEL (all 5 slides in sequence)
// ══════════════════════════════════════════════════════════════════════════════

export const PDTCarouselComposition: React.FC = () => (
  <>
    <Sequence from={0}   durationInFrames={90}><PDTSlide1Component /></Sequence>
    <Sequence from={90}  durationInFrames={90}><PDTSlide2Component /></Sequence>
    <Sequence from={180} durationInFrames={90}><PDTSlide3Component /></Sequence>
    <Sequence from={270} durationInFrames={90}><PDTSlide4Component /></Sequence>
    <Sequence from={360} durationInFrames={90}><PDTSlide5Component /></Sequence>
  </>
)
