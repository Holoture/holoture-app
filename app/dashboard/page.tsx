import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser } from '@/lib/user'
import Header from '@/components/Header'
import SignalCard from '@/components/SignalCard'
import FreeSignalCard, { UpgradeBanner } from '@/components/FreeSignalCard'
import { TrendingUp, Crown, Zap } from 'lucide-react'

async function getSignals() {
  return prisma.signal.findMany({
    where: { isActive: true },
    orderBy: { signalDate: 'desc' },
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

  const [user, signals, lastLog] = await Promise.all([getOrCreateUser(), getSignals(), getLastGenerationLog()])
  if (!user) redirect('/sign-in')

  const now = new Date()
  const isPro =
    (user.tier === 'pro' && user.subscriptionStatus === 'active') ||
    user.isLifetimePro ||
    (user.proExpiresAt !== null && user.proExpiresAt > now)
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const freeSignal = signals.length > 0
    ? signals[Math.floor(Date.now() / 86400000) % signals.length]
    : null

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-black text-white">Signal Board</h1>
              {isPro && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{ backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.3)' }}
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
                {isPro ? `${signals.length} Active Signals` : '1 Signal Today'}
              </p>
              <p className="text-xs text-white">
                {lastLog
                  ? `Generated ${lastLog.generatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}`
                  : isPro ? 'Full curated board' : 'Free daily pick'}
              </p>
            </div>
          </div>
        </div>

        {signals.length === 0 ? (
          <EmptyState />
        ) : isPro ? (
          <ProDashboard signals={signals} />
        ) : (
          <FreeDashboard signal={freeSignal} allSignals={signals} />
        )}
      </div>
    </div>
  )
}

function ProDashboard({ signals }: { signals: Awaited<ReturnType<typeof getSignals>> }) {
  const byType = {
    BUY: signals.filter((s) => s.signalType === 'BUY'),
    WATCH: signals.filter((s) => s.signalType === 'WATCH' || s.signalType === 'HOLD'),
    SHORT: signals.filter((s) => s.signalType === 'SHORT' || s.signalType === 'SELL'),
  }

  return (
    <div className="space-y-10">
      {byType.BUY.length > 0 && (
        <Section title="Buy Signals" color="#4ade80" count={byType.BUY.length}>
          {byType.BUY.map((s) => <SignalCard key={s.id} signal={{ ...s, signalDate: s.signalDate.toISOString() }} />)}
        </Section>
      )}
      {byType.WATCH.length > 0 && (
        <Section title="Watch / Hold" color="#fbbf24" count={byType.WATCH.length}>
          {byType.WATCH.map((s) => <SignalCard key={s.id} signal={{ ...s, signalDate: s.signalDate.toISOString() }} />)}
        </Section>
      )}
      {byType.SHORT.length > 0 && (
        <Section title="Short / Avoid" color="#f87171" count={byType.SHORT.length}>
          {byType.SHORT.map((s) => <SignalCard key={s.id} signal={{ ...s, signalDate: s.signalDate.toISOString() }} />)}
        </Section>
      )}
    </div>
  )
}

function FreeDashboard({
  signal,
  allSignals,
}: {
  signal: Awaited<ReturnType<typeof getSignals>>[number] | null
  allSignals: Awaited<ReturnType<typeof getSignals>>
}) {
  const lockedSignals = allSignals.filter((s) => s.id !== signal?.id).slice(0, 5)

  return (
    <div className="space-y-8">
      <UpgradeBanner />
      {signal && (
        <div>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" style={{ color: '#009BFF' }} />
            Today&apos;s Free Signal
          </h2>
          <div className="max-w-lg">
            <SignalCard signal={{ ...signal, signalDate: signal.signalDate.toISOString() }} />
          </div>
        </div>
      )}
      {lockedSignals.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-white mb-4">
            More Signals{' '}
            <span className="text-sm font-normal text-white">— Unlock with Pro</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {lockedSignals.map((s) => (
              <FreeSignalCard key={s.id} signal={{ ...s, signalDate: s.signalDate.toISOString() }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, color, count, children }: {
  title: string; color: string; count: number; children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-6 rounded-full" style={{ backgroundColor: color }} />
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: `${color}20`, color }}>
          {count}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{children}</div>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      className="rounded-2xl p-16 flex flex-col items-center justify-center text-center"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(0,155,255,0.15)' }}>
        <TrendingUp className="w-8 h-8" style={{ color: '#009BFF' }} />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">No signals yet</h3>
      <p className="text-sm text-white max-w-sm">Signals will appear here once they&apos;ve been added to the board. Check back soon.</p>
    </div>
  )
}
