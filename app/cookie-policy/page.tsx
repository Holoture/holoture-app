import Header from '@/components/Header'

const SECTIONS = [
  {
    heading: 'What Are Cookies?',
    body: [
      'Cookies are small text files that are placed on your device (computer, tablet, or mobile) when you visit a website. They are widely used to make websites work efficiently, to remember your preferences, and to provide information to the website owner.',
      'Cookies are not programs and cannot carry viruses or install software on your device. They simply store small pieces of data that are sent between your browser and our servers.',
    ],
  },
  {
    heading: 'Why We Use Cookies',
    body: [
      'Holoture uses cookies to keep you signed in, remember your preferences, and ensure the platform works correctly. Without essential cookies, Holoture would not be able to function.',
      'We use the minimum number of cookies necessary to operate our service. We do not use cookies to serve advertisements, track you across third-party websites, or build behavioral profiles for marketing purposes.',
    ],
  },
  {
    heading: 'Types of Cookies We Use',
    body: [
      '1. Essential Cookies (Required — Cannot Be Disabled)',
      'These cookies are strictly necessary for Holoture to function. Without them, you cannot log in or use the service.',
      'Authentication cookies (set by Clerk): These cookies manage your login session and keep you authenticated as you navigate the site. They are set when you sign in and cleared when you sign out. Clerk uses cookies such as __client_uat and __session to maintain secure sessions. Retention: Duration of your browser session, or up to 30 days if you choose "Stay signed in."',
      'CSRF protection cookies: These cookies protect against cross-site request forgery attacks by ensuring that form submissions originate from our own pages. Retention: Session.',
      '2. Functional Cookies (Optional — Used for Preferences)',
      'These cookies remember your settings and choices to improve your experience. They are not strictly required but enhance usability.',
      'Theme preference: We store your light or dark mode preference in your browser\'s localStorage (not a traditional cookie, but a similar browser storage mechanism) so your preference is remembered between visits. Retention: Indefinite until you clear browser storage.',
      '3. Analytics Cookies (Optional)',
      'We may use anonymized, aggregated analytics to understand how users interact with Holoture in general — for example, which pages are visited most or where users encounter errors. Any analytics we use do not identify you personally and are not shared with advertising platforms. Retention: Up to 2 years.',
    ],
  },
  {
    heading: 'Cookies We Do NOT Use',
    body: [
      'Holoture does not use any of the following:',
      'Advertising or targeting cookies: We do not use cookies to serve personalized advertisements or to track your activity across other websites for advertising purposes.',
      'Third-party tracking cookies: We do not allow third-party advertising networks to place tracking cookies on your device through our platform.',
      'Social media tracking pixels: We do not embed Facebook, Twitter, or other social media tracking pixels on our pages.',
    ],
  },
  {
    heading: 'Third-Party Cookies',
    body: [
      'Some cookies are placed by third-party services we use to operate Holoture. These third parties have their own privacy and cookie policies.',
      'Clerk (Authentication): Clerk is our authentication provider. When you sign in, Clerk sets cookies on our domain to maintain your secure session. These are essential cookies. For more information, see Clerk\'s Privacy Policy at clerk.com/legal/privacy.',
      'Stripe (Payment Processing): When you visit our pricing or checkout pages, Stripe may set cookies to enable secure payment processing and fraud prevention. These are essential for completing a subscription purchase. For more information, see Stripe\'s Privacy Policy at stripe.com/privacy.',
    ],
  },
  {
    heading: 'Cookie Retention Periods',
    body: [
      'Session cookies: Deleted automatically when you close your browser.',
      'Authentication cookies (Clerk): Up to 30 days if you remain signed in, or until you sign out.',
      'Preference storage (localStorage): Retained until you manually clear your browser storage or cache.',
      'Analytics cookies (if used): Up to 2 years, after which they expire automatically.',
    ],
  },
  {
    heading: 'How to Control Cookies in Your Browser',
    body: [
      'You can manage, disable, or delete cookies through your browser settings. Please note that disabling essential cookies will prevent you from signing in to Holoture.',
      'Google Chrome: Go to Settings → Privacy and Security → Cookies and other site data. You can block or clear cookies for all sites or specific sites.',
      'Mozilla Firefox: Go to Settings → Privacy & Security → Cookies and Site Data. You can block cookies or clear existing cookies.',
      'Apple Safari: Go to Safari → Preferences → Privacy. You can block all cookies or manage them per website.',
      'Microsoft Edge: Go to Settings → Cookies and site permissions → Cookies and site data. You can block or clear cookies.',
      'Note: Clearing cookies will sign you out of Holoture and reset your preferences. You will need to sign in again on your next visit.',
    ],
  },
  {
    heading: 'Changes to This Cookie Policy',
    body: [
      'We may update this Cookie Policy from time to time to reflect changes in the cookies we use or for other legal, regulatory, or operational reasons. When we make material changes, we will update the "Last updated" date at the top of this page.',
      'We encourage you to review this page periodically to stay informed about our use of cookies.',
    ],
  },
  {
    heading: 'Contact Us',
    body: [
      'If you have any questions about our use of cookies or this Cookie Policy, please contact us at:',
      'Email: support@holoture.com',
    ],
  },
]

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* Page header */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">Cookie Policy</h1>
          <p className="text-sm" style={{ color: 'var(--text-w50)' }}>Last updated: May 2026</p>
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
