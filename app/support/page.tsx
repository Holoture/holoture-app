import Header from '@/components/Header'
import Link from 'next/link'
import { HelpCircle, ChevronDown, Mail, MessageCircle, Zap, Crown, Star } from 'lucide-react'

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'What is Holoture?',
    a: 'Holoture is a data-powered investment signal platform. We publish daily curated stock signals with entry zones, confidence scores, price targets, stop-losses, and full investment theses — so you can trade with structure and conviction.',
  },
  {
    q: 'Are these signals financial advice?',
    a: 'No. Signals are informational only and not personalized financial advice. Always do your own research, understand the risks, and consult a licensed advisor before making any investment decisions.',
  },
  {
    q: 'How often are signals updated?',
    a: 'The signal board is refreshed daily. New signals are added as setups emerge, and inactive or outdated signals are removed. Free members receive one randomly selected signal each day; Pro and Max members see the full curated board.',
  },
  {
    q: 'What are the different plans?',
    a: 'Holoture has three tiers:\n\n• Free — 1 randomly selected signal per day with basic access to the signal board.\n\n• Pro ($15/month) — Full signal board with all entry zones, confidence scores, price targets, stop-losses, and AI thesis. Includes Swing Trade and Long Term signals, up to 5 Momentum signals per day, plus News, Trends, and Earnings Calendar.\n\n• Max ($25/month) — Everything in Pro, plus unlimited Momentum signals, Options Signals (CALL/PUT setups), and the Politician Stock Scanner (real-time Congress trade disclosures).',
  },
  {
    q: 'What is Holoture Max?',
    a: 'Holoture Max is our premium tier at $25/month. It includes everything in Pro, plus three exclusive features:\n\n• Unlimited Momentum Signals — no 5-signal cap, see every high-conviction BUY setup.\n\n• Options Signals — curated CALL and PUT contract setups with strike prices, expiration dates, and risk ratings.\n\n• Politician Stock Scanner — track real-time stock purchase and sale disclosures filed by US Congress members, with commentary and significance ratings.\n\nMax is designed for active traders who want the full Holoture data stack.',
  },
  {
    q: 'How do I upgrade to Pro or Max?',
    a: 'Visit the Pricing page and click "Upgrade to Pro" or "Upgrade to Max." You will be taken to a secure Stripe checkout. After payment, your account upgrades instantly — no waiting, no manual approval. You can access all features right away.',
  },
  {
    q: 'How do I upgrade from Pro to Max?',
    a: 'You can upgrade from Pro to Max at any time. Visit the Pricing page, click "Upgrade to Max," and complete the Stripe checkout. Stripe will prorate the difference so you are only charged for the remaining days in your billing period. Your account upgrades instantly upon payment.',
  },
  {
    q: 'How do I cancel my subscription?',
    a: 'You can cancel anytime — no questions asked. Your access continues until the end of the current billing period, then reverts to the free tier. To cancel, visit your account settings or email us at support@holoture.com and we will handle it for you.',
  },
  {
    q: 'How is the confidence score calculated?',
    a: 'The confidence score (0–100%) is a composite of technical setup quality, fundamental data, sector momentum, and historical pattern reliability. It is a measure of signal conviction — not a guarantee of profit.',
  },
  {
    q: 'What do the signal types mean?',
    a: 'BUY: the signal expects price appreciation over the stated horizon. SHORT/SELL: the signal anticipates a decline. WATCH: worth monitoring — a setup is forming but no action yet.',
  },
  {
    q: 'Is my payment information secure?',
    a: 'Yes. All payments are processed by Stripe, a PCI-compliant payment processor. Holoture never stores your credit card details.',
  },
  {
    q: 'I found a bug or have feedback. How do I reach you?',
    a: 'Email us at support@holoture.com. We read every message and typically reply within 1 business day.',
  },
]

// ─── Tier overview cards ───────────────────────────────────────────────────────

const TIERS = [
  {
    icon:  Star,
    label: 'Free',
    price: '$0',
    color: 'var(--text-w50)',
    border: 'var(--border)',
    bg:    'var(--surf-w4)',
    features: [
      '1 signal per day (random pick)',
      'Basic signal board access',
      'Signal type & ticker visible',
    ],
  },
  {
    icon:  Crown,
    label: 'Pro',
    price: '$15/mo',
    color: '#009BFF',
    border: 'rgba(0,155,255,0.4)',
    bg:    'rgba(0,155,255,0.07)',
    features: [
      'Full signal board (10+ signals)',
      'Entry zones, targets & stop-losses',
      'AI thesis & confidence scores',
      'Up to 5 Momentum signals/day',
      'News, Trends & Earnings Calendar',
      'Swing Trade & Long Term signals',
    ],
  },
  {
    icon:  Zap,
    label: 'Max',
    price: '$25/mo',
    color: '#a78bfa',
    border: 'rgba(124,58,237,0.45)',
    bg:    'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(79,70,229,0.07))',
    features: [
      'Everything in Pro',
      'Unlimited Momentum signals',
      'Options Signals (CALL & PUT)',
      'Politician Stock Scanner',
      'Congress trade disclosures + AI',
    ],
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Page header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-1">
            <HelpCircle className="w-6 h-6" style={{ color: '#009BFF' }} />
            <h1 className="text-2xl font-black text-white">Support</h1>
          </div>
          <p className="text-sm text-white">Answers to common questions, plus how to get in touch</p>
        </div>

        {/* ── Plan overview ── */}
        <div className="mb-10">
          <h2 className="text-lg font-bold text-white mb-5">Plans at a Glance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {TIERS.map((tier) => {
              const Icon = tier.icon
              return (
                <div
                  key={tier.label}
                  className="rounded-xl p-5 flex flex-col gap-3"
                  style={{
                    background: tier.bg,
                    border: `1px solid ${tier.border}`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" style={{ color: tier.color }} />
                      <span className="font-bold text-white">{tier.label}</span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: tier.color }}>
                      {tier.price}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--text-w70)' }}>
                        <span style={{ color: tier.color, marginTop: 1 }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
          <div className="mt-4 text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#009BFF', color: 'white' }}
            >
              View Pricing &amp; Upgrade
            </Link>
          </div>
        </div>

        {/* ── FAQ accordion ── */}
        <div className="mb-10">
          <h2 className="text-lg font-bold text-white mb-5">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-xl overflow-hidden"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              >
                <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none hover:bg-white/5 transition-colors">
                  <span className="font-semibold text-sm text-white">{faq.q}</span>
                  <ChevronDown className="w-4 h-4 text-white shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-5">
                  {faq.a.includes('\n') ? (
                    <div className="text-sm text-white leading-relaxed space-y-2">
                      {faq.a.split('\n').filter(Boolean).map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-white leading-relaxed">{faq.a}</p>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* ── Contact card ── */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-surface-2) 100%)',
            border: '1px solid rgba(0,155,255,0.3)',
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(0,155,255,0.15)' }}
            >
              <MessageCircle className="w-6 h-6" style={{ color: '#009BFF' }} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Still need help?</h3>
              <p className="text-sm text-white mt-1 mb-4">
                Our team is here for you. Send us a message and we will get back to you within 1 business day.
              </p>
              <a
                href="mailto:support@holoture.com"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#009BFF', color: 'white' }}
              >
                <Mail className="w-4 h-4" />
                support@holoture.com
              </a>
            </div>
          </div>
        </div>

        <p className="text-center mt-8 text-xs text-white">
          Not financial advice. Always do your own research.{' '}
          <Link href="/pricing" className="hover:opacity-70 transition-opacity" style={{ color: '#009BFF' }}>
            View pricing
          </Link>
        </p>
      </div>
    </div>
  )
}
