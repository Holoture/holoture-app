import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser, computeTier } from '@/lib/user'
import Header from '@/components/Header'
import SignalBoardClient from '@/components/SignalBoardClient'
import { UpgradeBanner } from '@/components/FreeSignalCard'
import AuthLoadingGate from '@/components/AuthLoadingGate'
import { TrendingUp, Crown, Zap } from 'lucide-react'
import Link from 'next/link'

// ── EST helpers ────────────────────────────────────────────────────────────────

/** Returns the current hour:minute in the America/New_York timezone. */
function estNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(new Date())
  const h = parseInt(parts.find(p => p.type === 'hour')!.value, 10)
  const m = parseInt(parts.find(p => p.type === 'minute')!.value, 10)
  return { h, m }
}

function isBefore630amEST() {
  const { h, m } = estNow()
  return h < 6 || (h === 6 && m < 30)
}

// ── Signal fetch ────────────────────────────────────────────────────────────
// Show ALL active signals regardless of when they were generated — intraday,
// 1-3 day, momentum, swing, and long-term signals can all be active at once
// since they're produced by separate crons on independent schedules.

async function getSignals() {
  const signals = await prisma.signal.findMany({
    where: { isActive: true },
    orderBy: { signalDate: 'desc' },
  })

  if (signals.length === 0) return { signals, isYesterday: false }

  // "isYesterday" banner: only relevant in the early-morning gap before
  // today's main batch has been generated yet.
  const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
  const todayStr = dateFmt.format(new Date())
  const hasTodaySignal = signals.some((s) => {
    const d = s.signalDate instanceof Date ? s.signalDate : new Date(s.signalDate)
    return dateFmt.format(d) === todayStr
  })

  const isYesterday = !hasTodaySignal && isBefore630amEST()
  return { signals, isYesterday }
}

/** ticker -> real avg 10-day dollar volume, joined from the weekly-screened TickerUniverse. */
async function getVolumeByTicker(tickers: string[]): Promise<Record<string, number>> {
  if (tickers.length === 0) return {}
  const rows = await prisma.tickerUniverse.findMany({
    where: { ticker: { in: [...new Set(tickers)] } },
    select: { ticker: true, avgDollarVolume: true },
  })
  return Object.fromEntries(rows.map((r) => [r.ticker, r.avgDollarVolume]))
}

async function getLastGenerationLog() {
  try {
    return await prisma.signalGenerationLog.findFirst({
      where: { status: 'success' },
      orderBy: { generatedAt: 'desc' },
    })
  } catch { return null }
}

export default async function DashboardPage() {
  const { userId } = await auth()

  // Don't do a hard server-side redirect when Clerk can't validate the session
  // (e.g. during custom-domain SSL provisioning).  Instead, hand off to the
  // client-side AuthLoadingGate which waits for Clerk to load, refreshes the
  // page if the session is valid, and only then redirects to sign-in if truly
  // unauthenticated.  This breaks the redirect loop.
  if (!userId) return <AuthLoadingGate />

  let user: Awaited<ReturnType<typeof getOrCreateUser>> = null
  let signalResult: Awaited<ReturnType<typeof getSignals>> = { signals: [], isYesterday: false }
  let lastLog: Awaited<ReturnType<typeof getLastGenerationLog>> = null

  try {
    ;[user, signalResult, lastLog] = await Promise.all([
      getOrCreateUser(),
      getSignals(),
      getLastGenerationLog(),
    ])
  } catch (e) {
    console.error('[dashboard] data fetch error:', e)
    throw e
  }

  if (!user) redirect('/sign-in')

  const volumeByTicker = await getVolumeByTicker(signalResult.signals.map((s) => s.ticker))

  const tier = computeTier(user)
  const isPro = tier === 'pro' || tier === 'max'
  const isMax = tier === 'max'

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const { signals, isYesterday } = signalResult
  const isAdmin = userId === process.env.ADMIN_USER_ID

  // Serialize signals (Date → string) for client components
  const serializedSignals = signals.map(s => ({
    ...s,
    signalDate: s.signalDate instanceof Date ? s.signalDate.toISOString() : String(s.signalDate),
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
  }))

  // ── Trial banner data (Pro only — Max has no trial) ─────────────────────────
  const isTrialing   = user.subscriptionStatus === 'trialing' && tier === 'pro'
  const trialEndsAt  = (user as { trialEndsAt?: Date | null }).trialEndsAt ?? null
  const daysLeft     = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000))
    : null
  const trialEndDate = trialEndsAt
    ? trialEndsAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : null

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />

      {/* ── Trial banner ── */}
      {isTrialing && trialEndsAt && (
        <div
          className="px-4 py-3 text-sm text-center font-semibold"
          style={{ backgroundColor: 'rgba(29,158,117,0.12)', borderBottom: '1px solid rgba(29,158,117,0.25)', color: '#1D9E75' }}
        >
          ⏰{' '}
          {daysLeft === 0
            ? `Your Pro trial ends today. You'll be charged after midnight.`
            : `Your Pro trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — you won't be charged until ${trialEndDate}.`
          }
          {' '}
          <a href="/pricing" className="underline hover:opacity-80 transition-opacity" style={{ color: '#1D9E75' }}>
            Manage plan
          </a>
        </div>
      )}

      {/* ── Yesterday banner ── */}
      {isYesterday && (
        <div className="px-4 py-3 text-sm text-center font-semibold" style={{ backgroundColor: 'rgba(251,191,36,0.1)', borderBottom: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
          ⏳ Today&apos;s signals are being generated — showing yesterday&apos;s picks. Updates at 6:30 am EST.
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <p className="eyebrow mb-1">Signals</p>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl" style={{ fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-high)' }}>
                Today&apos;s Signals
              </h1>
              {isMax && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(79,70,229,0.2))',
                    color: '#a78bfa',
                    border: '1px solid rgba(124,58,237,0.4)',
                  }}
                >
                  <Zap className="w-3 h-3" /> MAX
                </span>
              )}
              {isPro && !isMax && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: 'rgba(0,155,255,0.15)',
                    color: '#009BFF',
                    border: '1px solid rgba(0,155,255,0.3)',
                  }}
                >
                  <Crown className="w-3 h-3" /> PRO
                </span>
              )}
            </div>
            <p className="text-sm text-white">{today}</p>
          </div>

          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            {/* Freshness dot: green = today, amber = yesterday */}
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: isYesterday ? '#fbbf24' : '#1D9E75' }}
              title={isYesterday ? 'Showing yesterday\'s signals' : 'Signals are fresh'}
            />
            <div>
              <p className="text-xs font-semibold text-white">
                {signals.length} signal{signals.length !== 1 ? 's' : ''}{isYesterday ? ' (yesterday)' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Main content */}
        {signals.length === 0 ? (
          <EmptyState />
        ) : isPro ? (
          <SignalBoardClient
            signals={serializedSignals}
            tier={tier}
            isAdmin={isAdmin}
            isYesterday={isYesterday}
            lastGenerated={lastLog?.generatedAt.toISOString() ?? null}
            volumeByTicker={volumeByTicker}
          />
        ) : (
          <div className="space-y-6">
            <UpgradeBanner />
            <SignalBoardClient
              signals={serializedSignals}
              tier="free"
              isAdmin={isAdmin}
              isYesterday={isYesterday}
              lastGenerated={lastLog?.generatedAt.toISOString() ?? null}
              volumeByTicker={volumeByTicker}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      className="rounded-2xl p-16 flex flex-col items-center justify-center text-center"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: 'rgba(0,155,255,0.15)' }}
      >
        <TrendingUp className="w-8 h-8" style={{ color: '#009BFF' }} />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">No signals yet</h3>
      <p className="text-sm text-white max-w-sm">
        Signals will appear here once they&apos;ve been added to the board. Check back soon.
      </p>
    </div>
  )
}
