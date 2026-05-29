import Header from '@/components/Header'

const SECTIONS = [
  {
    heading: 'Our Commitment to Accessibility',
    body: [
      'Holoture LLC is committed to ensuring that our platform is accessible to all users, including those with disabilities. We believe that everyone deserves equal access to financial information and investment tools.',
      'We are actively working to meet the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards across our website and web application. These guidelines explain how to make web content more accessible to people with disabilities.',
      'Accessibility is an ongoing effort, and we continually review and improve our platform to provide the best possible experience for all users.',
    ],
  },
  {
    heading: 'Accessibility Standards',
    body: [
      'We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA. These guidelines cover a wide range of recommendations for making web content more accessible.',
      'WCAG 2.1 Level AA addresses the four main principles of accessibility — content must be Perceivable, Operable, Understandable, and Robust (POUR). Our goal is to meet or exceed the success criteria defined under each of these principles.',
    ],
  },
  {
    heading: 'Accessibility Features',
    body: [
      'Keyboard Navigation: All interactive elements on Holoture — including navigation links, buttons, forms, and modals — are accessible via keyboard without requiring a mouse. You can use Tab to move forward, Shift+Tab to move backward, Enter or Space to activate controls, and Escape to dismiss dialogs.',
      'Screen Reader Compatibility: Our pages use semantic HTML elements (headings, lists, buttons, labels) so that screen readers can accurately interpret and convey the content and structure of each page. We use ARIA labels where HTML semantics alone are insufficient.',
      'High Contrast Mode: Holoture includes a built-in light and dark mode toggle available in the top navigation bar. Dark mode provides a high-contrast experience for users who prefer it, while light mode offers a bright, clean interface. Both modes are designed to meet minimum contrast ratio requirements for text readability.',
      'Scalable Text: Our interface is designed to remain functional and readable when text is scaled up to 200% in your browser settings. We use relative font size units (rem/em) rather than fixed pixel sizes where possible.',
      'Alternative Text on Images: All meaningful images on Holoture include descriptive alt text so that users relying on screen readers receive equivalent information. Decorative images are marked appropriately to be skipped by assistive technology.',
      'Semantic HTML Structure: Pages are structured with proper heading hierarchies (H1, H2, H3), landmark regions (header, main, nav, footer), and meaningful link text to support navigation by assistive technologies.',
      'Focus Indicators: Interactive elements display visible focus indicators so keyboard users can clearly see which element is currently focused as they navigate the page.',
      'Color Independence: We do not rely solely on color to convey information. Signal types (BUY, SHORT, WATCH) and status indicators are accompanied by labels and icons in addition to color coding.',
    ],
  },
  {
    heading: 'Known Limitations',
    body: [
      'While we strive for full WCAG 2.1 Level AA compliance, some areas of our platform are still being improved. Known limitations include:',
      'Complex data tables: Some signal board tables and financial data grids may not yet have full ARIA table markup for screen reader row and column navigation. We are working to add this in an upcoming release.',
      'Third-party components: Some components provided by third-party services (such as Clerk authentication modals and Stripe payment forms) are managed by those providers. We encourage those providers to maintain accessibility standards but cannot directly control all aspects of their interfaces.',
      'Dynamic content: Some real-time updates to signal data and news articles may not be announced to screen reader users automatically. We are evaluating ARIA live region announcements to address this.',
      'We are committed to resolving these limitations and welcome your feedback on any accessibility issues you encounter.',
    ],
  },
  {
    heading: 'Requesting Accessibility Assistance',
    body: [
      'If you experience difficulty accessing any part of our platform due to a disability, we want to help. Please contact us and we will do our best to provide the information or functionality you need through an alternative method.',
      'To request accessibility assistance, email us at support@holoture.com with the subject line "Accessibility Assistance." Please describe the issue you are experiencing and the assistive technology you are using, and we will respond within 2 business days.',
      'We can provide content in alternative formats upon request. If you need a specific accommodation, please let us know and we will work to meet your needs.',
    ],
  },
  {
    heading: 'Feedback and Reporting Issues',
    body: [
      'Your feedback helps us improve accessibility for everyone. If you encounter an accessibility barrier on Holoture that is not listed in our known limitations, please let us know.',
      'To report an accessibility issue, email support@holoture.com with the subject line "Accessibility Feedback." Include a description of the problem, the URL of the page where you encountered it, and the browser or assistive technology you were using.',
      'We take all accessibility reports seriously and will acknowledge receipt of your feedback within 3 business days. We will include accessibility improvements in our regular development cycles and prioritize issues that significantly impact usability.',
    ],
  },
  {
    heading: 'Contact Information',
    body: [
      'For accessibility-related inquiries, assistance requests, or feedback, please contact us at:',
      'Email: support@holoture.com',
      'We are committed to providing an inclusive experience and appreciate your patience as we work to continuously improve our accessibility.',
    ],
  },
]

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* Page header */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">Accessibility Statement</h1>
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
