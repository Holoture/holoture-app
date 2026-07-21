import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser, computeTier } from '@/lib/user'
import Header from '@/components/Header'
import AuthLoadingGate from '@/components/AuthLoadingGate'
import OptionsDashboardClient from '@/components/OptionsDashboardClient'
import Link from 'next/link'
import { Zap, Target } from 'lucide-react'

// Placeholder options shown blurred for non-max users when no real data
// exists yet — mirrors the mock data that used to live in
// SignalBoardClient.tsx before options moved to its own page.
const MOCK_OPTIONS = [
  { id: 'm1', ticker: 'NVDA', companyName: 'NVIDIA Corporation', contractType: 'CALL', strikePrice: 125, expirationDate: '2026-07-18', premiumEstimate: 4.20, confidence: 82.3, reasoning: '', summary: 'Strong AI momentum play with technical breakout above key resistance.', riskLevel: 'Medium', createdAt: new Date().toISOString() },
  { id: 'm2', ticker: 'TSLA', companyName: 'Tesla Inc', contractType: 'PUT', strikePrice: 240, expirationDate: '2026-07-11', premiumEstimate: 3.75, confidence: 71.5, reasoning: '', summary: 'Bearish technical setup with distribution pattern on the daily chart.', riskLevel: 'High', createdAt: new Date().toISOString() },
  { id: 'm3', ticker: 'META', companyName: 'Meta Platforms Inc', contractType: 'CALL', strikePrice: 580, expirationDate: '2026-07-25', premiumEstimate: 8.50, confidence: 78.1, reasoning: '', summary: 'Strong ad revenue growth catalyst ahead of earnings season.', riskLevel: 'Low', createdAt: new Date().toISOString() },
]

async function getOptionsSignals() {
  return prisma.optionsSignal.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  })
}

export default async function OptionsPage() {
  const { userId } = await auth()
  if (!userId) return <AuthLoadingGate />

  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  const tier = computeTier(user)
  const isMax = tier === 'max'

  const optionsSignals = await getOptionsSignals()
  const serialized = optionsSignals.map((s) => ({
    ...s,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : String(s.updatedAt),
  }))

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <p className="eyebrow mb-1">Signals</p>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl" style={{ fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-high)' }}>
              Options Signals
            </h1>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)' }}
            >
              <Target className="w-3 h-3" /> MAX
            </span>
          </div>
        </div>

        {isMax ? (
          <OptionsDashboardClient signals={serialized} />
        ) : (
          <div className="relative">
            <div className="pointer-events-none select-none" style={{ filter: 'blur(7px)', opacity: 0.55 }}>
              <OptionsDashboardClient
                signals={serialized.length > 0 ? serialized.slice(0, 3) : MOCK_OPTIONS}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="rounded-2xl p-8 flex flex-col items-center gap-4 text-center mx-4"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(234,179,8,0.4)', maxWidth: 380 }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(234,179,8,0.1))' }}
                >
                  <Zap className="w-7 h-7" style={{ color: '#eab308' }} />
                </div>
                <div>
                  <p className="font-bold text-white text-lg">Options Signals</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-w60)' }}>
                    Options signals are exclusive to Holoture Max — $25/month
                  </p>
                </div>
                <Link
                  href="/pricing"
                  className="px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white' }}
                >
                  Upgrade to Max
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
