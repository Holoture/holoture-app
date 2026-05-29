import Header from '@/components/Header'

const SECTIONS = [
  {
    heading: 'Our Position: We Do Not Sell Your Information',
    body: [
      'Holoture LLC does not sell your personal information to third parties. We never have and we never will.',
      'Holoture also does not share your personal information for cross-context behavioral advertising — meaning we do not share your data with advertisers or ad networks so that they can serve you targeted advertisements on other websites or apps.',
      'This page is provided in compliance with the California Consumer Privacy Act (CCPA) and similar state privacy laws that require businesses to disclose their data practices and provide consumers with a mechanism to opt out of the sale or sharing of personal information.',
      'Because we do not sell or share personal information for advertising purposes, there is nothing to opt out of with respect to those practices. However, we want to be fully transparent about what information we do collect and your rights regarding that information.',
    ],
  },
  {
    heading: 'Personal Information We Collect',
    body: [
      'Account Information: When you create an account, we collect your name and email address through Clerk, our authentication provider. This information is used solely to authenticate you and provide access to your Holoture account.',
      'Payment Information: Subscription payments are processed entirely by Stripe, a PCI-DSS Level 1 certified payment processor. Holoture never receives, stores, or has access to your full credit card number, CVV, or banking details. Stripe provides us only with your subscription status, plan tier, and the last four digits of your payment method for display in your account.',
      'Usage Data: We collect information about how you use Holoture, including signals you view, features you access, and pages you visit. This data is used to improve our platform, personalize your experience (e.g., showing signals appropriate to your subscription tier), and prevent abuse.',
      'Device and Browser Information: We may collect your IP address, browser type, device type, and operating system for security, fraud prevention, and platform compatibility purposes. This data is not used for advertising targeting.',
      'Promo Code Redemptions: If you redeem a promotional code, we log the redemption against your account to prevent duplicate use.',
    ],
  },
  {
    heading: 'How We Use Your Information',
    body: [
      'We use the personal information we collect exclusively to operate and improve the Holoture service: to authenticate you, manage your subscription, display signals relevant to your plan, communicate service updates, and ensure platform security.',
      'We do not use your personal information to build advertising profiles, serve targeted ads, or share your data with data brokers.',
    ],
  },
  {
    heading: 'Your Rights Under CCPA',
    body: [
      'If you are a California resident, the California Consumer Privacy Act (CCPA) grants you the following rights regarding your personal information:',
      'Right to Know: You have the right to request that we disclose what personal information we have collected about you, the categories of sources from which it was collected, the business purposes for collecting it, and any third parties with whom it has been shared.',
      'Right to Delete: You have the right to request that we delete personal information we have collected from you, subject to certain exceptions (for example, where we are required by law to retain it, or where it is necessary to complete a transaction you requested).',
      'Right to Opt Out of Sale or Sharing: You have the right to opt out of the sale of your personal information and the sharing of your personal information for cross-context behavioral advertising. As stated above, Holoture does not engage in either of these practices, so this right is not applicable — but it remains available to you should our practices ever change.',
      'Right to Non-Discrimination: We will not discriminate against you for exercising any of your CCPA rights. Exercising your privacy rights will not result in a denial of service, different pricing, or a different level of access to Holoture.',
      'Right to Correct: You have the right to request correction of inaccurate personal information we hold about you.',
      'Right to Limit Use of Sensitive Personal Information: You have the right to limit our use of sensitive personal information to that which is necessary to provide our services. We do not collect sensitive personal information (such as social security numbers, financial account numbers, or biometric data) beyond what is described in this page.',
    ],
  },
  {
    heading: 'How to Submit a Privacy Request',
    body: [
      'To exercise any of the rights described above — including the right to know, the right to delete, or to request correction of your personal information — please contact us by email.',
      'Email: support@holoture.com',
      'Subject Line: "Privacy Request"',
      'In your request, please include your full name and the email address associated with your Holoture account, and specify which right(s) you wish to exercise and any relevant details.',
      'We will acknowledge receipt of your request within 10 business days and respond substantively within 45 days of receipt. If we require additional time (up to 90 days total), we will notify you of the extension and the reason for it.',
      'We may need to verify your identity before processing your request. We will do so using the email address associated with your account. We will not require you to create an account to submit a request, and we will not charge a fee for submitting or fulfilling a request unless it is excessive, repetitive, or manifestly unfounded.',
    ],
  },
  {
    heading: 'Third-Party Data Processors',
    body: [
      'We share limited personal information with the following third-party service providers who process data on our behalf, under contractual obligations to protect your information and use it only as directed by us:',
      'Clerk: Processes authentication data (name, email, session tokens) to manage your account login. Clerk\'s Privacy Policy: clerk.com/legal/privacy.',
      'Stripe: Processes payment information (billing details, subscription data) to manage your subscription. Stripe does not receive your Holoture usage data. Stripe\'s Privacy Policy: stripe.com/privacy.',
      'These providers are not permitted to use your personal information for their own marketing or advertising purposes.',
    ],
  },
  {
    heading: 'Authorized Agents',
    body: [
      'If you are a California resident, you may designate an authorized agent to submit a privacy request on your behalf. To do so, the authorized agent must provide written authorization signed by you, and we may require you to verify your identity directly with us before we process the request.',
    ],
  },
  {
    heading: 'Contact Information',
    body: [
      'For all privacy-related inquiries, requests, or concerns, please contact us at:',
      'Holoture LLC',
      'Email: support@holoture.com',
      'We take your privacy seriously and are committed to responding promptly and transparently to all requests.',
    ],
  },
]

export default function DoNotSellPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* Page header */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">
            Do Not Sell or Share My Personal Information
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-w50)' }}>Last updated: May 2026</p>
        </div>

        {/* Key statement banner */}
        <div
          className="rounded-xl px-6 py-5 mb-8"
          style={{
            background: 'linear-gradient(135deg, rgba(0,155,255,0.08), rgba(0,155,255,0.04))',
            border: '1px solid rgba(0,155,255,0.25)',
          }}
        >
          <p className="text-sm font-semibold text-white leading-relaxed">
            <span style={{ color: '#009BFF' }}>Holoture does not sell your personal information.</span>
            {' '}We do not share your data with advertisers or data brokers. This page exists to be transparent about your rights and our practices under the California Consumer Privacy Act (CCPA).
          </p>
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
