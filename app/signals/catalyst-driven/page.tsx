import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser, computeTier } from '@/lib/user'
import Header from '@/components/Header'
import MarketStatusBanner from '@/components/MarketStatusBanner'
import { getMarketStatus } from '@/lib/marketStatus'
import AuthLoadingGate from '@/components/AuthLoadingGate'
import EventDrivenSignalsClient from '@/components/EventDrivenSignalsClient' // filename unchanged (internal, not user-facing) — page renamed to "Catalyst-Driven"
import CatalystAlertsClient from '@/components/CatalystAlertsClient'
import { Zap, AlertTriangle } from 'lucide-react'

// ── REVISED: now deliberately UNVETTED, per explicit instruction — a
// reversal of this feature's original design. Two real, distinct sources
// feed this page now:
//   1. Signal rows with catalystType != null. As of cron/catalyst-signals/
//      route.ts, some of these bypass the liquidity floor entirely (thin/
//      illiquid names are admissible there) — NOT "same liquidity floor as
//      every other signal" anymore. cron/signals' own catalyst-tagged
//      output (still floor-gated) is mixed in here too; there is currently
//      no per-row way to tell which pipeline produced a given signal.
//   2. The separate News Catalyst Alerts feed (NewsCatalystAlert,
//      GlobeNewswire-sourced, no liquidity floor, was previously kept off
//      this page on purpose) is now embedded directly below, reusing
//      components/CatalystAlertsClient.tsx as-is rather than duplicating
//      its fetch/render logic.
async function getCatalystDrivenSignals() {
  return prisma.signal.findMany({
    where: { isActive: true, catalystType: { not: null } },
    orderBy: { confidence: 'desc' },
  })
}

export default async function CatalystDrivenSignalsPage() {
  const { userId } = await auth()
  if (!userId) return <AuthLoadingGate />

  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  const tier = computeTier(user)
  const marketStatus = getMarketStatus()

  const signals = await getCatalystDrivenSignals()
  const serialized = signals.map((s) => ({
    ...s,
    signalDate: s.signalDate instanceof Date ? s.signalDate.toISOString() : String(s.signalDate),
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
  }))

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <MarketStatusBanner {...marketStatus} />
        <div className="mb-8">
          <p className="eyebrow mb-1">Signals</p>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl" style={{ fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-high)' }}>
              Catalyst-Driven Signals
            </h1>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ backgroundColor: 'rgba(226,75,74,0.15)', color: '#E24B4A', border: '1px solid rgba(226,75,74,0.3)' }}
            >
              <Zap className="w-3 h-3" /> HIGH-RISK
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-w50)' }}>
            Signals and alerts driven by an identifiable event — earnings, a contract win, M&amp;A, an FDA decision, or a guidance change — not pure technical setups.
          </p>
          <div
            className="flex items-start gap-2 mt-4 px-4 py-3 rounded-lg"
            style={{ backgroundColor: 'rgba(226,75,74,0.08)', border: '1px solid rgba(226,75,74,0.25)' }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#E24B4A' }} />
            <p className="text-xs" style={{ color: 'var(--text-w60)' }}>
              Unvetted. Some signals below are NOT subject to the liquidity floor applied elsewhere on this platform — thin, illiquid names are admissible here. This page also embeds the separate News Catalyst Alerts feed (GlobeNewswire-sourced, no liquidity floor, best-effort ticker matching). Not financial advice.
            </p>
          </div>
        </div>

        <EventDrivenSignalsClient signals={serialized} tier={tier} />

        <div className="mt-10">
          <p className="eyebrow mb-3">News Catalyst Alerts</p>
          <CatalystAlertsClient />
        </div>
      </div>
    </div>
  )
}
