import Link from 'next/link'
import { currentUser } from '@clerk/nextjs/server'
import {
  TrendingUp, TrendingDown, ArrowRight, Crown, Zap, Landmark,
  Gift, Bell, Sparkles, Radio,
} from 'lucide-react'
import Header from '@/components/Header'
import MarketStatusBanner from '@/components/MarketStatusBanner'
import { getMarketStatus } from '@/lib/marketStatus'
import { prisma } from '@/lib/prisma'
import { computeTier, type UserTier } from '@/lib/user'

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

async function getTrackedSignals(clerkId: string) {
  try {
    return await prisma.trackedSignal.findMany({
      where: { userId: clerkId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { signal: { select: { ticker: true, signalType: true, outcome: true } } },
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

  // First-visit state: lastVisitedAt is only null before this page has ever
  // rendered for this user (set below via a fire-and-forget update). Treated
  // as "welcome" rather than "0 new signals" — those read the same to a
  // returning user with a genuinely quiet day, but a brand-new user has no
  // baseline to compare against yet.
  const isFirstVisit = user.lastVisitedAt === null
  const sinceTimestamp = user.lastVisitedAt ?? new Date(0)

  const [newSignalsCount, unreadNotifications, trackedSignals, latestFeatured, recentActiveSignals] = await Promise.all([
    prisma.signal.count({ where: { isActive: true, createdAt: { gt: sinceTimestamp } } }).catch(() => 0),
    getUnreadOutcomeNotifications(user.clerkId),
    getTrackedSignals(user.clerkId),
    getLatestFeatured(),
    getRecentActiveSignals(),
  ])

  // Awaited (not fire-and-forget) — a serverless function isn't guaranteed
  // to keep running after its response is returned, so an un-awaited write
  // here risked silently never landing. A single indexed-PK update is cheap
  // enough to eat the render-time cost. Best-effort regardless: a failed
  // write just means the next visit's "since last visit" count is measured
  // from an older timestamp, not a broken page.
  await prisma.user.update({ where: { id: user.id }, data: { lastVisitedAt: new Date() } }).catch(() => {})

  const tierStyle = TIER_STYLE[tier]
  const hasTrackedActivity = trackedSignals.length > 0

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

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

        {/* ── At-a-glance: tracked-signal status, routine (not the alert
            content above). ── */}
        {isFirstVisit ? (
          <div className="p-8 mb-8 text-center" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <Sparkles className="w-6 h-6 mx-auto mb-3" style={{ color: '#009BFF' }} />
            <p className="font-semibold mb-1" style={{ color: 'var(--text-high)' }}>You&apos;re all set</p>
            <p className="text-sm mb-5" style={{ color: 'var(--text-w50)' }}>
              You haven&apos;t tracked any signals yet — browse today&apos;s board to find your first pick.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 font-semibold text-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#009BFF', color: 'white' }}
            >
              Browse Today&apos;s Signals <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden mb-8" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4" style={{ color: '#009BFF' }} />
                <span className="font-semibold" style={{ color: 'var(--text-high)' }}>Since your last visit</span>
              </div>
              <span className="font-data text-sm font-bold" style={{ color: '#009BFF' }}>
                {newSignalsCount} new signal{newSignalsCount === 1 ? '' : 's'}
              </span>
            </div>

            {!hasTrackedActivity ? (
              <p className="px-5 py-6 text-sm" style={{ color: 'var(--text-w50)' }}>
                Nothing on your tracker yet. <Link href="/tracker" className="underline" style={{ color: '#009BFF' }}>View your tracker →</Link>
              </p>
            ) : (
              <div>
                {trackedSignals.map((t) => {
                  const outcome = t.signal.outcome
                  const outcomeColor = outcome === 'HIT_TARGET' ? 'var(--outcome-hit)' : outcome === 'HIT_STOP' ? 'var(--outcome-miss)' : 'var(--text-w45)'
                  const outcomeLabel = outcome === 'HIT_TARGET' ? 'Hit target' : outcome === 'HIT_STOP' ? 'Hit stop' : outcome === 'EXPIRED' ? 'Expired' : 'Watching'
                  return (
                    <div key={t.id} className="flex items-center justify-between px-5 py-2.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center gap-2">
                        {t.signal.signalType === 'BUY'
                          ? <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--buy)' }} />
                          : <TrendingDown className="w-3.5 h-3.5" style={{ color: 'var(--short)' }} />}
                        <span className="font-data font-semibold text-sm" style={{ color: 'var(--text-high)' }}>{t.signal.ticker}</span>
                      </div>
                      <span className="text-xs font-bold" style={{ color: outcomeColor }}>{outcomeLabel}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

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
