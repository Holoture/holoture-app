import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { Zap, Star, ChevronRight } from 'lucide-react'
import Header from '@/components/Header'
import CheckoutButton from '@/components/CheckoutButton'
import TrialPopup from '@/components/TrialPopup'
import ScrollBackground from '@/components/ScrollBackground'
import EdgeCarousel from '@/components/EdgeCarousel'
import Testimonials from '@/components/Testimonials'
import HowItWorks from '@/components/HowItWorks'
import WeeklyFeaturedCard, { type WeeklyFeatured } from '@/components/WeeklyFeaturedCard'
import OutcomesStrip from '@/components/OutcomesStrip'
import type { ShortHorizonOutcomesSummary } from '@/components/ShortHorizonOutcomesStrip'
import { prisma } from '@/lib/prisma'
import { hasEverSubscribed } from '@/lib/user'
import { PUBLIC_TRACK_RECORD_FILTER, EXCLUDE_CATALYST_DRIVEN, getOutcomesSummary } from '@/lib/publicStats'

/**
 * The hero's showcase: either the highest-gaining CLOSED signal recorded to
 * date (auto-selected weekly by cron/weekly-featured) or a hand-entered
 * override set from the admin console — see WeeklyFeaturedSignal.isManualOverride.
 *
 * The row is fully self-contained (ticker, gain, thesis, etc. all stored
 * directly on it) rather than joined against Signal at render time, so a
 * manual entry works with no linked signal and can't go stale if the
 * underlying Signal row is later edited or deleted.
 */
async function getWeeklyFeatured(): Promise<WeeklyFeatured | null> {
  try {
    const row = await prisma.weeklyFeaturedSignal.findFirst({
      orderBy: { weekStartDate: 'desc' },
    })
    if (!row) return null

    return {
      ticker: row.ticker,
      companyName: row.companyName,
      signalType: row.signalType,
      entryZoneLow: row.entryZoneLow,
      entryZoneHigh: row.entryZoneHigh,
      targetPrice: row.targetPrice,
      realizedGainPercent: row.realizedGainPercent,
      thesis: row.thesis,
      openedAt: row.postedAt.toISOString(),
      weekStartDate: row.weekStartDate.toISOString(),
    }
  } catch {
    return null
  }
}

// Real, checkable counts for the hero's mono micro-line — never hardcoded.
async function getHeroStats(): Promise<{ tradeCount: number; memberCount: number }> {
  try {
    const [tradeCount, members] = await Promise.all([
      prisma.politicianTrade.count(),
      prisma.politicianTrade.findMany({ distinct: ['politicianName'], select: { politicianName: true } }),
    ])
    return { tradeCount, memberCount: members.length }
  } catch {
    return { tradeCount: 0, memberCount: 0 }
  }
}

// getOutcomesSummary() (the real, all-timeframe track record used by
// OutcomesStrip below) now lives in lib/publicStats.ts, imported above —
// moved there so components/LoggedInHome.tsx can show the same real numbers
// without duplicating this calculation. Logic unchanged.
const MIN_SAMPLE = 25 // an unconvincing number is worse than no number — also used by getShortHorizonOutcomesSummary below

// Short-horizon (intraday / days_1_3 / momentum) track record — removed from
// the landing page again per request. getShortHorizonOutcomesSummary() and
// components/ShortHorizonOutcomesStrip.tsx are left in place, unused, in
// case this is revisited later. Same exclusion rules as the swing/long_term
// strip: LEFT_ZONE and UNVERIFIABLE are not resolved thesis outcomes and
// never enter any count here; PUBLIC_TRACK_RECORD_FILTER excludes
// hand-created/edited signals.
const SHORT_HORIZON_CATEGORIES = ['intraday', 'days_1_3', 'momentum']

async function getShortHorizonOutcomesSummary(): Promise<ShortHorizonOutcomesSummary | null> {
  try {
    const catFilter = { timeframeCategory: { in: SHORT_HORIZON_CATEGORIES }, ...PUBLIC_TRACK_RECORD_FILTER, ...EXCLUDE_CATALYST_DRIVEN }
    const [hitTarget, hitStop, expired, unverifiableCount] = await Promise.all([
      prisma.signal.count({ where: { outcome: 'HIT_TARGET', ...catFilter } }),
      prisma.signal.count({ where: { outcome: 'HIT_STOP', ...catFilter } }),
      prisma.signal.count({ where: { outcome: 'EXPIRED', ...catFilter } }),
      prisma.signal.count({ where: { outcome: 'UNVERIFIABLE', ...catFilter } }),
    ])
    const size = hitTarget + hitStop + expired
    if (size < MIN_SAMPLE) return null

    const winRatePct = Math.round((hitTarget / size) * 1000) / 10

    // Expectancy: real direction-aware gain from entry-zone midpoint to
    // outcomePrice, averaged across HIT_TARGET + HIT_STOP only — EXPIRED
    // signals never resolved to a real exit price, so there's no gain
    // number to include for them (same convention used for the equity
    // gain report this session: expired stays in the win-rate denominator,
    // never in the gain average).
    const decided = await prisma.signal.findMany({
      where: { outcome: { in: ['HIT_TARGET', 'HIT_STOP'] }, ...catFilter },
      select: { outcomePrice: true, entryZoneLow: true, entryZoneHigh: true, signalType: true },
    })
    const gains = decided
      .map((s) => {
        if (s.outcomePrice == null) return null
        const mid = (s.entryZoneLow + s.entryZoneHigh) / 2
        if (!(mid > 0)) return null
        const isShort = s.signalType === 'SHORT' || s.signalType === 'SELL'
        return isShort ? ((mid - s.outcomePrice) / mid) * 100 : ((s.outcomePrice - mid) / mid) * 100
      })
      .filter((g): g is number => g !== null)
    const expectancyPct = gains.length > 0
      ? Math.round((gains.reduce((a, b) => a + b, 0) / gains.length) * 10) / 10
      : 0

    return { size, winRatePct, expectancyPct, unverifiableCount }
  } catch {
    return null
  }
}

// Determine whether to show the delayed trial popup. Logged-out visitors and
// users who have never subscribed are eligible; prior/current customers are not.
async function getTrialEligibility(): Promise<{ eligible: boolean; href: string }> {
  const { userId } = await auth()
  if (!userId) return { eligible: true, href: '/sign-up' }

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        tier: true,
        isLifetimePro: true,
        proExpiresAt: true,
        isLifetimeMax: true,
        maxExpiresAt: true,
      },
    })
    // No row yet = brand-new account that has never subscribed.
    if (!user) return { eligible: true, href: '/pricing' }
    return { eligible: !hasEverSubscribed(user), href: '/pricing' }
  } catch {
    return { eligible: false, href: '/pricing' }
  }
}

// This component only ever renders for logged-out visitors — app/page.tsx
// checks auth() first and renders components/LoggedInHome.tsx instead for
// anyone signed in, so getTrialEligibility's logged-in branch above is
// effectively dead code kept for safety (e.g. a signed-in request that
// somehow reaches this component) rather than a real code path in
// practice. The 17-second delayed trial popup (TrialPopup below) therefore
// never renders for a logged-in user, since this whole component doesn't.
export default async function MarketingLandingPage() {
  const [trial, weeklyFeatured, heroStats, outcomesSummary] = await Promise.all([
    getTrialEligibility(),
    getWeeklyFeatured(),
    getHeroStats(),
    getOutcomesSummary(),
  ])

  return (
    <div className="min-h-full relative">
      <ScrollBackground />
      <TrialPopup eligible={trial.eligible} href={trial.href} />
      <Header />

      {/* Hero — asymmetric 7/5 split. The claim (left) sits next to its proof
          (right, a live signal from the database) in the same viewport,
          instead of a centered promise with no evidence. */}
      <section className="relative overflow-hidden py-28">
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left — claim, 7 cols, left-aligned */}
            <div className="lg:col-span-7">
              <h1 className="type-display" style={{ fontSize: 'clamp(40px, 5.5vw, 64px)' }}>
                Trade with an Edge
                <br />
                Algorithmic Trading Made Simple
              </h1>

              <p className="mt-6 max-w-xl" style={{ fontSize: 19, fontWeight: 400, lineHeight: 1.5, color: 'var(--text-mute)' }}>
                Stop guessing. Every day Holoture delivers curated stock signals with clear entry zones,
                price targets, and stop losses — backed by real market data and built for traders who want an actual edge.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-lg hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#009BFF', color: 'white', fontWeight: 600 }}
                >
                  Start Free Today
                  <ChevronRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-lg transition-colors"
                  style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-body)', fontWeight: 500 }}
                >
                  View Pricing
                </Link>
              </div>

              {heroStats.tradeCount > 0 && (
                <p className="data-label mt-8" style={{ color: 'var(--text-dim)' }}>
                  {heroStats.tradeCount.toLocaleString()} congressional trades tracked · {heroStats.memberCount} members · updated daily
                </p>
              )}
            </div>

            {/* Right — proof, 5 cols. A CLOSED past result, not a live pick:
                the card carries its own "closed" labeling and links down to
                the full win/loss record so one winner is never shown alone. */}
            <div className="lg:col-span-5">
              <WeeklyFeaturedCard featured={weeklyFeatured} />
            </div>
          </div>
        </div>
      </section>

      {/* Real track record — wins and losses, near the top. Only renders once
          there's a real sample (25+ closed signals); never shows a thin or
          fabricated number. */}
      {/* Anchor target for the weekly showcase card's "See our full track
          record" link — kept on the wrapper so the anchor still resolves
          even when the strip itself is hidden for a small sample. */}
      <div id="track-record" style={{ scrollMarginTop: 80 }}>
        {outcomesSummary && <OutcomesStrip summary={outcomesSummary} />}
      </div>

      {/* One Platform, Four Edges — screenshot carousel */}
      <EdgeCarousel />

      {/* How Holoture Works */}
      <HowItWorks />

      {/* Testimonials / social proof */}
      <Testimonials />

      {/* Pricing Preview — kept below the value props so visitors see value first.
          Centered (not left-gutter): this is a grid/action moment, not part of
          the three-section narrative sequence. */}
      <section className="relative z-10 py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="type-h2">Simple, Transparent Pricing</h2>
            <p className="mt-4 type-subhead">Start free. Upgrade when you&apos;re ready.</p>
          </div>

          {/* items-start: columns are independent heights so Pro can be taller/
              denser than Free and Max instead of three identical stretched boxes. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:items-start">
            {/* Free */}
            <div
              className="rounded-none p-8 term-panel"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--line)' }}
            >
              <p className="eyebrow">Free</p>
              <div className="mt-3 mb-6">
                <span className="font-data text-5xl" style={{ fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--text-high)' }}>$0</span>
                <span className="ml-1" style={{ color: 'var(--text-mute)' }}>/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  '5 daily stock signals',
                  'Politician Scanner — full access',
                  'Insider Scanner — full access',
                  'Market News, Trends & Calendar',
                  'No credit card required',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5" style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-body)' }}>
                    <div className="w-1 h-1 shrink-0" style={{ backgroundColor: '#009BFF' }} />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className="rounded-none block w-full text-center py-3 transition-colors"
                style={{ fontWeight: 500, color: 'var(--text-body)', backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--line)' }}
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro — taller and denser than Free/Max: more padding and a
                vertical overhang (negative margin on desktop), not just an
                identical box with a pill on top. */}
            <div
              className="rounded-none p-8 sm:p-10 sm:-my-5 relative term-panel"
              style={{
                background: 'linear-gradient(135deg, var(--bg-raised) 0%, var(--bg-overlay) 100%)',
                border: '1px solid rgba(0,155,255,0.5)',
                boxShadow: '0 12px 40px rgba(0,155,255,0.10)',
              }}
            >
              <div
                className="rounded-none absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 text-xs font-bold"
                style={{ backgroundColor: '#009BFF', color: 'white' }}
              >
                <Star className="w-3 h-3" />
                MOST POPULAR
              </div>
              <p className="eyebrow" style={{ color: '#009BFF' }}>Pro</p>
              <div className="mt-3 mb-6">
                <span className="font-data text-5xl" style={{ fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--text-high)' }}>$15</span>
                <span className="ml-1" style={{ color: 'var(--text-mute)' }}>/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  'Everything in Free',
                  'Full signal board',
                  'All signal categories unlocked',
                  'Entry zones, targets & stop losses',
                  'Confidence scores & full summary',
                  'Cancel anytime',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5" style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-body)' }}>
                    <div className="w-1 h-1 shrink-0" style={{ backgroundColor: '#009BFF' }} />
                    {item}
                  </li>
                ))}
              </ul>
              <CheckoutButton
                tier="pro"
                label="Start Pro — $15/month"
                className="rounded-none block w-full text-center py-3 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#009BFF', color: 'white', fontWeight: 600 }}
              />
            </div>

            {/* Max — CTA and badge use Max's own violet identity, not the site's
                interactive blue, so #009BFF stays scarce to exactly one meaning
                (site-wide primary action) per viewport. */}
            <div
              className="rounded-none p-8 relative term-panel"
              style={{
                background: 'linear-gradient(135deg, var(--bg-raised) 0%, rgba(124,58,237,0.08) 100%)',
                border: '1px solid rgba(124,58,237,0.6)',
              }}
            >
              <div
                className="rounded-none absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 text-xs font-bold"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white' }}
              >
                <Zap className="w-3 h-3" />
                BEST VALUE
              </div>
              <p className="eyebrow" style={{ color: '#a78bfa' }}>Max</p>
              <div className="mt-3 mb-6">
                <span className="font-data text-5xl" style={{ fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--text-high)' }}>$25</span>
                <span className="ml-1" style={{ color: 'var(--text-mute)' }}>/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  'Everything in Pro',
                  'Options Signals (CALL & PUT)',
                  'Futures Signals (coming soon)',
                  'Forex Signals (coming soon)',
                  'Cancel anytime',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5" style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-body)' }}>
                    <div className="w-1 h-1 shrink-0" style={{ backgroundColor: '#a78bfa' }} />
                    {item}
                  </li>
                ))}
              </ul>
              <CheckoutButton
                tier="max"
                label="Start Max — $25/month"
                className="rounded-none block w-full text-center py-3 hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white', fontWeight: 600 }}
              />
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
