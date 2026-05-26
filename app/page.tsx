import Link from 'next/link'
import { TrendingUp, Shield, Zap, BarChart3, Clock, Star, ChevronRight } from 'lucide-react'
import Header from '@/components/Header'

const FEATURES = [
  {
    icon: Zap,
    title: 'AI-Generated Signals',
    desc: 'Every pick is powered by our AI engine analyzing fundamentals, technicals, and market sentiment.',
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

const SAMPLE_TICKERS = ['NVDA', 'MSFT', 'AAPL', 'META', 'AMZN', 'TSLA']

export default function LandingPage() {
  return (
    <div className="min-h-full" style={{ backgroundColor: '#353535' }}>
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
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8"
            style={{
              backgroundColor: 'rgba(0,155,255,0.12)',
              border: '1px solid rgba(0,155,255,0.3)',
              color: '#009BFF',
            }}
          >
            <Zap className="w-3 h-3" />
            AI-Powered Investment Signals
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-tight tracking-tight">
            Trade Smarter with
            <br />
            <span style={{ color: '#009BFF' }}>AI-Curated Signals</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl max-w-2xl mx-auto text-white">
            Holoture delivers daily AI-generated stock signals with precise entry zones,
            confidence scores, and clear time horizons — so you always know what to watch.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#009BFF' }}
            >
              Start Free Today
              <ChevronRight className="w-5 h-5" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-lg transition-colors text-white"
              style={{ backgroundColor: '#404040', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              View Pricing
            </Link>
          </div>

          <div className="mt-14 flex flex-wrap justify-center gap-3">
            {SAMPLE_TICKERS.map((ticker) => (
              <div
                key={ticker}
                className="flex items-center gap-2 px-4 py-2 rounded-lg"
                style={{ backgroundColor: '#404040', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                <TrendingUp className="w-4 h-4" style={{ color: '#009BFF' }} />
                <span className="font-bold text-white text-sm">{ticker}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20" style={{ backgroundColor: '#404040' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Everything You Need to Invest with Confidence
            </h2>
            <p className="mt-4 text-lg text-white">Stop guessing. Start trading with AI-backed conviction.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-xl p-6"
                style={{ backgroundColor: '#353535', border: '1px solid rgba(255,255,255,0.2)' }}
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

      {/* Pricing Preview */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-white">Simple, Transparent Pricing</h2>
            <p className="mt-4 text-white">Start free. Upgrade when you're ready.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Free */}
            <div
              className="rounded-2xl p-8"
              style={{ backgroundColor: '#404040', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              <p className="text-sm font-semibold uppercase tracking-wider text-white">Free</p>
              <div className="mt-3 mb-6">
                <span className="text-5xl font-black text-white">$0</span>
                <span className="ml-1 text-white">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['1 randomized AI signal per day', 'Basic signal info', 'No credit card required'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-white">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#009BFF' }} />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className="block w-full text-center py-3 rounded-xl font-semibold transition-colors text-white"
                style={{ backgroundColor: '#3a3a3a', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro */}
            <div
              className="rounded-2xl p-8 relative"
              style={{
                background: 'linear-gradient(135deg, #404040 0%, #3a3a3a 100%)',
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
                  'Full curated signal board (10+ signals)',
                  'Entry zones & price targets',
                  'AI confidence scores',
                  'Time horizons & full thesis',
                  'Daily signal updates',
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
              <Link
                href="/sign-up"
                className="block w-full text-center py-3 rounded-xl font-bold text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#009BFF' }}
              >
                Start Pro — $15/month
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.2)', backgroundColor: '#404040' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" style={{ color: '#009BFF' }} />
            <span className="font-bold text-white">Holo<span style={{ color: '#009BFF' }}>ture</span></span>
          </div>
          <p className="text-sm text-white">© {new Date().getFullYear()} Holoture. Not financial advice.</p>
        </div>
      </footer>
    </div>
  )
}
