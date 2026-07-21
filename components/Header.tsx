'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useUser, UserButton } from '@clerk/nextjs'
import { Menu, X, Gift, ChevronDown, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import PromoModal from './PromoModal'

type DropdownItemConfig = {
  href: string
  label: string
  available: boolean
  desc: string
}

// "Signals" and "Markets" are dropdowns; the rest stay top-level tabs.
const SIGNALS_MENU: DropdownItemConfig[] = [
  { href: '/dashboard', label: 'Equities', available: true,  desc: 'Stock signal board' },
  { href: '/options',   label: 'Options',  available: true,  desc: 'CALL & PUT ideas' },
  { href: '/signals/futures',       label: 'Futures',  available: false, desc: 'Coming soon' },
  { href: '/signals/forex',         label: 'Forex',    available: false, desc: 'Coming soon' },
]

const MARKETS_MENU: DropdownItemConfig[] = [
  { href: '/news',     label: 'News',     available: true, desc: 'Market news feed' },
  { href: '/trends',   label: 'Trends',   available: true, desc: 'Sector trends & heat map' },
  { href: '/calendar', label: 'Calendar', available: true, desc: 'Earnings calendar' },
  { href: '/movers',   label: 'Movers',   available: true, desc: 'Premarket & after-hours movers' },
]

const SCANNERS_MENU: DropdownItemConfig[] = [
  { href: '/politician-scanner', label: 'Politician Scanner', available: true, desc: 'Congressional trades' },
  { href: '/insider-scanner',    label: 'Insider Scanner',    available: true, desc: 'Insider buying activity' },
]

const NAV_LINKS = [
  { href: '/learn', label: 'Learn' },
  { href: '/tracker', label: 'Tracker' },
  { href: '/support', label: 'Support' },
  { href: '/pricing', label: 'Subscription' },
]

export default function Header() {
  const pathname = usePathname()
  const { isSignedIn, isLoaded } = useUser()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [promoOpen, setPromoOpen] = useState(false)

  // Silently sync the authenticated user to the database on every page load.
  // This handles the dev→prod Clerk key migration (same email, new user ID) so
  // the user row always exists before any API calls that need it (e.g. checkout).
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    fetch('/api/user/sync', { method: 'POST' }).catch(() => {/* silent — non-critical */})
  }, [isLoaded, isSignedIn])

  const signalsActive = pathname === '/dashboard' || pathname === '/options' || pathname.startsWith('/signals')
  const marketsActive = MARKETS_MENU.some((m) => pathname === m.href)
  const scannersActive = SCANNERS_MENU.some((s) => pathname === s.href)

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
            <NavDropdown label="Signals" items={SIGNALS_MENU} active={signalsActive} />
            <NavDropdown label="Markets" items={MARKETS_MENU} active={marketsActive} />
            <NavDropdown label="Scanners" items={SCANNERS_MENU} active={scannersActive} />
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
                <ForumPill />
              </>
            )}
            {isLoaded && isSignedIn && (
              <>
                <button
                  onClick={() => setPromoOpen(true)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
                  title="Redeem promo code"
                >
                  <Gift className="w-5 h-5" />
                </button>
                <UserButton appearance={{ elements: { avatarBox: 'w-9 h-9' } }} />
                <ForumPill />
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
          <nav className="max-w-7xl mx-auto px-4 py-3">
            <MobileDropdownSection
              label="Signals"
              items={SIGNALS_MENU}
              defaultExpanded={pathname === '/dashboard' || pathname === '/options' || pathname.startsWith('/signals')}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
            <MobileDropdownSection
              label="Markets"
              items={MARKETS_MENU}
              defaultExpanded={MARKETS_MENU.some((m) => pathname === m.href)}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
            <MobileDropdownSection
              label="Scanners"
              items={SCANNERS_MENU}
              defaultExpanded={SCANNERS_MENU.some((s) => pathname === s.href)}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
            <div className="grid grid-cols-2 gap-1 mt-1">
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
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

// ── Desktop nav dropdown ────────────────────────────────────────────────────────

function NavDropdown({
  label,
  items,
  active,
}: {
  label: string
  items: DropdownItemConfig[]
  active: boolean
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        data-active={active}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'nav-tab flex items-center gap-1 px-4 py-2.5 rounded-lg text-[17px] font-medium transition-colors whitespace-nowrap',
          active ? 'text-white bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/5'
        )}
      >
        {label}
        <ChevronDown
          className={cn('w-4 h-4 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full pt-2 w-60 z-50"
        >
          <div
            className="rounded-xl overflow-hidden term-panel"
            style={{
              backgroundColor: 'var(--bg-surface)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,155,255,0.15)',
            }}
          >
            {items.map((item) => (
              <DropdownItem key={item.href} item={item} onNavigate={() => setOpen(false)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DropdownItem({
  item,
  onNavigate,
}: {
  item: DropdownItemConfig
  onNavigate: () => void
}) {
  const content = (
    <div className="flex items-center justify-between gap-2 px-4 py-3">
      <div>
        <p className={cn('text-sm font-semibold', item.available ? 'text-white' : 'text-white/40')}>
          {item.label}
        </p>
        <p className="text-xs font-data mt-0.5" style={{ color: 'var(--text-w40)' }}>
          {item.desc}
        </p>
      </div>
      {!item.available && <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-w35)' }} />}
    </div>
  )

  // Greyed-out (unavailable) items still link to a clean "coming soon" page.
  return (
    <Link
      href={item.href}
      role="menuitem"
      onClick={onNavigate}
      className={cn(
        'block transition-colors border-b last:border-b-0',
        item.available ? 'hover:bg-white/5' : 'opacity-70 hover:bg-white/[0.02]'
      )}
      style={{ borderColor: 'var(--border-faint)' }}
    >
      {content}
    </Link>
  )
}

// ── Mobile dropdown section ──────────────────────────────────────────────────────

function MobileDropdownSection({
  label,
  items,
  defaultExpanded,
  pathname,
  onNavigate,
}: {
  label: string
  items: DropdownItemConfig[]
  defaultExpanded: boolean
  pathname: string
  onNavigate: () => void
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="mb-1">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium',
          defaultExpanded ? 'text-white bg-white/10' : 'text-white/80 hover:text-white hover:bg-white/5'
        )}
      >
        {label}
        <ChevronDown className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="mt-1 ml-2 pl-2 space-y-0.5" style={{ borderLeft: '1px solid var(--border)' }}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname === item.href
                  ? 'text-white bg-white/10'
                  : item.available
                  ? 'text-white/80 hover:text-white hover:bg-white/5'
                  : 'text-white/40 hover:bg-white/[0.02]'
              )}
            >
              {item.label}
              {!item.available && <Lock className="w-3.5 h-3.5" style={{ color: 'var(--text-w35)' }} />}
            </Link>
          ))}
        </div>
      )}
    </div>
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
      data-active={active}
      className={cn(
        'nav-tab px-4 py-2.5 rounded-lg text-[17px] font-medium transition-colors whitespace-nowrap',
        active ? 'text-white bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/5'
      )}
    >
      {children}
    </Link>
  )
}

function ForumPill() {
  return (
    <Link
      href="/forum"
      className="shrink-0 font-semibold whitespace-nowrap transition-colors text-xs sm:text-sm px-3 py-1 sm:px-4 sm:py-1.5"
      style={{ backgroundColor: '#009BFF', color: 'white', borderRadius: 100 }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0080DD')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#009BFF')}
    >
      Forum
    </Link>
  )
}
