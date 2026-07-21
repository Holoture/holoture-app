import Header from '@/components/Header'
import { AlertTriangle } from 'lucide-react'

const SECTIONS = [
  {
    heading: 'Acceptance of Terms',
    body: [
      'By accessing or using Holoture (holoture.com), you agree to be bound by these Terms of Service ("Terms") and our Privacy Policy. If you do not agree to these Terms, you may not use our services.',
      'Holoture LLC ("Holoture," "we," "us," or "our") reserves the right to update these Terms at any time. Continued use of the service after changes are posted constitutes your acceptance of the revised Terms.',
    ],
  },
  {
    heading: 'Description of Service',
    body: [
      'Holoture is a data-powered investment signal platform. We publish curated stock signals — including BUY, SELL, SHORT, HOLD, and WATCH recommendations — generated through analysis of market data, fundamentals, technicals, and sector trends.',
      'Signals include entry price zones, price targets, stop-loss levels, confidence scores, time horizons, and investment theses. These are provided strictly for informational and educational purposes.',
    ],
  },
  {
    heading: 'Not Financial Advice',
    body: [
      'IMPORTANT: Holoture is not a registered investment advisor, broker-dealer, or financial planning firm. Nothing on this platform constitutes personalized financial advice, a solicitation to buy or sell any security, or a guarantee of investment performance.',
      'All signals are provided "as is" for informational purposes only. Past signal performance does not guarantee future results. Investing in stocks, options, and other securities involves substantial risk, including the possible loss of principal.',
      'You are solely responsible for your own investment decisions. Always conduct your own research and consult a licensed financial advisor before making any investment.',
    ],
    prominent: true,
  },
  {
    heading: 'Subscription Terms',
    body: [
      'Free Tier: Free accounts receive one curated signal per day with basic signal information. No credit card is required.',
      'Pro Tier ($15/month): Pro subscribers receive access to the full signal board, including entry zones, targets, stop-losses, confidence scores, and full investment theses. Billed monthly via Stripe.',
      'Max Tier ($25/month): Max subscribers receive everything in Pro, plus access to options signals, the Politician Stock Scanner, momentum signals, and all signal categories. Billed monthly via Stripe.',
      'Subscriptions renew automatically each month unless cancelled. You may cancel at any time through your account settings or by emailing support@holoture.com. Upon cancellation, your access continues through the end of the current billing period, then reverts to the Free tier.',
      'We reserve the right to change subscription pricing with 30 days\' notice. Price changes will not affect your current billing period.',
    ],
  },
  {
    heading: 'Promo Codes and Promotional Access',
    body: [
      'Holoture may issue promotional codes that grant free or discounted access to Pro or Max features, either for a fixed period (e.g., 30 days) or on a lifetime basis.',
      'Each promo code may only be redeemed once per user account. Attempting to circumvent this restriction by creating multiple accounts is a violation of these Terms.',
      'Promotional access has no cash value and is non-transferable. Holoture reserves the right to revoke promotional access at any time if misuse is detected.',
      'Lifetime promotional access grants access for as long as Holoture continues to operate the service at the tier specified by the code.',
    ],
  },
  {
    heading: 'Acceptable Use',
    body: [
      'You agree not to: (a) scrape, reproduce, or redistribute our signal data for commercial purposes; (b) share your account credentials with others; (c) use the service to engage in market manipulation; (d) reverse engineer, decompile, or tamper with any part of the platform; (e) use automated tools to access the service at a rate that burdens our infrastructure; or (f) use the service in any way that violates applicable law.',
      'Violation of these restrictions may result in immediate account termination without refund.',
    ],
  },
  {
    heading: 'Intellectual Property',
    body: [
      'All content on Holoture — including signal data, analyses, theses, software, logos, and design — is the intellectual property of Holoture LLC and is protected by applicable copyright and trademark law.',
      'You are granted a limited, non-exclusive, non-transferable license to access and use the service for your personal, non-commercial purposes. You may not copy, redistribute, or create derivative works from any Holoture content without our express written permission.',
    ],
  },
  {
    heading: 'Limitation of Liability',
    body: [
      'To the maximum extent permitted by law, Holoture LLC, its officers, employees, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to investment losses, lost profits, or loss of data, arising from your use of or inability to use the service.',
      'In no event shall our total liability exceed the amount you paid to Holoture in the 12 months preceding the event giving rise to the claim, or $100, whichever is greater.',
      'Some jurisdictions do not allow the exclusion of certain warranties or limitation of liability; in such jurisdictions, our liability is limited to the greatest extent permitted by law.',
    ],
  },
  {
    heading: 'Indemnification',
    body: [
      'You agree to indemnify and hold harmless Holoture LLC and its officers, employees, and affiliates from any claims, damages, losses, liabilities, and expenses (including reasonable legal fees) arising from: (a) your use of the service; (b) your violation of these Terms; (c) your violation of any applicable law or third-party rights; or (d) any investment decisions you make based on information from Holoture.',
    ],
  },
  {
    heading: 'Termination',
    body: [
      'We reserve the right to suspend or terminate your account at any time, with or without notice, for conduct that violates these Terms or that we believe is harmful to other users, third parties, or the service.',
      'Upon termination, your right to access the service ends immediately. Paid subscriptions will not be refunded except where required by law.',
    ],
  },
  {
    heading: 'Governing Law',
    body: [
      'These Terms are governed by and construed in accordance with the laws of the State of Indiana, United States, without regard to conflict of law principles.',
      'Any disputes arising from these Terms or your use of Holoture shall be subject to the exclusive jurisdiction of the state and federal courts located in Indiana.',
    ],
  },
  {
    heading: 'Changes to Terms',
    body: [
      'We may update these Terms from time to time. When we do, we will update the "Last updated" date at the top of this page. For material changes, we will provide additional notice (such as an email or an in-app notification).',
      'Your continued use of Holoture after any changes take effect constitutes your acceptance of the new Terms.',
    ],
  },
  {
    heading: 'Contact Information',
    body: [
      'If you have questions about these Terms, please contact us at: support@holoture.com',
    ],
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">Terms of Service</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Last updated: May 2026</p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {SECTIONS.map(({ heading, body, prominent }) => (
            <div
              key={heading}
              className="rounded-xl p-6"
              style={
                prominent
                  ? {
                      background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(239,68,68,0.08) 100%)',
                      border: '1px solid rgba(245,158,11,0.4)',
                    }
                  : { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }
              }
            >
              {prominent && (
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#fbbf24' }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#fbbf24' }}>
                    Important Disclaimer
                  </span>
                </div>
              )}
              <h2 className="text-lg font-bold text-white mb-4">{heading}</h2>
              <div className="space-y-3">
                {body.map((para, i) => (
                  <p
                    key={i}
                    className="text-sm leading-relaxed text-white"
                    style={{ opacity: prominent ? 1 : 0.85 }}
                  >
                    {para}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
