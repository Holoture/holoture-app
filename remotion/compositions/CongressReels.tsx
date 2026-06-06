/**
 * Holoture Congress Scanner — 5-reel series
 * Format : 1080 × 1920  ·  30 fps  ·  16–20 s each
 *
 * IDs    : reel-pelosi-ai  (18 s / 540 f)
 *          reel-pelosi-apple (16 s / 480 f)
 *          reel-mtg          (20 s / 600 f)
 *          reel-committee    (20 s / 600 f)
 *          reel-weekly       (18 s / 540 f)
 *
 * Timeline per reel:
 *   0–59    (0–2 s)   Hook — fullscreen, no logo
 *   60–(L-60)         Body — staggered BeatIn cards
 *   (L-60)–L          OutroCTA — logo + CTA button
 *   frame 60+          DisclaimerChip persistent bottom-right
 */

import React from 'react'
import {
  AbsoluteFill, Img, Sequence,
  interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion'
import { loadFont } from '@remotion/google-fonts/DMSans'
import { PELOSI_AI, PELOSI_APPLE, MTG, COMMITTEE, WEEKLY_SEED } from './congressData'

const { fontFamily: DM } = loadFont('normal', { weights: ['400', '600', '700', '800', '900'] })

// ── Brand ──────────────────────────────────────────────────────────────────────
const C = {
  bg:        '#0A0A0B',
  accent:    '#1D9BF6',
  white:     '#FFFFFF',
  muted:     '#9BA3AF',   // ~7.8:1 contrast on bg ✓ WCAG AA
  green:     '#22C55E',
  red:       '#EF4444',
  gold:      '#F5C842',
  cardBg:    'rgba(255,255,255,0.04)',
  cardBdr:   'rgba(255,255,255,0.10)',
  accentBg:  'rgba(29,155,246,0.12)',
  accentBdr: 'rgba(29,155,246,0.30)',
  goldBg:    'rgba(245,200,66,0.10)',
  goldBdr:   'rgba(245,200,66,0.30)',
  redBg:     'rgba(239,68,68,0.08)',
  redBdr:    'rgba(239,68,68,0.25)',
  greenBg:   'rgba(34,197,94,0.12)',
  redBadge:  'rgba(239,68,68,0.12)',
} as const

const SAFE_X = 60

const EO = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ip = (f: number, i: number[], o: number[]) => interpolate(f, i, o, EO)
const sp = (fps: number, f: number) =>
  spring({ fps, frame: Math.max(0, f), config: { damping: 15, stiffness: 100 } })

// ── Shared: DisclaimerChip ────────────────────────────────────────────────────
function DisclaimerChip() {
  const frame = useCurrentFrame()
  const op = ip(frame, [60, 78], [0, 1])
  return (
    <div style={{
      position: 'absolute', bottom: 180, right: SAFE_X,
      opacity: op, zIndex: 10,
      backgroundColor: 'rgba(0,0,0,0.70)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 100,
      padding: '8px 20px',
    }}>
      <span style={{ color: C.muted, fontSize: 22, fontFamily: DM }}>
        Public disclosure data · Not financial advice
      </span>
    </div>
  )
}

// ── Shared: OutroCTA ──────────────────────────────────────────────────────────
function OutroCTA({ line1 }: { line1: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s  = sp(fps, frame)
  const op = ip(frame, [0, 18], [0, 1])

  return (
    <AbsoluteFill style={{
      backgroundColor: C.bg,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${C.accentBg} 0%, transparent 70%)`,
      }} />
      <DisclaimerChip />
      <div style={{
        textAlign: 'center', padding: `0 ${SAFE_X + 20}px`,
        transform: `scale(${s})`, opacity: op,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32,
      }}>
        <Img src={staticFile('logo.png')} style={{ width: 84, height: 84, objectFit: 'contain' }} />
        <p style={{
          color: C.white, fontSize: 52, fontWeight: 800, fontFamily: DM,
          lineHeight: 1.25, margin: 0,
        }}>
          {line1}
        </p>
        <div style={{
          backgroundColor: C.accent, borderRadius: 100,
          padding: '18px 64px',
        }}>
          <span style={{ color: C.white, fontSize: 40, fontWeight: 800, fontFamily: DM }}>
            holoture.com
          </span>
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ── Shared: HookScene ─────────────────────────────────────────────────────────
function HookScene({ line1, line2, accentColor }: { line1: string; line2?: string; accentColor?: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s  = sp(fps, frame)
  const op = ip(frame, [0, 12], [0, 1])

  return (
    <AbsoluteFill style={{
      backgroundColor: C.bg,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 90% 60% at 50% 45%, rgba(29,155,246,0.18) 0%, transparent 70%)',
      }} />
      <div style={{
        textAlign: 'center', padding: `0 ${SAFE_X + 20}px`,
        transform: `scale(${s})`, opacity: op,
      }}>
        <p style={{
          color: C.white, fontSize: 82, fontWeight: 900, fontFamily: DM,
          lineHeight: 1.1, margin: 0,
        }}>
          {line1}
        </p>
        {line2 && (
          <p style={{
            color: accentColor ?? C.accent, fontSize: 56, fontWeight: 700,
            fontFamily: DM, lineHeight: 1.2, marginTop: 24, marginBottom: 0,
          }}>
            {line2}
          </p>
        )}
      </div>
    </AbsoluteFill>
  )
}

// ── Shared: BeatIn ────────────────────────────────────────────────────────────
function BeatIn({ delay, children }: { delay: number; children: React.ReactNode }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s  = sp(fps, frame - delay)
  const op = ip(frame, [delay, delay + 12], [0, 1])
  return (
    <div style={{ transform: `translateY(${(1 - s) * 36}px)`, opacity: op }}>
      {children}
    </div>
  )
}

// ── Shared: TradeCard ─────────────────────────────────────────────────────────
function TradeCard({
  action, ticker, name, type, range, note, delay = 0,
}: {
  action: 'BUY' | 'SELL' | string
  ticker: string
  name: string
  type?: string
  range?: string
  note?: string
  delay?: number
}) {
  const isBuy    = action === 'BUY'
  const tagColor = isBuy ? C.green : C.red
  const tagBg    = isBuy ? C.greenBg : C.redBadge

  return (
    <BeatIn delay={delay}>
      <div style={{
        backgroundColor: C.cardBg,
        border: `1px solid ${C.cardBdr}`,
        borderLeft: `3px solid ${tagColor}`,
        borderRadius: 20,
        padding: '22px 28px',
        marginBottom: 14,
        display: 'flex', alignItems: 'flex-start', gap: 18,
      }}>
        <div style={{
          backgroundColor: tagBg,
          border: `1.5px solid ${tagColor}`,
          borderRadius: 10, padding: '7px 16px', flexShrink: 0, marginTop: 2,
        }}>
          <span style={{ color: tagColor, fontSize: 26, fontWeight: 800, fontFamily: DM }}>
            {isBuy ? '▲' : '▼'} {action}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ color: C.white, fontSize: 38, fontWeight: 800, fontFamily: DM }}>{ticker}</span>
            {type && (
              <span style={{ color: C.accent, fontSize: 24, fontFamily: DM }}>{type}</span>
            )}
          </div>
          <div style={{ color: C.muted, fontSize: 26, fontFamily: DM }}>{name}</div>
          {range && (
            <div style={{ color: C.accent, fontSize: 26, fontWeight: 700, fontFamily: DM, marginTop: 4 }}>{range}</div>
          )}
          {note && (
            <div style={{ color: C.muted, fontSize: 24, fontFamily: DM, marginTop: 6, lineHeight: 1.4 }}>{note}</div>
          )}
        </div>
      </div>
    </BeatIn>
  )
}

// ── Shared: InfoRow ───────────────────────────────────────────────────────────
function InfoRow({ label, value, valueColor, delay = 0 }: { label: string; value: string; valueColor?: string; delay?: number }) {
  return (
    <BeatIn delay={delay}>
      <div style={{
        backgroundColor: C.accentBg,
        border: `1px solid ${C.accentBdr}`,
        borderRadius: 14, padding: '16px 26px', marginBottom: 14,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: C.muted, fontSize: 26, fontFamily: DM }}>{label}</span>
        <span style={{ color: valueColor ?? C.white, fontSize: 28, fontWeight: 700, fontFamily: DM, maxWidth: '60%', textAlign: 'right' }}>
          {value}
        </span>
      </div>
    </BeatIn>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REEL 1 — reel-pelosi-ai   (18 s / 540 frames)
// ─────────────────────────────────────────────────────────────────────────────

function PelosiAIBody() {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, padding: `150px ${SAFE_X}px 200px` }}>
      <DisclaimerChip />

      <BeatIn delay={0}>
        <div style={{ marginBottom: 22 }}>
          <span style={{ color: C.muted, fontSize: 25, fontFamily: DM }}>
            Filed {PELOSI_AI.filedDate} · {PELOSI_AI.filedNote}
          </span>
          <p style={{ color: C.white, fontSize: 58, fontWeight: 800, fontFamily: DM, lineHeight: 1.1, margin: '8px 0 0' }}>
            Nancy Pelosi
          </p>
        </div>
      </BeatIn>

      {PELOSI_AI.trades.map((t, i) => (
        <TradeCard
          key={t.ticker}
          action={t.action}
          ticker={t.ticker}
          name={t.name}
          type={t.type}
          delay={12 + i * 18}
        />
      ))}

      <BeatIn delay={120}>
        <div style={{
          backgroundColor: C.accentBg, border: `1px solid ${C.accentBdr}`,
          borderRadius: 16, padding: '18px 26px', marginTop: 6,
        }}>
          <span style={{ color: C.accent, fontSize: 28, fontWeight: 700, fontFamily: DM }}>
            💡 {PELOSI_AI.takeaway}
          </span>
        </div>
      </BeatIn>
    </AbsoluteFill>
  )
}

export function ReelPelosiAI() {
  return (
    <>
      <Sequence from={0}   durationInFrames={60}>
        <HookScene line1="Pelosi's first trades of 2026 just dropped." />
      </Sequence>
      <Sequence from={60}  durationInFrames={420}>
        <PelosiAIBody />
      </Sequence>
      <Sequence from={480} durationInFrames={60}>
        <OutroCTA line1={"See every congressional trade\nthe day it's filed →"} />
      </Sequence>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REEL 2 — reel-pelosi-apple   (16 s / 480 frames)
// ─────────────────────────────────────────────────────────────────────────────

function PelosiAppleBody() {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, padding: `150px ${SAFE_X}px 200px` }}>
      <DisclaimerChip />

      <BeatIn delay={0}>
        <p style={{ color: C.white, fontSize: 58, fontWeight: 800, fontFamily: DM, lineHeight: 1.1, marginBottom: 28 }}>
          Nancy Pelosi
        </p>
      </BeatIn>

      <TradeCard
        action={PELOSI_APPLE.action}
        ticker={PELOSI_APPLE.ticker}
        name={PELOSI_APPLE.name}
        type={PELOSI_APPLE.shares}
        range={PELOSI_APPLE.range}
        delay={14}
      />

      <InfoRow label="Traded"       value={PELOSI_APPLE.tradedDate}     delay={28} />
      <InfoRow label="Filed"        value={PELOSI_APPLE.filedDate}      delay={42} />
      <InfoRow label="AAPL close"   value={PELOSI_APPLE.referencePrice} delay={56} valueColor={C.muted} />

      <BeatIn delay={74}>
        <div style={{
          backgroundColor: C.cardBg, border: `1px solid ${C.cardBdr}`,
          borderRadius: 16, padding: '20px 26px', marginTop: 6,
        }}>
          <span style={{ color: C.muted, fontSize: 27, fontFamily: DM, lineHeight: 1.5 }}>
            "{PELOSI_APPLE.note}"
          </span>
        </div>
      </BeatIn>
    </AbsoluteFill>
  )
}

export function ReelPelosiApple() {
  return (
    <>
      <Sequence from={0}   durationInFrames={60}>
        <HookScene line1="She SOLD Apple." line2="Here's the receipt." accentColor={C.red} />
      </Sequence>
      <Sequence from={60}  durationInFrames={360}>
        <PelosiAppleBody />
      </Sequence>
      <Sequence from={420} durationInFrames={60}>
        <OutroCTA line1="Holoture flags every buy AND sell the moment it's public." />
      </Sequence>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REEL 3 — reel-mtg   (20 s / 600 frames)
// ─────────────────────────────────────────────────────────────────────────────

function TickerPill({ label, delay }: { label: string; delay: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s  = sp(fps, frame - delay)
  const op = ip(frame, [delay, delay + 10], [0, 1])
  return (
    <div style={{
      backgroundColor: C.accentBg, border: `1px solid ${C.accentBdr}`,
      borderRadius: 10, padding: '8px 18px',
      transform: `scale(${s})`, opacity: op,
      display: 'inline-block',
    }}>
      <span style={{ color: C.accent, fontSize: 26, fontWeight: 700, fontFamily: DM }}>{label}</span>
    </div>
  )
}

function MTGBody() {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, padding: `150px ${SAFE_X}px 200px` }}>
      <DisclaimerChip />

      <BeatIn delay={0}>
        <p style={{ color: C.white, fontSize: 52, fontWeight: 800, fontFamily: DM, lineHeight: 1.1, marginBottom: 20 }}>
          {MTG.politician}
        </p>
      </BeatIn>

      {/* Ticker wall */}
      <BeatIn delay={10}>
        <div style={{
          backgroundColor: C.cardBg, border: `1px solid ${C.cardBdr}`,
          borderRadius: 20, padding: '20px 24px', marginBottom: 18,
        }}>
          <div style={{ color: C.muted, fontSize: 24, fontFamily: DM, marginBottom: 14 }}>
            Filed {MTG.filedDate} · {MTG.range}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {MTG.tickers.map((t, i) => (
              <TickerPill key={t} label={t} delay={14 + i * 5} />
            ))}
          </div>
        </div>
      </BeatIn>

      {/* Prior trades */}
      <BeatIn delay={90}>
        <div style={{
          backgroundColor: C.goldBg, border: `1px solid ${C.goldBdr}`,
          borderRadius: 16, padding: '18px 26px', marginBottom: 16,
        }}>
          <span style={{ color: C.muted, fontSize: 25, fontFamily: DM, lineHeight: 1.5 }}>
            <span style={{ color: C.gold, fontWeight: 700 }}>Earlier: </span>
            {MTG.priorTrades.period} — {MTG.priorTrades.tickers.join(', ')}
          </span>
        </div>
      </BeatIn>

      {/* Scrutiny + denial */}
      <BeatIn delay={110}>
        <div style={{
          backgroundColor: C.redBg, border: `1px solid ${C.redBdr}`,
          borderRadius: 16, padding: '18px 26px',
        }}>
          <p style={{ color: C.muted, fontSize: 25, fontFamily: DM, lineHeight: 1.55, margin: 0 }}>
            ⚠ {MTG.scrutinyNote}{' '}
            <span style={{ color: C.white }}>{MTG.denialNote}</span>
          </p>
        </div>
      </BeatIn>
    </AbsoluteFill>
  )
}

export function ReelMTG() {
  return (
    <>
      <Sequence from={0}   durationInFrames={60}>
        <HookScene line1="12 stocks in one day." line2="Then the questions started." accentColor={C.gold} />
      </Sequence>
      <Sequence from={60}  durationInFrames={480}>
        <MTGBody />
      </Sequence>
      <Sequence from={540} durationInFrames={60}>
        <OutroCTA line1="Form your own view — Holoture shows you the raw filings." />
      </Sequence>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REEL 4 — reel-committee   (20 s / 600 frames)
// ─────────────────────────────────────────────────────────────────────────────

function CommitteeBody() {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, padding: `150px ${SAFE_X}px 200px` }}>
      <DisclaimerChip />

      {/* Source badge */}
      <BeatIn delay={0}>
        <div style={{
          backgroundColor: C.accentBg, border: `1px solid ${C.accentBdr}`,
          borderRadius: 14, padding: '14px 24px', marginBottom: 22,
          display: 'inline-flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: C.accent, flexShrink: 0 }} />
          <span style={{ color: C.muted, fontSize: 26, fontFamily: DM }}>
            {COMMITTEE.sourceDate} · {COMMITTEE.source}
          </span>
        </div>
      </BeatIn>

      <BeatIn delay={14}>
        <p style={{
          color: C.white, fontSize: 44, fontWeight: 700, fontFamily: DM,
          lineHeight: 1.3, marginBottom: 22,
        }}>
          {COMMITTEE.finding}
        </p>
      </BeatIn>

      {/* Senator pills */}
      <BeatIn delay={28}>
        <div style={{
          backgroundColor: C.cardBg, border: `1px solid ${C.cardBdr}`,
          borderRadius: 18, padding: '18px 24px', marginBottom: 16,
        }}>
          <div style={{ color: C.muted, fontSize: 24, fontFamily: DM, marginBottom: 12 }}>
            Senators named in reporting:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {COMMITTEE.senators.map(s => (
              <div key={s} style={{
                backgroundColor: C.accentBg, border: `1px solid ${C.accentBdr}`,
                borderRadius: 10, padding: '8px 20px',
              }}>
                <span style={{ color: C.accent, fontSize: 28, fontWeight: 700, fontFamily: DM }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </BeatIn>

      <BeatIn delay={50}>
        <div style={{
          backgroundColor: C.goldBg, border: `1px solid ${C.goldBdr}`,
          borderRadius: 16, padding: '18px 26px', marginBottom: 16,
        }}>
          <span style={{ color: C.muted, fontSize: 26, fontFamily: DM, lineHeight: 1.5 }}>
            📊 {COMMITTEE.studyNote}
          </span>
        </div>
      </BeatIn>

      <BeatIn delay={70}>
        <div style={{
          backgroundColor: C.cardBg, border: `1px solid ${C.cardBdr}`,
          borderRadius: 16, padding: '18px 26px',
        }}>
          <span style={{ color: C.muted, fontSize: 26, fontFamily: DM, lineHeight: 1.5 }}>
            ⚖ {COMMITTEE.balanceNote}
          </span>
        </div>
      </BeatIn>
    </AbsoluteFill>
  )
}

export function ReelCommittee() {
  return (
    <>
      <Sequence from={0}   durationInFrames={60}>
        <HookScene line1="What if lawmakers traded the exact industries they oversee?" />
      </Sequence>
      <Sequence from={60}  durationInFrames={480}>
        <CommitteeBody />
      </Sequence>
      <Sequence from={540} durationInFrames={60}>
        <OutroCTA line1="Holoture maps trades to committees so you can see the overlap yourself." />
      </Sequence>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REEL 5 — reel-weekly   (18 s / 540 frames)
// ─────────────────────────────────────────────────────────────────────────────

function WeeklyBody() {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, padding: `150px ${SAFE_X}px 200px` }}>
      <DisclaimerChip />

      <BeatIn delay={0}>
        <div style={{ marginBottom: 24 }}>
          <span style={{ color: C.accent, fontSize: 28, fontWeight: 700, fontFamily: DM }}>
            {WEEKLY_SEED.weekOf}
          </span>
          <p style={{ color: C.white, fontSize: 52, fontWeight: 800, fontFamily: DM, margin: '8px 0 0' }}>
            This week's tape
          </p>
        </div>
      </BeatIn>

      {/* Real trades */}
      {WEEKLY_SEED.trades.map((t, i) => (
        <TradeCard
          key={t.ticker}
          action={t.action}
          ticker={t.ticker}
          name={t.name}
          type={t.range}
          note={`${t.politician} · Traded ${t.tradedDate} · Filed ${t.filedDate}`}
          delay={14 + i * 24}
        />
      ))}

      {/* Placeholder slots — replace with fresh data before each weekly render */}
      {WEEKLY_SEED.placeholders.map((p, i) => (
        <BeatIn key={i} delay={66 + i * 20}>
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.02)',
            border: '1.5px dashed rgba(255,255,255,0.18)',
            borderRadius: 18, padding: '20px 26px', marginBottom: 14,
          }}>
            <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 26, fontFamily: DM }}>
              {p.action} {p.ticker} · {p.politician} · {p.range}
            </span>
          </div>
        </BeatIn>
      ))}

      <BeatIn delay={110}>
        <div style={{
          backgroundColor: C.accentBg, border: `1px solid ${C.accentBdr}`,
          borderRadius: 14, padding: '16px 24px', marginTop: 6,
        }}>
          <span style={{ color: C.muted, fontSize: 26, fontFamily: DM }}>
            📅 New filings drop daily. Updated {WEEKLY_SEED.weekOf}.
          </span>
        </div>
      </BeatIn>
    </AbsoluteFill>
  )
}

export function ReelWeekly() {
  return (
    <>
      <Sequence from={0}   durationInFrames={60}>
        <HookScene line1="Congress was busy this week." line2="Here's the tape." />
      </Sequence>
      <Sequence from={60}  durationInFrames={420}>
        <WeeklyBody />
      </Sequence>
      <Sequence from={480} durationInFrames={60}>
        <OutroCTA line1="Get the full weekly tape →" />
      </Sequence>
    </>
  )
}
