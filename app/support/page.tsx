import Header from '@/components/Header'
import Link from 'next/link'
import { HelpCircle, ChevronDown, Mail, MessageCircle } from 'lucide-react'

const FAQS = [
  {
    q: 'What is Holoture?',
    a: 'Holoture is an AI-powered investment signal platform. We publish daily curated stock signals with entry zones, confidence scores, price targets, stop-losses, and full investment theses — so you can trade with structure and conviction.',
  },
  {
    q: 'Are these signals financial advice?',
    a: 'No. Signals are informational only and not personalized financial advice. Always do your own research, understand the risks, and consult a licensed advisor before making any investment decisions.',
  },
  {
    q: 'How often are signals updated?',
    a: 'The signal board is refreshed daily. New signals are added as setups emerge, and inactive or outdated signals are removed. Pro members see the full board; free members receive one randomly selected signal each day.',
  },
  {
    q: 'What is the difference between Free and Pro?',
    a: 'Free members get one randomized signal per day with basic info. Pro members get the full curated board — 10+ signals with entry zones, AI confidence scores, price targets, stop-losses, time horizons, and full thesis.',
  },
  {
    q: 'How do I upgrade to Pro?',
    a: 'Visit the Pricing page and click "Upgrade to Pro." You will be taken to a secure Stripe checkout. After payment, your account upgrades instantly and you can access the full signal board right away.',
  },
  {
    q: 'How do I cancel my Pro subscription?',
    a: 'You can cancel anytime. Your access continues until the end of the current billing period, then reverts to the free tier. To cancel, visit your account settings or email us at support@holoture.com.',
  },
  {
    q: 'How is the confidence score calculated?',
    a: 'The confidence score (0–100%) is a composite of technical setup quality, fundamental data, sector momentum, and historical pattern reliability. It is a measure of signal conviction — not a guarantee of profit.',
  },
  {
    q: 'What do the signal types mean?',
    a: 'BUY: AI expects price appreciation over the stated horizon. SELL/SHORT: AI anticipates a decline. HOLD: maintain existing positions. WATCH: worth monitoring — no action yet.',
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

export default function SupportPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#353535' }}>
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-1">
            <HelpCircle className="w-6 h-6" style={{ color: '#009BFF' }} />
            <h1 className="text-2xl font-black text-white">Support</h1>
          </div>
          <p className="text-sm text-white">Answers to common questions, plus how to get in touch</p>
        </div>

        {/* FAQ */}
        <div className="mb-10">
          <h2 className="text-lg font-bold text-white mb-5">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group rounded-xl overflow-hidden" style={{ backgroundColor: '#404040', border: '1px solid rgba(255,255,255,0.2)' }}>
                <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none hover:bg-white/5 transition-colors">
                  <span className="font-semibold text-sm text-white">{faq.q}</span>
                  <ChevronDown className="w-4 h-4 text-white shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-5">
                  <p className="text-sm text-white leading-relaxed">{faq.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="rounded-2xl p-8" style={{ background: 'linear-gradient(135deg, #404040 0%, #3a3a3a 100%)', border: '1px solid rgba(0,155,255,0.3)' }}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(0,155,255,0.15)' }}>
              <MessageCircle className="w-6 h-6" style={{ color: '#009BFF' }} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Still need help?</h3>
              <p className="text-sm text-white mt-1 mb-4">
                Our team is here for you. Send us a message and we will get back to you within 1 business day.
              </p>
              <a
                href="mailto:support@holoture.com"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#009BFF' }}
              >
                <Mail className="w-4 h-4" />
                support@holoture.com
              </a>
            </div>
          </div>
        </div>

        <p className="text-center mt-8 text-xs text-white">
          Not financial advice. Always do your own research.{' '}
          <Link href="/pricing" className="hover:opacity-70 transition-opacity" style={{ color: '#009BFF' }}>View pricing</Link>
        </p>
      </div>
    </div>
  )
}
