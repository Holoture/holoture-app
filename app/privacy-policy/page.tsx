import Header from '@/components/Header'

const SECTIONS = [
  {
    heading: 'Introduction',
    body: [
      'Holoture LLC ("Holoture," "we," "us," or "our") operates the Holoture platform, accessible at holoture.com. This Privacy Policy explains how we collect, use, disclose, and protect your information when you use our website and services.',
      'By creating an account or using Holoture, you agree to the collection and use of information as described in this policy. If you do not agree, please do not use our services.',
    ],
  },
  {
    heading: 'Information We Collect',
    body: [
      'Account Information: When you register, we collect your email address and name through our authentication provider, Clerk. We do not store your password — authentication is handled entirely by Clerk.',
      'Usage Data: We collect information about how you interact with our platform, including pages visited, signals viewed, and features used. This helps us understand what is working and where we can improve.',
      'Payment Information: All payment processing is handled by Stripe. Holoture never receives, stores, or processes your credit card number or banking details. Stripe provides us with limited billing information such as your subscription status, plan type, and the last four digits of your card for display purposes.',
      'Promo Codes: If you redeem a promotional code, we log which code was used and associate it with your account to prevent duplicate redemptions.',
      'Technical Data: We may collect your IP address, browser type, device type, and operating system for security, fraud prevention, and service improvement purposes.',
    ],
  },
  {
    heading: 'How We Use Your Information',
    body: [
      'To provide and operate the Holoture service, including displaying signals appropriate to your subscription tier.',
      'To manage your account, process payments, and handle subscription upgrades or cancellations.',
      'To send transactional communications such as billing receipts, account notifications, and service updates.',
      'To analyze usage patterns and improve the quality of our signals, features, and user experience.',
      'To detect and prevent fraudulent activity, abuse, and security incidents.',
      'We do not use your information to make automated decisions that have significant legal or financial effects on you.',
    ],
  },
  {
    heading: 'Data Sharing and Disclosure',
    body: [
      'We do not sell, rent, or trade your personal information to third parties.',
      'Clerk: We use Clerk for user authentication. Clerk processes login credentials, session management, and identity verification. Clerk\'s privacy policy governs their handling of authentication data.',
      'Stripe: We use Stripe for payment processing. Stripe is a PCI-DSS Level 1 certified payment processor. Stripe\'s privacy policy governs their handling of payment data.',
      'We may disclose your information if required to do so by law, court order, or governmental authority, or if we believe disclosure is necessary to protect the rights, property, or safety of Holoture, our users, or others.',
    ],
  },
  {
    heading: 'Data Retention and Deletion',
    body: [
      'We retain your account information for as long as your account is active or as needed to provide services. If you close your account, we will delete or anonymize your personal data within 30 days, except where we are required to retain it for legal or compliance purposes.',
      'To request deletion of your account and associated data, email us at support@holoture.com. We will process your request within 30 days.',
    ],
  },
  {
    heading: 'Cookies and Analytics',
    body: [
      'Holoture uses essential session cookies to keep you logged in and maintain your preferences (such as light/dark mode). These cookies are strictly necessary for the service to function.',
      'We may use anonymized analytics tools to understand aggregate usage patterns. These tools do not identify you personally. You may opt out by disabling cookies in your browser, though this may affect service functionality.',
    ],
  },
  {
    heading: 'Your Rights',
    body: [
      'Access: You may request a copy of the personal data we hold about you.',
      'Correction: You may request that we correct inaccurate information.',
      'Deletion: You may request that we delete your personal data, subject to certain legal limitations.',
      'Portability: You may request that we provide your data in a portable format.',
      'To exercise any of these rights, please contact us at support@holoture.com. We will respond to requests within 30 days.',
    ],
  },
  {
    heading: 'Security',
    body: [
      'We implement reasonable technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.',
    ],
  },
  {
    heading: 'Children\'s Privacy',
    body: [
      'Holoture is not directed to individuals under the age of 18. We do not knowingly collect personal information from minors. If we learn that we have collected information from a child under 18, we will delete it promptly.',
    ],
  },
  {
    heading: 'Contact Information',
    body: [
      'If you have questions or concerns about this Privacy Policy or how we handle your data, please contact us at: support@holoture.com',
    ],
  },
]

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">Privacy Policy</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Last updated: May 2026</p>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {SECTIONS.map(({ heading, body }) => (
            <div
              key={heading}
              className="rounded-xl p-6"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              <h2 className="text-lg font-bold text-white mb-4">{heading}</h2>
              <div className="space-y-3">
                {body.map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed text-white" style={{ opacity: 0.85 }}>
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
