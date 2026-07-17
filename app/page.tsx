import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { Zap, Star, ChevronRight } from 'lucide-react'
import Header from '@/components/Header'
import CheckoutButton from '@/components/CheckoutButton'
import TrialPopup from '@/components/TrialPopup'
import ScrollBackground from '@/components/ScrollBackground'
import GlobeBackground from '@/components/GlobeBackground'
import EdgeCarousel from '@/components/EdgeCarousel'
import Testimonials from '@/components/Testimonials'
import HowItWorks from '@/components/HowItWorks'
import { prisma } from '@/lib/prisma'
import { hasEverSubscribed } from '@/lib/user'

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

export default async function LandingPage() {
  const trial = await getTrialEligibility()

  return (
    <div className="min-h-full relative">
      <GlobeBackground position="right" />
      <ScrollBackground />
      <TrialPopup eligible={trial.eligible} href={trial.href} />
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,155,255,0.12) 0%, transparent 60%)',
          }}
        />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 text-center">
          <h1 className="type-display" style={{ fontSize: 'clamp(40px, 6vw, 64px)' }}>
            Trade with an Edge
            <br />
            Algorithmic Trading Made Simple
          </h1>

          <p className="mt-6 max-w-2xl mx-auto" style={{ fontSize: 19, fontWeight: 400, lineHeight: 1.5, color: 'var(--text-mute)' }}>
            Stop guessing. Every day Holoture delivers curated stock signals with clear entry zones,
            price targets, and stop losses — backed by real market data and built for traders who want an actual edge.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
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

        </div>
      </section>

      {/* One Platform, Four Edges — screenshot carousel */}
      <EdgeCarousel />

      {/* How Holoture Works */}
      <HowItWorks />

      {/* Testimonials / social proof */}
      <Testimonials />

      {/* Pricing Preview — kept below the value props so visitors see value first */}
      <section className="relative z-10 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="type-h2">Simple, Transparent Pricing</h2>
            <p className="mt-4 type-subhead">Start free. Upgrade when you&apos;re ready.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Free */}
            <div
              className="rounded-2xl p-8"
              style={{ backgroundColor: 'rgba(20,20,20,0.85)', border: '1px solid var(--border)' }}
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
                  <li key={item} className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-body)' }}>
                    <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--border)' }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#009BFF' }} />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className="block w-full text-center py-3 rounded-xl transition-colors"
                style={{ fontWeight: 500, color: 'var(--text-body)', backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro */}
            <div
              className="rounded-2xl p-8 relative"
              style={{
                background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-surface-2) 100%)',
                border: '2px solid rgba(0,155,255,0.5)',
              }}
            >
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold"
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
                  'Full signal board — no daily cap',
                  'All signal categories unlocked',
                  'Unlimited Momentum signals',
                  'Entry zones, targets & stop losses',
                  'Confidence scores & full summary',
                  'Cancel anytime',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-body)' }}>
                    <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(0,155,255,0.2)' }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#009BFF' }} />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <CheckoutButton
                tier="pro"
                label="Start Pro — $15/month"
                className="block w-full text-center py-3 rounded-xl hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#009BFF', color: 'white', fontWeight: 600 }}
              />
            </div>

            {/* Max */}
            <div
              className="rounded-2xl p-8 relative"
              style={{
                background: 'linear-gradient(135deg, var(--bg-surface) 0%, rgba(124,58,237,0.08) 100%)',
                border: '2px solid rgba(124,58,237,0.6)',
              }}
            >
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold"
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
                  <li key={item} className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-body)' }}>
                    <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(124,58,237,0.25)' }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#a78bfa' }} />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <CheckoutButton
                tier="max"
                label="Start Max — $25/month"
                className="block w-full text-center py-3 rounded-xl hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#009BFF', color: 'white', fontWeight: 600 }}
              />
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
