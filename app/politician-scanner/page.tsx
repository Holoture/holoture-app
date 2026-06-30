import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser, computeTier } from '@/lib/user'
import Header from '@/components/Header'
import PoliticianTradesClient from '@/components/PoliticianTradesClient'
import AuthLoadingGate from '@/components/AuthLoadingGate'
import { Users } from 'lucide-react'

// Cap how many trades from any single politician can appear in the feed so
// one prolific filer (e.g. a spouse with dozens of trades in a single PTR)
// doesn't crowd out everyone else.
const MAX_PER_POLITICIAN = 3

async function getPoliticianTrades(limit = 50) {
  try {
    const trades = await prisma.politicianTrade.findMany({
      orderBy: { filedAt: 'desc' },
      take: limit * 4,
    })

    const counts = new Map<string, number>()
    const result: typeof trades = []
    for (const trade of trades) {
      const count = counts.get(trade.politicianName) ?? 0
      if (count >= MAX_PER_POLITICIAN) continue
      counts.set(trade.politicianName, count + 1)
      result.push(trade)
      if (result.length >= limit) break
    }
    return result
  } catch { return [] }
}

export default async function PoliticianScannerPage() {
  const { userId } = await auth()

  // Use client-side AuthLoadingGate instead of an immediate server redirect to
  // prevent the redirect loop that occurs when Clerk's session validation is
  // temporarily unavailable (e.g. during custom-domain SSL provisioning).
  if (!userId) return <AuthLoadingGate />

  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  const tier = computeTier(user)

  // All tiers — full access to politician scanner
  const trades = await getPoliticianTrades(50)
  const lastFetched = trades[0]?.fetchedAt

  // Serialize Dates to strings for the client component
  const serialized = trades.map((t) => ({
    id: t.id,
    politicianName: t.politicianName,
    party: t.party,
    chamber: t.chamber,
    ticker: t.ticker,
    companyName: t.companyName,
    tradeType: t.tradeType,
    amountRange: t.amountRange,
    tradedAt: t.tradedAt instanceof Date ? t.tradedAt.toISOString() : String(t.tradedAt),
    filedAt: t.filedAt instanceof Date ? t.filedAt.toISOString() : String(t.filedAt),
    aiCommentary: t.aiCommentary,
    significance: t.significance,
  }))

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Users className="w-6 h-6" style={{ color: '#a78bfa' }} />
            <h1 className="text-2xl font-black text-white">Politician Scanner</h1>
          </div>
          <p className="text-sm text-white" style={{ opacity: 0.7 }}>
            Recent stock disclosures by US Congress members
            {lastFetched && (
              <span>
                {' '}· Last updated{' '}
                {lastFetched instanceof Date
                  ? lastFetched.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : String(lastFetched)}
              </span>
            )}
          </p>
        </div>

        {serialized.length === 0 ? (
          <div
            className="rounded-2xl p-16 flex flex-col items-center justify-center text-center"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <Users className="w-10 h-10 mb-4" style={{ color: '#a78bfa', opacity: 0.5 }} />
            <h3 className="text-lg font-bold text-white mb-2">No trades yet</h3>
            <p className="text-sm text-white" style={{ opacity: 0.6 }}>
              Check back after the next scheduled refresh.
            </p>
          </div>
        ) : (
          <PoliticianTradesClient trades={serialized} isPreview={false} />
        )}

        <p className="text-xs text-white opacity-30 mt-8 text-center">
          All trades are public disclosures required by the STOCK Act. Not financial advice.
        </p>
      </div>
    </div>
  )
}
