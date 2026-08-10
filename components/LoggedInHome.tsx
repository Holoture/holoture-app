import Link from 'next/link'
import { currentUser } from '@clerk/nextjs/server'
import {
  TrendingUp, TrendingDown, ArrowRight, Crown, Zap, Landmark,
  Gift, Wallet, Sunrise, Moon,
} from 'lucide-react'
import Header from '@/components/Header'
import MarketStatusBanner from '@/components/MarketStatusBanner'
import UnreadActivityPanel, { type UnreadActivityItem } from '@/components/UnreadActivityPanel'
import TopSignalSpotlight, { type SpotlightSignal } from '@/components/TopSignalSpotlight'
import SentimentGauge, { type SentimentDisplayData } from '@/components/SentimentGauge'
import { getMarketStatus } from '@/lib/marketStatus'
import { prisma } from '@/lib/prisma'
import { computeTier, type UserTier } from '@/lib/user'
import { getHoldings, type HoldingAccount } from '@/lib/snaptrade'
import { getLatestSentimentIndex, type ComponentBreakdown } from '@/lib/sentimentIndex'

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

// Full NotificationType taxonomy (lib/notifications.ts / NotificationBell.tsx)
// — was filtered to just 3 outcome types here, a stripped-down duplicate of
// what the Header's NotificationBell already shows in full. No type filter
// now; UnreadActivityPanel handles the mark-read interaction.
async function getUnreadActivity(clerkId: string): Promise<UnreadActivityItem[]> {
  try {
    const rows = await prisma.notification.findMany({
      where: { userId: clerkId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 8,
    })
    return rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      linkUrl: n.linkUrl,
      createdAt: n.createdAt.toISOString(),
    }))
  } catch { return [] }
}

// Today's single highest-confidence active signal — same isActive + confidence-desc
// pattern already used by app/api/admin/og-signals/route.ts, just findFirst
// instead of findMany/take.
async function getTodaysTopSignal(): Promise<SpotlightSignal | null> {
  try {
    const s = await prisma.signal.findFirst({
      where: { isActive: true },
      orderBy: { confidence: 'desc' },
      select: {
        ticker: true, companyName: true, signalType: true, confidence: true,
        entryZoneLow: true, entryZoneHigh: true, targetPrice: true, stopLoss: true,
        timeHorizon: true, thesis: true,
      },
    })
    return s
  } catch { return null }
}

const SIGNIFICANCE_RANK: Record<string, number> = { High: 3, Medium: 2, Low: 1 }

// Most notable recent politician trade. PoliticianTrade.significance is a
// free-text string ('Low'/'Medium'/'High'), not an enum — a Prisma
// `orderBy: { significance: 'desc' }` would sort it alphabetically
// ('Medium' > 'Low' > 'High'), which is NOT the real severity order. Instead:
// pull the most recent batch (already the politician-scanner page's own
// orderBy: filedAt desc pattern) and rank in application code.
async function getNotableTrade() {
  try {
    const recent = await prisma.politicianTrade.findMany({
      where: { isIncomplete: false },
      orderBy: { filedAt: 'desc' },
      take: 30,
      select: {
        politicianName: true, party: true, ticker: true, companyName: true,
        tradeType: true, amountRange: true, significance: true, filedAt: true,
      },
    })
    if (recent.length === 0) return null
    return recent.slice().sort((a, b) => {
      const rankDiff = (SIGNIFICANCE_RANK[b.significance] ?? 0) - (SIGNIFICANCE_RANK[a.significance] ?? 0)
      return rankDiff !== 0 ? rankDiff : b.filedAt.getTime() - a.filedAt.getTime()
    })[0]
  } catch { return null }
}

// Same weekday/time window logic as app/movers/page.tsx's getSessionWindows
// — only the currently-live extended session (if any) is shown. Outside
// those windows (most of the day, and all weekend) this deliberately
// returns no session rather than showing stale or empty movers data.
function getLiveExtendedSession(): 'premarket' | 'afterhours' | null {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false,
  }).formatToParts(new Date())
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  const mins = hour * 60 + minute
  if (weekday === 'Sat' || weekday === 'Sun') return null
  if (mins >= 4 * 60 && mins < 9 * 60 + 30) return 'premarket'
  if (mins >= 16 * 60 && mins < 20 * 60) return 'afterhours'
  return null
}

const MIN_GAIN_PCT_CHANGE = 4
const MIN_LOSS_PCT_CHANGE = -5

async function getTopMovers(session: 'premarket' | 'afterhours' | null) {
  if (!session) return { session: null, rows: [] }
  try {
    const rows = await prisma.moverSnapshot.findMany({
      where: { session, OR: [{ pctChange: { gte: MIN_GAIN_PCT_CHANGE } }, { pctChange: { lte: MIN_LOSS_PCT_CHANGE } }] },
      select: { ticker: true, pctChange: true, extendedLastPrice: true },
    })
    const top = rows.slice().sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange)).slice(0, 4)
    return { session, rows: top }
  } catch { return { session, rows: [] } }
}

// Today's (or most recently computed) Holoture Market Sentiment Index —
// written once daily by cron/sentiment-index. componentBreakdown is stored
// as Json, cast back to its real shape here since Prisma can't type it.
async function getSentimentDisplay(): Promise<SentimentDisplayData | null> {
  const row = await getLatestSentimentIndex()
  if (!row) return null
  return {
    score: row.score,
    label: row.label,
    date: row.date.toISOString(),
    breakdown: row.componentBreakdown as unknown as ComponentBreakdown,
  }
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
  const liveSession = getLiveExtendedSession()

  const [unreadActivity, latestFeatured, recentActiveSignals, holdingsPanel, topSignal, notableTrade, topMovers, sentiment] = await Promise.all([
    getUnreadActivity(user.clerkId),
    getLatestFeatured(),
    getRecentActiveSignals(),
    getHoldingsPanel(user.clerkId),
    getTodaysTopSignal(),
    getNotableTrade(),
    getTopMovers(liveSession),
    getSentimentDisplay(),
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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Unread activity — the page's actual reason to exist, so it
            leads. Full NotificationType taxonomy (was 3 outcome types),
            with real mark-read interactivity via UnreadActivityPanel.
            Collapses entirely when empty rather than showing an empty
            state up top. ── */}
        <UnreadActivityPanel initial={unreadActivity} />

        {/* ── Top fold: asymmetric — wider left (identity), narrower right
            (live status) — instead of full-width stacked strips. ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="type-h3">Welcome back, {firstName}</span>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold"
              style={{ backgroundColor: tierStyle.bg, color: tierStyle.text, border: `1px solid ${tierStyle.border}` }}
            >
              {tier === 'max' && <Zap className="w-3 h-3" />}
              {tier === 'pro' && <Crown className="w-3 h-3" />}
              <span className="font-data">{tierStyle.label}</span>
            </span>
            {isTrialing && daysLeft !== null && (
              <span className="text-xs font-semibold" style={{ color: 'var(--trial)' }}>
                Trial — <span className="font-data">{daysLeft === 0 ? 'ends today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}</span>
              </span>
            )}
          </div>
          <div>
            <MarketStatusBanner {...marketStatus} />
          </div>
        </div>

        {/* ── Today's Top Signal — expand-on-click spotlight, same
            interaction pattern as SignalRow.tsx's expanded state on the
            real dashboard, no live-price fetch needed. ── */}
        {topSignal && <TopSignalSpotlight signal={topSignal} />}

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

        {/* ── Market Pulse — real, frequently-refreshing data outside the
            user's own portfolio: most notable recent politician trade
            (PoliticianTrade.significance-ranked, not decoration) and the
            currently-live premarket/after-hours movers snapshot. Movers
            sub-section only renders during the actual live window
            (getLiveExtendedSession) — outside that window (most of the
            day, all weekend) MoverSnapshot data is stale/empty by design,
            so showing nothing here is the honest choice, not a bug. ── */}
        {(notableTrade || topMovers.rows.length > 0) && (
          <div className="mb-6" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="type-h3">Market Pulse</span>
            </div>

            {notableTrade && (
              <Link
                href="/politician-scanner"
                className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Landmark className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--watch)' }} />
                  <span className="text-sm truncate" style={{ color: 'var(--text-high)' }}>
                    <span className="font-semibold">{notableTrade.politicianName}</span> ({notableTrade.party.charAt(0)}) {notableTrade.tradeType.toLowerCase()}{' '}
                    <span className="font-data font-semibold">{notableTrade.ticker}</span>
                  </span>
                </div>
                <span className="font-data text-xs shrink-0" style={{ color: 'var(--text-w50)' }}>{notableTrade.amountRange}</span>
              </Link>
            )}

            {topMovers.rows.length > 0 && (
              <div className="overflow-x-auto" style={{ borderTop: notableTrade ? '1px solid var(--border-subtle)' : undefined }}>
                <div className="flex items-center gap-2 px-4 pt-2.5">
                  {topMovers.session === 'premarket'
                    ? <Sunrise className="w-3.5 h-3.5" style={{ color: 'var(--watch)' }} />
                    : <Moon className="w-3.5 h-3.5" style={{ color: 'var(--watch)' }} />}
                  <span className="data-label" style={{ color: 'var(--text-dim)' }}>
                    {topMovers.session === 'premarket' ? 'Premarket Movers' : 'After-Hours Movers'}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {topMovers.rows.map((m) => {
                      const positive = m.pctChange >= 0
                      return (
                        <tr key={m.ticker}>
                          <td className="px-4 py-1.5 font-data font-semibold" style={{ color: 'var(--text-high)' }}>{m.ticker}</td>
                          <td className="px-3 py-1.5 text-right font-data" style={{ color: 'var(--text-w50)' }}>{money(m.extendedLastPrice, 'USD')}</td>
                          <td className="px-4 py-1.5 text-right font-data font-semibold" style={{ color: positive ? 'var(--buy)' : 'var(--short)' }}>
                            {positive ? '+' : ''}{m.pctChange.toFixed(1)}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Quick actions: compact icon+label chip row, not description
            tiles — these are secondary shortcuts, not features being sold. ── */}
        <div className="flex flex-wrap gap-2 mb-6">
          {isMax ? (
            <QuickAction href="/options" icon={<Zap className="w-4 h-4" />} title="Options" accent="#a78bfa" />
          ) : (
            <QuickAction href="/pricing" icon={<Crown className="w-4 h-4" />} title="Upgrade to Max" accent="#a78bfa" />
          )}
          <QuickAction href="/politician-scanner" icon={<Landmark className="w-4 h-4" />} title="Scanners" />
          <QuickAction href="/refer" icon={<Gift className="w-4 h-4" />} title="Refer a Friend" />
        </div>

        {/* ── Active signals — a real 5-row preview of the dashboard, not a
            rebuild of it; "View more" is the only way to see the rest. ── */}
        {recentActiveSignals.length > 0 && (
          <div className="mb-6" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="type-h3">Active Signals</span>
              <Link href="/dashboard" className="text-xs font-semibold hover:opacity-75 transition-opacity" style={{ color: '#009BFF' }}>
                View more →
              </Link>
            </div>
            <div>
              {recentActiveSignals.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
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
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold hover:opacity-80 transition-opacity"
              style={{ borderTop: '1px solid var(--border)', color: '#009BFF' }}
            >
              View more <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* ── Holoture Market Sentiment Index — our own composite, computed
            once daily by cron/sentiment-index (see lib/sentimentIndex.ts).
            Expand-on-click reveals the component breakdown. Renders nothing
            until the first cron run has produced a row. ── */}
        <SentimentGauge data={sentiment} />

        {/* ── What's new ── */}
        {latestFeatured && (
          <div className="p-4" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <p className="eyebrow mb-2">What&apos;s New</p>
            <p className="text-sm" style={{ color: 'var(--text-high)' }}>
              <span className="font-data font-bold">{latestFeatured.ticker}</span> — this week&apos;s featured result:{' '}
              <span className="font-data font-bold" style={{ color: 'var(--outcome-hit)' }}>
                +{latestFeatured.realizedGainPercent.toFixed(1)}%
              </span>
            </p>
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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
      <div className="px-3 py-2.5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <p className="eyebrow mb-1">Total Value</p>
        <p className="font-data text-base font-bold" style={{ color: 'var(--text-high)' }}>{money(totalValue, currency)}</p>
      </div>
      <div className="px-3 py-2.5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <p className="eyebrow mb-1">Unrealized P/L</p>
        <p className="font-data text-base font-bold" style={{ color: plPositive ? 'var(--outcome-hit)' : 'var(--outcome-miss)' }}>
          {plPositive ? '+' : ''}{money(totalPL, currency)}
        </p>
      </div>
      <div className="px-3 py-2.5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <p className="eyebrow mb-1">Return</p>
        <p className="font-data text-base font-bold" style={{ color: plPositive ? 'var(--outcome-hit)' : 'var(--outcome-miss)' }}>
          {plPercent != null ? `${plPositive ? '+' : ''}${plPercent.toFixed(1)}%` : '—'}
        </p>
      </div>
    </div>
  )
}

function HoldingsPanel({ state }: { state: HoldingsPanelState }) {
  if (state.status === 'not_connected') {
    return (
      <div className="p-6 mb-6 text-center" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
        <Wallet className="w-6 h-6 mx-auto mb-2" style={{ color: '#009BFF' }} />
        <p className="type-h3 mb-1">Connect your brokerage</p>
        <p className="text-sm mb-4" style={{ color: 'var(--text-w50)' }}>
          See your real positions here, right next to your signals — no more switching tabs.
        </p>
        <Link
          href="/account/devices"
          className="inline-flex items-center gap-2 px-4 py-2 font-semibold text-sm hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#009BFF', color: 'white' }}
        >
          Connect Brokerage <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="p-4 mb-6 text-center" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
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
    .flatMap((a) => a.positions)
    .sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0))
  const shown = positions.slice(0, 8)
  const remaining = positions.length - shown.length

  return (
    <div className="overflow-hidden mb-6" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4" style={{ color: '#009BFF' }} />
          <span className="type-h3">Portfolio</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-data text-sm font-bold" style={{ color: 'var(--text-high)' }}>{money(totalValue, currency)}</span>
          <Link href="/account/holdings" className="text-xs font-semibold hover:opacity-75 transition-opacity" style={{ color: '#009BFF' }}>
            Manage →
          </Link>
        </div>
      </div>

      {positions.length === 0 ? (
        <p className="px-4 py-6 text-sm text-center" style={{ color: 'var(--text-w50)' }}>No positions yet in your connected account.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="data-label text-left px-4 py-2 font-normal">Symbol</th>
                <th className="data-label text-right px-3 py-2 font-normal">Qty</th>
                <th className="data-label text-right px-3 py-2 font-normal">Price</th>
                <th className="data-label text-right px-3 py-2 font-normal">Value</th>
                <th className="data-label text-right px-3 py-2 font-normal">P/L</th>
                <th className="data-label text-right px-4 py-2 font-normal">Signal</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p, i) => {
                const signal = state.activeSignals.get(p.symbol)
                const plPositive = (p.unrealizedPL ?? 0) >= 0
                return (
                  <tr key={`${p.symbol}-${i}`} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="px-4 py-2 font-data font-semibold whitespace-nowrap" style={{ color: 'var(--text-high)' }}>{p.symbol}</td>
                    <td className="px-3 py-2 text-right font-data whitespace-nowrap" style={{ color: 'var(--text-w50)' }}>{p.units ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-data whitespace-nowrap" style={{ color: 'var(--text-w50)' }}>{money(p.price, p.currency)}</td>
                    <td className="px-3 py-2 text-right font-data font-bold whitespace-nowrap" style={{ color: 'var(--text-high)' }}>{money(p.marketValue, p.currency)}</td>
                    <td className="px-3 py-2 text-right font-data font-semibold whitespace-nowrap" style={{ color: p.unrealizedPL == null ? 'var(--text-w40)' : plPositive ? 'var(--buy)' : 'var(--short)' }}>
                      {p.unrealizedPL == null ? '—' : `${plPositive ? '+' : ''}${money(p.unrealizedPL, p.currency)}`}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {signal ? (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 uppercase tracking-wide"
                          style={{
                            backgroundColor: signal.signalType === 'SHORT' ? 'rgba(229,72,77,0.12)' : 'rgba(0,199,118,0.12)',
                            color: signal.signalType === 'SHORT' ? 'var(--short)' : 'var(--buy)',
                          }}
                        >
                          Active
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-w30)' }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Link
        href="/account/holdings"
        className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold hover:opacity-80 transition-opacity"
        style={{ borderTop: '1px solid var(--border)', color: '#009BFF' }}
      >
        {remaining > 0 ? `View ${remaining} more` : 'View full holdings'} <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}

function QuickAction({
  href, icon, title, accent = '#009BFF',
}: {
  href: string
  icon: React.ReactNode
  title: string
  accent?: string
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 px-3.5 py-2 hover:opacity-80 transition-opacity"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <span style={{ color: accent }}>{icon}</span>
      <span className="text-sm font-semibold" style={{ color: 'var(--text-high)' }}>{title}</span>
    </Link>
  )
}
