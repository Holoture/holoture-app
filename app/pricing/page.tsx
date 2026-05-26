import Link from 'next/link'
import { Check, Star, TrendingUp } from 'lucide-react'
import Header from '@/components/Header'
import CheckoutButton from '@/components/CheckoutButton'

const FREE_FEATURES = [
  '1 randomized AI signal per day',
  'Basic ticker and signal type',
  'No credit card required',
  'Cancel anytime',
]

const PRO_FEATURES = [
  'Full curated signal board (10+ signals daily)',
  'Precise entry zones (low & high)',
  'AI confidence scores (0–100)',
  'Price targets & stop-loss levels',
  'Time horizons (days to months)',
  'Full AI thesis & summary',
  'Sector tagging & filtering',
  'Daily signal refreshes',
  'Cancel anytime',
]

export default function PricingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a1628' }}>
      <Header />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-black text-white">
            Choose Your Plan
          </h1>
          <p className="mt-4 text-lg" style={{ color: '#94a3b8' }}>
            Start free. Upgrade to Pro when you want the full picture.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Free Tier */}
          <div
            className="rounded-2xl p-8 flex flex-col"
            style={{ backgroundColor: '#0f2040', border: '1px solid #1d3a72' }}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>
                Free
              </p>
              <div className="mt-4 mb-2">
                <span className="text-5xl font-black text-white">$0</span>
              </div>
              <p className="text-sm" style={{ color: '#94a3b8' }}>Forever free, no card needed</p>
            </div>

            <ul className="mt-8 space-y-4 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm" style={{ color: '#94a3b8' }}>
                  <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#14b8a6' }} />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/sign-up"
              className="mt-8 block w-full text-center py-3.5 rounded-xl font-semibold transition-colors"
              style={{ backgroundColor: '#152c58', color: '#e2e8f0', border: '1px solid #1d3a72' }}
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro Tier */}
          <div
            className="rounded-2xl p-8 flex flex-col relative"
            style={{
              background: 'linear-gradient(160deg, #0f2040 0%, #152c58 100%)',
              border: '2px solid rgba(20,184,166,0.5)',
            }}
          >
            <div
              className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-bold"
              style={{ backgroundColor: '#14b8a6', color: 'white' }}
            >
              <Star className="w-3 h-3" />
              RECOMMENDED
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#14b8a6' }}>
                Pro
              </p>
              <div className="mt-4 mb-2 flex items-end gap-2">
                <span className="text-5xl font-black text-white">$15</span>
                <span className="mb-2" style={{ color: '#94a3b8' }}>/month</span>
              </div>
              <p className="text-sm" style={{ color: '#94a3b8' }}>Billed monthly, cancel anytime</p>
            </div>

            <ul className="mt-8 space-y-4 flex-1">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-white">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: 'rgba(20,184,166,0.2)' }}
                  >
                    <Check className="w-3 h-3" style={{ color: '#14b8a6' }} />
                  </div>
                  {f}
                </li>
              ))}
            </ul>

            <CheckoutButton />
          </div>
        </div>

        <p className="text-center mt-10 text-sm" style={{ color: '#94a3b8' }}>
          Payments processed securely by Stripe. Holoture does not store your card details.
          <br />
          <span className="font-medium" style={{ color: '#14b8a6' }}>Not financial advice.</span> Always do your own research.
        </p>
      </div>

      <footer style={{ borderTop: '1px solid #1d3a72', backgroundColor: '#0f2040' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: '#14b8a6' }} />
          <span className="text-sm font-bold text-white">
            Holo<span style={{ color: '#14b8a6' }}>ture</span>
          </span>
          <span className="text-sm" style={{ color: '#94a3b8' }}>— AI Stock Signals</span>
        </div>
      </footer>
    </div>
  )
}

