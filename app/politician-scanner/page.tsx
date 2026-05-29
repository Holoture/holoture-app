import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser, computeTier } from '@/lib/user'
import Header from '@/components/Header'
import PoliticianTradesClient from '@/components/PoliticianTradesClient'
import AuthLoadingGate from '@/components/AuthLoadingGate'
import { Users, Lock } from 'lucide-react'
import Link from 'next/link'

async function getPoliticianTrades(limit = 50) {
  try {
    return await prisma.politicianTrade.findMany({
      orderBy: { filedAt: 'desc' },
      take: limit,
    })
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
  const isMax = tier === 'max'
  const isPro = tier === 'pro'

  // Free users — full lock screen
  if (tier === 'free') {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-32 text-center">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.15))' }}
          >
            <Lock className="w-10 h-10" style={{ color: '#a78bfa' }} />
          </div>
          <h1 className="text-3xl font-black text-white mb-4">Politician Scanner</h1>
          <p className="text-white mb-8 leading-relaxed" style={{ opacity: 0.75 }}>
            See exactly what Congress members are buying and selling — with significance ratings
            and commentary. Available on Pro and Max.
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
    )
  }

  // Pro and Max — fetch trades (Pro gets preview of 3)
  const trades = await getPoliticianTrades(isMax ? 50 : 10)
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Users className="w-6 h-6" style={{ color: '#a78bfa' }} />
            <h1 className="text-2xl font-black text-white">Politician Scanner</h1>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}
            >
              {isMax ? 'MAX' : 'PRO PREVIEW'}
            </span>
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
          <PoliticianTradesClient trades={serialized} isPreview={isPro} />
        )}

        <p className="text-xs text-white opacity-30 mt-8 text-center">
          All trades are public disclosures required by the STOCK Act. Not financial advice.
        </p>
      </div>
    </div>
  )
}
