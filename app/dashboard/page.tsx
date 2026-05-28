import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser, computeTier } from '@/lib/user'
import Header from '@/components/Header'
import SignalBoardClient from '@/components/SignalBoardClient'
import OptionsDashboardClient from '@/components/OptionsDashboardClient'
import { UpgradeBanner } from '@/components/FreeSignalCard'
import { TrendingUp, Crown, Zap, Lock } from 'lucide-react'
import Link from 'next/link'

async function getSignals() {
  return prisma.signal.findMany({
    where: { isActive: true },
    orderBy: { signalDate: 'desc' },
  })
}

async function getOptionsSignals() {
  return prisma.optionsSignal.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  })
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
  if (!userId) redirect('/sign-in')

  let user: Awaited<ReturnType<typeof getOrCreateUser>> = null
  let signals: Awaited<ReturnType<typeof getSignals>> = []
  let optionsSignals: Awaited<ReturnType<typeof getOptionsSignals>> = []
  let lastLog: Awaited<ReturnType<typeof getLastGenerationLog>> = null

  try {
    ;[user, signals, optionsSignals, lastLog] = await Promise.all([
      getOrCreateUser(),
      getSignals(),
      getOptionsSignals(),
      getLastGenerationLog(),
    ])
  } catch (e) {
    console.error('[dashboard] data fetch error:', e)
    throw e
  }

  if (!user) redirect('/sign-in')

  const tier = computeTier(user)
  const isPro = tier === 'pro' || tier === 'max'
  const isMax = tier === 'max'

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  // Serialize signals (Date → string) for client components
  const serializedSignals = signals.map(s => ({
    ...s,
    signalDate: s.signalDate instanceof Date ? s.signalDate.toISOString() : String(s.signalDate),
  }))

  const serializedOptions = optionsSignals.map(s => ({
    ...s,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : String(s.updatedAt),
  }))

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-black text-white">Signal Board</h1>
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
            <Zap className="w-4 h-4" style={{ color: '#009BFF' }} />
            <div>
              <p className="text-xs font-semibold text-white">
                {isPro ? `${signals.length} Active Signals` : `${signals.length} Signals Available`}
              </p>
              <p className="text-xs text-white">
                {lastLog
                  ? `Updated ${lastLog.generatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })} EST`
                  : isPro ? 'Full curated board' : 'Upgrade to unlock all details'}
              </p>
            </div>
          </div>
        </div>

        {/* Main content */}
        {signals.length === 0 ? (
          <EmptyState />
        ) : isPro ? (
          <div className="space-y-10">
            <SignalBoardClient signals={serializedSignals} tier={tier} />
            {isMax && <OptionsDashboardClient signals={serializedOptions} />}
            {!isMax && <MaxUpsell />}
          </div>
        ) : (
          <div className="space-y-6">
            <UpgradeBanner />
            <SignalBoardClient signals={serializedSignals} tier="free" />
          </div>
        )}
      </div>
    </div>
  )
}

function MaxUpsell() {
  return (
    <div
      className="rounded-xl p-6 flex flex-col sm:flex-row items-center gap-4"
      style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(79,70,229,0.08) 100%)',
        border: '1px solid rgba(124,58,237,0.35)',
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'rgba(124,58,237,0.2)' }}
      >
        <Lock className="w-6 h-6" style={{ color: '#a78bfa' }} />
      </div>
      <div className="text-center sm:text-left flex-1">
        <h3 className="font-bold text-white">Unlock Options Signals &amp; Politician Scanner</h3>
        <p className="text-sm mt-1 text-white">
          Holoture Max adds CALL/PUT options signals and the politician stock scanner — $25/month.
        </p>
      </div>
      <Link
        href="/pricing"
        className="px-5 py-2.5 rounded-lg font-semibold text-sm shrink-0 hover:opacity-90 transition-opacity"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white' }}
      >
        Upgrade to Max
      </Link>
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
