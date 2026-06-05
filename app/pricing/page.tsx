import Link from 'next/link'
import { Check, Star, TrendingUp, Zap, Clock } from 'lucide-react'
import Header from '@/components/Header'
import CheckoutButton from '@/components/CheckoutButton'

const FREE_FEATURES = [
  '5 curated signals per day',
  'Large Cap & Small Cap signals only',
  'Basic ticker and signal type',
  'No credit card required',
]

const PRO_FEATURES = [
  'Full signal board (15–50 signals/day)',
  'Large Cap & Small Cap signals',
  'Swing Trade & Long Term signals',
  'Up to 5 Momentum signals/day',
  'Entry zones, targets & stop-loss',
  'Confidence scores & full thesis',
  'Sector tagging & filtering',
  'Market news feed',
  'Sector trends & heat map',
  'Earnings calendar',
  'Cancel anytime',
]

const MAX_FEATURES = [
  'Everything in Pro',
  'Unlimited Momentum signals',
  'Options signals (CALL & PUT)',
  'Politician stock scanner',
  'Earliest access to new features',
  'Priority data refresh',
  'Cancel anytime',
]

function TrialBadge() {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4"
      style={{ backgroundColor: 'rgba(29,158,117,0.15)', color: '#1D9E75', border: '1px solid rgba(29,158,117,0.3)' }}
    >
      <Clock className="w-3 h-3" />
      7-day free trial
    </div>
  )
}

export default function PricingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-black text-white">Choose Your Plan</h1>
          <p className="mt-4 text-lg text-white">Start free. Unlock the full edge when you&apos;re ready.</p>
          {/* Trial callout */}
          <div
            className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.25)', color: '#1D9E75' }}
          >
            <Clock className="w-4 h-4" />
            Pro &amp; Max come with a 7-day free trial — card required, nothing charged until day 8.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* ── Free ── */}
          <div
            className="rounded-2xl p-8 flex flex-col"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>Free</p>
              <div className="mt-4 mb-2">
                <span className="text-5xl font-black text-white">$0</span>
              </div>
              <p className="text-sm" style={{ color: '#94a3b8' }}>Forever free, no card needed</p>
            </div>

            <ul className="mt-8 space-y-4 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm" style={{ color: '#94a3b8' }}>
                  <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#009BFF' }} />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/sign-up"
              className="mt-8 block w-full text-center py-3.5 rounded-xl font-semibold transition-colors text-white"
              style={{ backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}
            >
              Get Started Free
            </Link>
          </div>

          {/* ── Pro ── */}
          <div
            className="rounded-2xl p-8 flex flex-col relative"
            style={{
              background: 'linear-gradient(160deg, var(--bg-surface) 0%, var(--bg-surface-2) 100%)',
              border: '2px solid rgba(0,155,255,0.5)',
            }}
          >
            <div
              className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-bold whitespace-nowrap"
              style={{ backgroundColor: '#009BFF', color: 'white' }}
            >
              <Star className="w-3 h-3" />
              MOST POPULAR
            </div>

            <div>
              <TrialBadge />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#009BFF' }}>Pro</p>
              <div className="mt-3 mb-2 flex items-end gap-2">
                <span className="text-5xl font-black text-white">$15</span>
                <span className="mb-2 text-white">/month</span>
              </div>
              <p className="text-sm text-white">after your free trial ends</p>
            </div>

            <ul className="mt-8 space-y-4 flex-1">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-white">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: 'rgba(0,155,255,0.2)' }}
                  >
                    <Check className="w-3 h-3" style={{ color: '#009BFF' }} />
                  </div>
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <CheckoutButton tier="pro" />
              <p className="mt-2 text-xs text-center" style={{ color: 'var(--text-w50)' }}>
                Free for 7 days, then $15/month
              </p>
            </div>
          </div>

          {/* ── Max ── */}
          <div
            className="rounded-2xl p-8 flex flex-col relative"
            style={{
              background: 'linear-gradient(160deg, rgba(124,58,237,0.15) 0%, rgba(79,70,229,0.1) 100%)',
              border: '2px solid rgba(124,58,237,0.5)',
            }}
          >
            <div
              className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-bold whitespace-nowrap"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white' }}
            >
              <Zap className="w-3 h-3" />
              BEST VALUE
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#a78bfa' }}>
                Holoture Max
              </p>
              <div className="mt-4 mb-2 flex items-end gap-2">
                <span className="text-5xl font-black text-white">$25</span>
                <span className="mb-2 text-white">/month</span>
              </div>
              <p className="text-sm text-white">Full access to every feature</p>
            </div>

            <ul className="mt-8 space-y-4 flex-1">
              {MAX_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-white">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: 'rgba(124,58,237,0.25)' }}
                  >
                    <Check className="w-3 h-3" style={{ color: '#a78bfa' }} />
                  </div>
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <CheckoutButton tier="max" />
            </div>
          </div>
        </div>

        {/* Trial fine print */}
        <div
          className="mt-10 rounded-xl px-6 py-4 text-center text-sm"
          style={{ backgroundColor: 'rgba(29,158,117,0.07)', border: '1px solid rgba(29,158,117,0.2)', color: 'var(--text-w60)' }}
        >
          <span style={{ color: '#1D9E75' }} className="font-semibold">Cancel anytime before your trial ends and you won't be charged.</span>
          {' '}Your card is securely stored by Stripe but not billed until day 8. Promo codes grant immediate access and bypass the trial.
        </div>

        <p className="text-center mt-6 text-sm text-white" style={{ opacity: 0.5 }}>
          Payments processed securely by Stripe. Holoture does not store your card details. Not financial advice. Always do your own research.
        </p>
      </div>

      <footer style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: '#009BFF' }} />
          <span className="text-sm font-bold text-white">Holo<span style={{ color: '#009BFF' }}>ture</span></span>
        </div>
      </footer>
    </div>
  )
}
