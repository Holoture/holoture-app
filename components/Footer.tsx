import Link from 'next/link'
import Image from 'next/image'

const PRODUCT_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/pricing', label: 'Subscription' },
  { href: '/learn', label: 'Learn' },
  { href: '/support', label: 'Support' },
]

const LEGAL_LINKS = [
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/cookie-policy', label: 'Cookie Policy' },
  { href: '/accessibility', label: 'Accessibility' },
  { href: '/do-not-sell', label: 'Do Not Sell My Info' },
]

export default function Footer() {
  return (
    <footer className="relative z-10" style={{ backgroundColor: 'rgba(15,15,15,0.75)', borderTop: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Image src="/logo.png" alt="Holoture" width={36} height={36} />
              <span className="font-bold text-white text-lg">
                Holo<span style={{ color: '#009BFF' }}>ture</span>
              </span>
            </div>
            <p className="text-sm text-white mb-3 leading-relaxed">
              Data-powered signals for everyday investors.
            </p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              © 2026 Holoture LLC. All rights reserved.
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
              Product
            </p>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-white hover:opacity-70 transition-opacity"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
              Legal
            </p>
            <ul className="space-y-2.5">
              {LEGAL_LINKS.map(({ href, label }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-white hover:opacity-70 transition-opacity"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Disclaimer bar */}
        <div className="pt-6" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
            Holoture is not a registered investment advisor. All signals are for informational purposes only.
          </p>
        </div>
      </div>
    </footer>
  )
}
