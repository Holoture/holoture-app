import Link from 'next/link'
import { Shield, Zap, BarChart3, Clock, Star, ChevronRight } from 'lucide-react'
import Header from '@/components/Header'
import CheckoutButton from '@/components/CheckoutButton'
import ProductPreview from '@/components/ProductPreview'
import { getPreviewData } from '@/lib/preview-data'

const FEATURES = [
  {
    icon: Zap,
    title: 'Data-Driven Signals',
    desc: 'Every pick is powered by our engine analyzing fundamentals, technicals, and market sentiment.',
  },
  {
    icon: BarChart3,
    title: 'Entry Zones & Targets',
    desc: 'Get precise entry price zones, price targets, and stop-loss levels for every signal.',
  },
  {
    icon: Shield,
    title: 'Confidence Scores',
    desc: 'Each signal carries a confidence rating so you always know how strong the setup is.',
  },
  {
    icon: Clock,
    title: 'Time Horizons',
    desc: 'Signals are tagged with a clear time horizon — from days to months — so you can plan accordingly.',
  },
]


export default async function LandingPage() {
  const previewData = await getPreviewData()

  return (
    <div className="min-h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,155,255,0.12) 0%, transparent 60%)',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 text-center">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-tight tracking-tight">
            Trade with an Edge
            <br />
            <span style={{ color: '#009BFF' }}>Algorithmic Trading Made Simple</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl max-w-2xl mx-auto text-white">
            Stop guessing. Every day Holoture delivers curated stock signals with clear entry zones,
            price targets, and stop losses — backed by real market data and built for traders who want an actual edge.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#009BFF', color: 'white' }}
            >
              Start Free Today
              <ChevronRight className="w-5 h-5" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-lg transition-colors text-white"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              View Pricing
            </Link>
          </div>

        </div>
      </section>

      {/* Features */}
      <section className="py-20" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Everything You Need to Invest with Confidence
            </h2>
            <p className="mt-4 text-lg text-white">Stop guessing. Start trading with Data-backed conviction.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-xl p-6"
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: 'rgba(0,155,255,0.15)' }}
                >
                  <Icon className="w-5 h-5" style={{ color: '#009BFF' }} />
                </div>
                <h3 className="font-bold text-white mb-2">{title}</h3>
                <p className="text-sm leading-relaxed text-white">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Preview */}
      <ProductPreview data={previewData} />

      {/* Pricing Preview */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-white">Simple, Transparent Pricing</h2>
            <p className="mt-4 text-white">Start free. Upgrade when you&apos;re ready.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Free */}
            <div
              className="rounded-2xl p-8"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              <p className="text-sm font-semibold uppercase tracking-wider text-white">Free</p>
              <div className="mt-3 mb-6">
                <span className="text-5xl font-black text-white">$0</span>
                <span className="ml-1 text-white">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  '5 signals per day',
                  'Large cap & small cap signals',
                  'Basic signal info',
                  'No credit card required',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-white">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--border)' }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#009BFF' }} />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className="block w-full text-center py-3 rounded-xl font-semibold transition-colors text-white"
                style={{ backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}
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
              <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#009BFF' }}>Pro</p>
              <div className="mt-3 mb-6">
                <span className="text-5xl font-black text-white">$15</span>
                <span className="ml-1 text-white">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  'Full signal board (15–50 signals/day)',
                  'Large cap, small cap, swing & long term signals',
                  '5 momentum signals per day',
                  'Entry zones, targets & stop losses',
                  'Confidence scores & full summary',
                  'Cancel anytime',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-white">
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
                className="block w-full text-center py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#009BFF', color: 'white' }}
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
              <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#a78bfa' }}>Max</p>
              <div className="mt-3 mb-6">
                <span className="text-5xl font-black text-white">$25</span>
                <span className="ml-1 text-white">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  'Everything in Pro',
                  'Unlimited momentum signals',
                  'Options signals & analysis',
                  'Politician stock scanner',
                  'All signal categories unlocked',
                  'Cancel anytime',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-white">
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
                className="block w-full text-center py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#009BFF', color: 'white' }}
              />
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
