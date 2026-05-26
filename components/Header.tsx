'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser, UserButton } from '@clerk/nextjs'
import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Header() {
  const pathname = usePathname()
  const { isSignedIn, isLoaded } = useUser()

  return (
    <header
      style={{ borderBottom: '1px solid #1d3a72', backgroundColor: '#0f2040' }}
      className="sticky top-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <div
              style={{ backgroundColor: '#14b8a6' }}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
            >
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              Holo<span style={{ color: '#14b8a6' }}>ture</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <NavLink href="/dashboard" active={pathname === '/dashboard'}>
              Dashboard
            </NavLink>
            <NavLink href="/pricing" active={pathname === '/pricing'}>
              Pricing
            </NavLink>
          </nav>

          <div className="flex items-center gap-3">
            {isLoaded && !isSignedIn && (
              <>
                <Link
                  href="/sign-in"
                  style={{ color: '#94a3b8' }}
                  className="text-sm font-medium hover:text-white transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  style={{ backgroundColor: '#14b8a6' }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  Get Started
                </Link>
              </>
            )}
            {isLoaded && isSignedIn && (
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: 'w-9 h-9',
                  },
                }}
              />
            )}
          </div>
        </div>
      </div>
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
        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
        active ? 'text-white' : 'text-slate-400 hover:text-white'
      )}
      style={active ? { backgroundColor: '#152c58', color: '#14b8a6' } : {}}
    >
      {children}
    </Link>
  )
}
