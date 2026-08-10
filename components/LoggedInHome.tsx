import Link from 'next/link'
import { currentUser } from '@clerk/nextjs/server'
import {
  TrendingUp, TrendingDown, ArrowRight, Crown, Zap, Landmark,
  Gift, Bell, Wallet,
} from 'lucide-react'
import Header from '@/components/Header'
import ScrollBackground from '@/components/ScrollBackground'
import MarketStatusBanner from '@/components/MarketStatusBanner'
import { getMarketStatus } from '@/lib/marketStatus'
import { prisma } from '@/lib/prisma'
import { computeTier, type UserTier } from '@/lib/user'
import { getHoldings, type HoldingAccount } from '@/lib/snaptrade'

type HomeUser = {
  id: string
  clerkId: string
  tier: string
  subscriptionStatus: string | null
  isLifetimePro: boolean
  proExpiresAt: Date | null
  isLifetimeMax: boolean
  maxExpiresAt: Date | null
  trialEndsAt: Date | null
  lastVisitedAt: Date | null
}

const TIER_STYLE: Record<UserTier, { label: string; bg: string; text: string; border: string }> = {
  free: { label: 'Free', bg: 'var(--bg-overlay)', text: 'var(--text-mute)', border: 'var(--line)' },
  pro:  { label: 'Pro',  bg: 'rgba(0,155,255,0.15)', text: '#009BFF', border: 'rgba(0,155,255,0.4)' },
  max:  { label: 'Max',  bg: 'rgba(124,58,237,0.15)', text: '#a78bfa', border: 'rgba(124,58,237,0.4)' },
}

const OUTCOME_NOTIF_TYPES = ['signal_hit_target', 'signal_hit_stop', 'signal_expired'] as const

async function getUnreadOutcomeNotifications(clerkId: string) {
  try {
    return await prisma.notification.findMany({
      where: { userId: clerkId, isRead: false, type: { in: [...OUTCOME_NOTIF_TYPES] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
  } catch { return [] }
}

/** Reuses the same "best result to date" row the marketing page shows, trimmed to a single small card. */
async function getLatestFeatured() {
  try {
    return await prisma.weeklyFeaturedSignal.findFirst({ orderBy: { weekStartDate: 'desc' } })
  } catch { return null }
}

// Same active-signal pool the real dashboard shows (isActive: true,
// signalDate desc) — just the 5 most recent, with a "View more" link to the
// full board rather than rebuilding it here.
async function getRecentActiveSignals() {
  try {
    return await prisma.signal.findMany({
      where: { isActive: true },
      orderBy: { signalDate: 'desc' },
      take: 5,
      select: { id: true, ticker: true, signalType: true, confidence: true, targetPrice: true },
    })
  } catch { return [] }
}

type HoldingsPanelState =
  | { status: 'not_connected' }
  | { status: 'error' }
  | { status: 'ok'; accounts: HoldingAccount[]; activeSignals: Map<string, { signalType: string }> }

// Live read straight from SnapTrade (same call as /api/snaptrade/holdings) —
// no caching layer, so a broken/expired connection surfaces as an 'error'
// state here rather than failing the whole page render.
async function getHoldingsPanel(clerkId: string): Promise<HoldingsPanelState> {
  let accounts: HoldingAccount[] | null
  try {
    accounts = await getHoldings(clerkId)
  } catch {
    return { status: 'error' }
  }
  if (accounts === null) return { status: 'not_connected' }

  const heldTickers = [...new Set(accounts.flatMap((a) => a.positions.map((p) => p.symbol)))]
  let activeSignals = new Map<string, { signalType: string }>()
  if (heldTickers.length) {
    try {
      const signals = await prisma.signal.findMany({
        where: { ticker: { in: heldTickers }, isActive: true },
        select: { ticker: true, signalType: true },
      })
      activeSignals = new Map(signals.map((s) => [s.ticker, { signalType: s.signalType }]))
    } catch { /* non-fatal — badges just won't show */ }
  }

  return { status: 'ok', accounts, activeSignals }
}

export default async function LoggedInHome({ user }: { user: HomeUser }) {
  const clerkUser = await currentUser()
  // firstName is frequently null (e.g. email/password sign-up with no name
  // collected, or an OAuth provider that doesn't share it) — fall back to
  // the Clerk username, then the email's local part, before the generic
  // "there". Was firstName-or-"there" only, which showed the generic
  // greeting for most real accounts.
  const firstName =
    clerkUser?.firstName ||
    clerkUser?.username ||
    clerkUser?.emailAddresses[0]?.emailAddress?.split('@')[0] ||
    'there'

  const tier = computeTier(user)
  const isMax = tier === 'max'
  const isTrialing = user.subscriptionStatus === 'trialing' && tier === 'pro'
  const daysLeft = user.trialEndsAt
    ? Math.max(0, Math.ceil((user.trialEndsAt.getTime() - Date.now()) / 86_400_000))
    : null

  const marketStatus = getMarketStatus()

  const [unreadNotifications, latestFeatured, recentActiveSignals, holdingsPanel] = await Promise.all([
    getUnreadOutcomeNotifications(user.clerkId),
    getLatestFeatured(),
    getRecentActiveSignals(),
    getHoldingsPanel(user.clerkId),
  ])

  // Awaited (not fire-and-forget) — a serverless function isn't guaranteed
  // to keep running after its response is returned, so an un-awaited write
  // here risked silently never landing. A single indexed-PK update is cheap
  // enough to eat the render-time cost. Best-effort regardless: a failed
  // write just means the next visit's "since last visit" count is measured
  // from an older timestamp, not a broken page.
  await prisma.user.update({ where: { id: user.id }, data: { lastVisitedAt: new Date() } }).catch(() => {})

  const tierStyle = TIER_STYLE[tier]

  return (
    <div className="min-h-screen relative">
      {/* Same lattice as the marketing page, scoped down: forced static (no
          scroll-linked drift — this page is short and reloads every visit,
          so skipping the scroll listener entirely is also cheaper) and at
          40% of the marketing page's line opacity, since this page's job is
          fast scanning, not ambience. The outer wrapper no longer paints an
          opaque background (body's own var(--bg-primary) still shows
          through everywhere) so the lattice is actually visible; every
          text-bearing card below still has its own solid var(--bg-raised)/
          var(--bg-surface) background, so content readability is unaffected
          — only the bare page gutters (behind the greeting line, between
          cards) show the lattice at all. */}
      <ScrollBackground forceStatic opacityScale={0.4} />
      <Header />
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Unread outcome notifications — the page's actual reason to
            exist, so it leads. Collapses entirely when empty rather than
            showing an empty state up top. ── */}
        {unreadNotifications.length > 0 && (
          <div className="mb-8" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 px-5 pt-4">
              <Bell className="w-4 h-4" style={{ color: 'var(--watch)' }} />
              <span className="type-h2" style={{ fontSize: 18 }}>
                {unreadNotifications.length} signal{unreadNotifications.length === 1 ? '' : 's'} need{unreadNotifications.length === 1 ? 's' : ''} your attention
              </span>
            </div>
            <div className="mt-3">
              {unreadNotifications.map((n) => {
                const accent = n.type === 'signal_hit_target' ? 'var(--outcome-hit)' : n.type === 'signal_hit_stop' ? 'var(--outcome-miss)' : 'var(--watch)'
                return (
                  <div
                    key={n.id}
                    className="px-5 py-3.5"
                    style={{ borderLeft: `3px solid ${accent}`, borderTop: '1px solid var(--border-subtle)' }}
                  >
                    <p className="text-base font-semibold" style={{ color: 'var(--text-high)' }}>{n.title}</p>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-w50)' }}>{n.body}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Top fold: asymmetric — wider left (identity), narrower right
            (live status) — instead of full-width stacked strips. ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5 mb-8">
          <div className="flex items-center gap-3">
            <span className="type-h2" style={{ fontSize: 20 }}>Welcome back, {firstName}</span>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold"
              style={{ backgroundColor: tierStyle.bg, color: tierStyle.text, border: `1px solid ${tierStyle.border}` }}
            >
              {tier === 'max' && <Zap className="w-3 h-3" />}
              {tier === 'pro' && <Crown className="w-3 h-3" />}
              <span className="font-data">{tierStyle.label}</span>
            </span>
            {isTrialing && daysLeft !== null && (
              <span className="text-xs font-semibold" style={{ color: '#1D9E75' }}>
                Trial — <span className="font-data">{daysLeft === 0 ? 'ends today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}</span>
              </span>
            )}
          </div>
          <div>
            <MarketStatusBanner {...marketStatus} />
          </div>
        </div>

        {/* ── Portfolio — the page's focal section: live brokerage positions,
            not just a link out to them. Bigger box than the sections below
            since this is what the user actually opens the page to check.
            PerformanceSummary sits above it and is derived entirely from the
            same position-level cost-basis data (real, already fetched) —
            NOT a historical return chart. SnapTrade's actual history/return-
            rate endpoints (getAccountBalanceHistory, getUserAccountReturnRates)
            were tested live against the sandbox connection and both return a
            real 403 "Feature is not enabled for this customer or this
            connection" — a plan-tier gate on the SnapTrade account, not
            something fixable here. Revisit if/when that's upgraded. ── */}
        <PerformanceSummary state={holdingsPanel} />
        <HoldingsPanel state={holdingsPanel} />

        {/* ── Quick actions: secondary shortcuts, not a duplicate of the
            active-signals section below. ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {isMax ? (
            <QuickAction href="/options" icon={<Zap className="w-4 h-4" />} title="Options" desc="CALL & PUT ideas" accent="#a78bfa" />
          ) : (
            <QuickAction href="/pricing" icon={<Crown className="w-4 h-4" />} title="Upgrade to Max" desc="Unlock options signals" accent="#a78bfa" />
          )}
          <QuickAction href="/politician-scanner" icon={<Landmark className="w-4 h-4" />} title="Scanners" desc="Politician & insider activity" />
          <QuickAction href="/refer" icon={<Gift className="w-4 h-4" />} title="Refer a Friend" desc="You both get a free month" />
        </div>

        {/* ── Active signals — a real 5-row preview of the dashboard, not a
            rebuild of it; "View more" is the only way to see the rest. ── */}
        {recentActiveSignals.length > 0 && (
          <div className="mb-8" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="font-semibold" style={{ color: 'var(--text-high)' }}>Active Signals</span>
              <Link href="/dashboard" className="text-xs font-semibold hover:opacity-75 transition-opacity" style={{ color: '#009BFF' }}>
                View more →
              </Link>
            </div>
            <div>
              {recentActiveSignals.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-2.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center gap-2">
                    {s.signalType === 'BUY'
                      ? <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--buy)' }} />
                      : <TrendingDown className="w-3.5 h-3.5" style={{ color: 'var(--short)' }} />}
                    <span className="font-data font-semibold text-sm" style={{ color: 'var(--text-high)' }}>{s.ticker}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-data text-xs" style={{ color: 'var(--text-w50)' }}>Target ${s.targetPrice.toFixed(2)}</span>
                    <span className="font-data text-xs font-bold" style={{ color: '#009BFF' }}>{s.confidence.toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-1.5 px-5 py-3 text-sm font-semibold hover:opacity-80 transition-opacity"
              style={{ borderTop: '1px solid var(--border)', color: '#009BFF' }}
            >
              View more <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* ── What's new ── */}
        {latestFeatured && (
          <div className="p-5" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <p className="eyebrow mb-3">What&apos;s New</p>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm" style={{ color: 'var(--text-high)' }}>
                  <span className="font-data font-bold">{latestFeatured.ticker}</span> — this week&apos;s featured result:{' '}
                  <span className="font-data font-bold" style={{ color: 'var(--outcome-hit)' }}>
                    +{latestFeatured.realizedGainPercent.toFixed(1)}%
                  </span>
                </p>
              </div>
              <Link href="/#track-record" className="text-xs font-semibold shrink-0 hover:opacity-75 transition-opacity" style={{ color: '#009BFF' }}>
                See track record →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function money(n: number | null, currency: string | null) {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: currency ?? 'USD', maximumFractionDigits: 2 })
}

// Derived from real position-level cost-basis data already fetched for the
// Portfolio panel below — total unrealized gain/loss, not a historical
// return chart. SnapTrade's actual history/return-rate endpoints
// (getAccountBalanceHistory, getUserAccountReturnRates) were confirmed live
// to return 403 "Feature is not enabled for this customer or this
// connection" for this account — a plan-tier gate, not something we can
// build around today. Renders nothing for not_connected/error states,
// which the Portfolio panel below already surfaces.
function PerformanceSummary({ state }: { state: HoldingsPanelState }) {
  if (state.status !== 'ok') return null
  const positions = state.accounts.flatMap((a) => a.positions)
  if (positions.length === 0) return null

  const totalValue = positions.reduce((sum, p) => sum + (p.marketValue ?? 0), 0)
  const totalCostBasis = positions.reduce((sum, p) => sum + (p.units != null && p.costBasis != null ? p.units * p.costBasis : 0), 0)
  const totalPL = positions.reduce((sum, p) => sum + (p.unrealizedPL ?? 0), 0)
  const plPercent = totalCostBasis !== 0 ? (totalPL / totalCostBasis) * 100 : null
  const plPositive = totalPL >= 0
  const currency = state.accounts[0]?.currency ?? 'USD'

  return (
    <div className="grid grid-cols-3 gap-3 mb-3">
      <div className="p-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <p className="eyebrow mb-1">Total Value</p>
        <p className="font-data text-lg font-bold" style={{ color: 'var(--text-high)' }}>{money(totalValue, currency)}</p>
      </div>
      <div className="p-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <p className="eyebrow mb-1">Unrealized P/L</p>
        <p className="font-data text-lg font-bold" style={{ color: plPositive ? 'var(--outcome-hit)' : 'var(--outcome-miss)' }}>
          {plPositive ? '+' : ''}{money(totalPL, currency)}
        </p>
      </div>
      <div className="p-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <p className="eyebrow mb-1">Return</p>
        <p className="font-data text-lg font-bold" style={{ color: plPositive ? 'var(--outcome-hit)' : 'var(--outcome-miss)' }}>
          {plPercent != null ? `${plPositive ? '+' : ''}${plPercent.toFixed(1)}%` : '—'}
        </p>
      </div>
    </div>
  )
}

function HoldingsPanel({ state }: { state: HoldingsPanelState }) {
  if (state.status === 'not_connected') {
    return (
      <div className="p-8 mb-8 text-center" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
        <Wallet className="w-6 h-6 mx-auto mb-3" style={{ color: '#009BFF' }} />
        <p className="font-semibold mb-1" style={{ color: 'var(--text-high)' }}>Connect your brokerage</p>
        <p className="text-sm mb-5" style={{ color: 'var(--text-w50)' }}>
          See your real positions here, right next to your signals — no more switching tabs.
        </p>
        <Link
          href="/account/devices"
          className="inline-flex items-center gap-2 px-5 py-2.5 font-semibold text-sm hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#009BFF', color: 'white' }}
        >
          Connect Brokerage <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="p-6 mb-8 text-center" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
        <p className="text-sm" style={{ color: 'var(--text-w50)' }}>
          Couldn&apos;t load your holdings right now.{' '}
          <Link href="/account/holdings" className="underline" style={{ color: '#009BFF' }}>Try the full holdings page →</Link>
        </p>
      </div>
    )
  }

  const totalValue = state.accounts.reduce((sum, a) => sum + (a.totalValue ?? 0), 0)
  const currency = state.accounts[0]?.currency ?? 'USD'
  const positions = state.accounts
    .flatMap((a) => a.positions.map((p) => ({ ...p, accountName: a.name })))
    .sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0))
  const shown = positions.slice(0, 8)
  const remaining = positions.length - shown.length

  return (
    <div className="overflow-hidden mb-8" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4" style={{ color: '#009BFF' }} />
          <span className="type-h2" style={{ fontSize: 18 }}>Portfolio</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-data text-base font-bold" style={{ color: 'var(--text-high)' }}>{money(totalValue, currency)}</span>
          <Link href="/account/holdings" className="text-xs font-semibold hover:opacity-75 transition-opacity" style={{ color: '#009BFF' }}>
            Manage →
          </Link>
        </div>
      </div>

      {positions.length === 0 ? (
        <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-w50)' }}>No positions yet in your connected account.</p>
      ) : (
        <div>
          {shown.map((p, i) => {
            const signal = state.activeSignals.get(p.symbol)
            const plPositive = (p.unrealizedPL ?? 0) >= 0
            return (
              <div key={`${p.symbol}-${i}`} className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-data font-semibold text-sm" style={{ color: 'var(--text-high)' }}>{p.symbol}</span>
                  <span className="text-xs truncate hidden sm:inline" style={{ color: 'var(--text-w40)' }}>
                    {p.units ?? '—'} units · {p.accountName ?? 'Account'}
                  </span>
                  {signal && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0"
                      style={{
                        backgroundColor: signal.signalType === 'SHORT' ? 'rgba(229,72,77,0.12)' : 'rgba(0,199,118,0.12)',
                        color: signal.signalType === 'SHORT' ? 'var(--short)' : 'var(--buy)',
                      }}
                    >
                      Signal
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {p.unrealizedPL != null && (
                    <span className="font-data text-xs font-semibold hidden sm:inline" style={{ color: plPositive ? 'var(--buy)' : 'var(--short)' }}>
                      {plPositive ? '+' : ''}{money(p.unrealizedPL, p.currency)}
                    </span>
                  )}
                  <span className="font-data text-sm font-bold" style={{ color: 'var(--text-high)' }}>{money(p.marketValue, p.currency)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Link
        href="/account/holdings"
        className="flex items-center justify-center gap-1.5 px-5 py-3 text-sm font-semibold hover:opacity-80 transition-opacity"
        style={{ borderTop: '1px solid var(--border)', color: '#009BFF' }}
      >
        {remaining > 0 ? `View ${remaining} more` : 'View full holdings'} <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}

function QuickAction({
  href, icon, title, desc, accent = '#009BFF',
}: {
  href: string
  icon: React.ReactNode
  title: string
  desc: string
  accent?: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-4 hover:opacity-90 transition-opacity group"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="w-9 h-9 flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${accent}20`, color: accent }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm" style={{ color: 'var(--text-high)' }}>{title}</p>
        <p className="text-xs" style={{ color: 'var(--text-w50)' }}>{desc}</p>
      </div>
      <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-40 group-hover:opacity-80 transition-opacity" style={{ color: 'var(--text-w50)' }} />
    </Link>
  )
}
