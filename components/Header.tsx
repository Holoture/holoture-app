'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useUser, UserButton } from '@clerk/nextjs'
import { Menu, X, Gift, Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'
import PromoModal from './PromoModal'
import { useTheme } from './ThemeProvider'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/news', label: 'News' },
  { href: '/trends', label: 'Trends' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/politician-scanner', label: 'Politician Scanner' },
  { href: '/learn', label: 'Learn' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/support', label: 'Support' },
  { href: '/pricing', label: 'Pricing' },
]

export default function Header() {
  const pathname = usePathname()
  const { isSignedIn, isLoaded } = useUser()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [promoOpen, setPromoOpen] = useState(false)
  const { theme, toggle } = useTheme()

  return (
    <header
      style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}
      className="sticky top-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image src="/logo.png" alt="Holoture" height={52} width={52} />
            <span className="text-xl font-bold text-white tracking-tight">
              Holo<span style={{ color: '#009BFF' }}>ture</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
            {NAV_LINKS.map(({ href, label }) => (
              <NavLink key={href} href={href} active={pathname === href}>
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {isLoaded && !isSignedIn && (
              <>
                <Link
                  href="/sign-in"
                  className="text-sm font-medium text-white hover:opacity-70 transition-opacity hidden sm:block"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  style={{ backgroundColor: '#009BFF', color: 'white' }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Get Started
                </Link>
              </>
            )}
            {isLoaded && isSignedIn && (
              <>
                <button
                  onClick={toggle}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
                  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setPromoOpen(true)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
                  title="Redeem promo code"
                >
                  <Gift className="w-5 h-5" />
                </button>
                <UserButton appearance={{ elements: { avatarBox: 'w-9 h-9' } }} />
              </>
            )}
            <button
              className="lg:hidden p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      <PromoModal isOpen={promoOpen} onClose={() => setPromoOpen(false)} />

      {mobileOpen && (
        <div
          className="lg:hidden border-t"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
        >
          <nav className="max-w-7xl mx-auto px-4 py-3 grid grid-cols-2 gap-1">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname === href
                    ? 'text-white bg-white/10'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'px-4 py-2.5 rounded-lg text-[15px] font-medium transition-colors whitespace-nowrap',
        active ? 'text-white bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/5'
      )}
    >
      {children}
    </Link>
  )
}
