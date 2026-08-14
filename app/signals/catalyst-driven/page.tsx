import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser, computeTier } from '@/lib/user'
import Header from '@/components/Header'
import MarketStatusBanner from '@/components/MarketStatusBanner'
import { getMarketStatus } from '@/lib/marketStatus'
import AuthLoadingGate from '@/components/AuthLoadingGate'
import EventDrivenSignalsClient from '@/components/EventDrivenSignalsClient' // filename unchanged (internal, not user-facing) — page renamed to "Catalyst-Driven"
import { Zap } from 'lucide-react'

// Real Signal rows only — same model, same liquidity floor, same quality
// gates as every other signal category. Filtered to catalystType != null,
// which cron/signals/route.ts only ever sets AFTER a candidate has already
// cleared fetchStockData()'s price/dollar-volume gates. This is NOT the
// separate, unvetted News Catalyst Alerts feature (NewsCatalystAlert model,
// GlobeNewswire-sourced, no liquidity floor) — see prisma/schema.prisma's
// Signal.catalystType comment for the full distinction. Page label is
// "Catalyst-Driven" per explicit instruction, despite the real name
// collision with Catalyst Alerts (flagged when renamed from "Event-Driven",
// which was chosen specifically to avoid that collision).
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
            Fully-vetted signals where the primary driver is an identifiable event — earnings, a contract win, M&amp;A, an FDA decision, or a guidance change — not pure technical setups. Same liquidity floor and quality gates as every other signal on this platform.
          </p>
        </div>

        <EventDrivenSignalsClient signals={serialized} tier={tier} />
      </div>
    </div>
  )
}
