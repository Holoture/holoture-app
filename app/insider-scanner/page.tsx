import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser, computeTier } from '@/lib/user'
import Header from '@/components/Header'
import InsiderScannerClient from '@/components/InsiderScannerClient'
import AuthLoadingGate from '@/components/AuthLoadingGate'

async function getInsiderTrades(limit = 100) {
  try {
    return await prisma.insiderTrade.findMany({
      orderBy: { filingDate: 'desc' },
      take: limit,
    })
  } catch { return [] }
}

export default async function InsiderScannerPage() {
  const { userId } = await auth()

  if (!userId) return <AuthLoadingGate />

  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  const tier = computeTier(user)
  const isMax = tier === 'max'

  // All tiers — full access to insider scanner
  const trades = await getInsiderTrades(200)

  // Fetch active signal tickers for Max correlation feature
  let activeSignalTickers: Set<string> = new Set()
  if (isMax) {
    try {
      const activeSignals = await prisma.signal.findMany({
        where: { isActive: true },
        select: { ticker: true },
      })
      activeSignalTickers = new Set(activeSignals.map((s) => s.ticker))
    } catch { /* noop */ }
  }

  const serialized = trades.map((t) => ({
    ...t,
    filingDate: t.filingDate.toISOString(),
    tradeDate: t.tradeDate.toISOString(),
    createdAt: t.createdAt.toISOString(),
    hasActiveSignal: activeSignalTickers.has(t.ticker),
  }))

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-12">
        <InsiderScannerClient
          trades={serialized}
          tier={tier}
        />
      </div>
    </div>
  )
}
