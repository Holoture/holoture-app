import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser, computeTier } from '@/lib/user'
import Header from '@/components/Header'
import InsiderScannerClient from '@/components/InsiderScannerClient'
import AuthLoadingGate from '@/components/AuthLoadingGate'
import { TrendingUp, Lock } from 'lucide-react'
import Link from 'next/link'

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
  const isPro = tier === 'pro'

  // Free users — full lock screen (2 blurred previews shown in client)
  if (tier === 'free') {
    // Fetch just 2 trades for the blur preview
    const previewTrades = await getInsiderTrades(2)
    const serialized = previewTrades.map((t) => ({
      ...t,
      filingDate: t.filingDate.toISOString(),
      tradeDate: t.tradeDate.toISOString(),
      createdAt: t.createdAt.toISOString(),
    }))

    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-7 h-7" style={{ color: '#009BFF' }} />
              <h1 className="text-3xl font-black text-white">Insider Buying Scanner</h1>
            </div>
            <p style={{ color: 'var(--text-muted)' }}>
              Track significant insider purchases filed with the SEC — with AI significance ratings.
            </p>
          </div>

          {/* Blurred preview rows */}
          {serialized.length > 0 && (
            <div className="mb-6 relative">
              <div style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.5 }}>
                <InsiderScannerClient
                  trades={serialized}
                  tier="free"
                  isPreview
                />
              </div>
            </div>
          )}

          {/* Upgrade overlay */}
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: 'linear-gradient(135deg, rgba(0,155,255,0.08), rgba(124,58,237,0.08))', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ background: 'linear-gradient(135deg, rgba(0,155,255,0.2), rgba(124,58,237,0.15))' }}
            >
              <Lock className="w-10 h-10" style={{ color: '#60a5fa' }} />
            </div>
            <h2 className="text-2xl font-black text-white mb-3">Unlock Insider Buying Scanner</h2>
            <p className="mb-8 max-w-md mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              See every significant insider purchase with AI significance ratings, cluster buy alerts,
              and signal correlation. Available on Pro and Max.
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#009BFF', color: 'white' }}
            >
              View Plans
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Pro / Max — full access
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
