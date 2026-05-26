import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser, computeTier } from '@/lib/user'
import Header from '@/components/Header'
import { Users, TrendingUp, TrendingDown, Lock } from 'lucide-react'
import Link from 'next/link'

async function getPoliticianTrades() {
  try {
    return await prisma.politicianTrade.findMany({
      orderBy: { filedAt: 'desc' },
      take: 50,
    })
  } catch { return [] }
}

const PARTY_COLORS: Record<string, { bg: string; text: string }> = {
  Democrat: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
  Republican: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
  Independent: { bg: 'rgba(168,85,247,0.15)', text: '#c084fc' },
}

const SIGNIFICANCE_COLORS: Record<string, string> = {
  High: '#f87171',
  Medium: '#fbbf24',
  Low: '#94a3b8',
}

export default async function PoliticianScannerPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  const tier = computeTier(user)
  const isMax = tier === 'max'

  if (!isMax) {
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
          <p className="text-white mb-8">
            The Politician Scanner is exclusive to Holoture Max subscribers. See exactly what
            congress members are buying and selling — with significance ratings.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white' }}
          >
            Upgrade to Max — $25/month
          </Link>
        </div>
      </div>
    )
  }

  const trades = await getPoliticianTrades()
  const lastFetched = trades[0]?.fetchedAt

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Users className="w-6 h-6" style={{ color: '#a78bfa' }} />
            <h1 className="text-2xl font-black text-white">Politician Scanner</h1>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}
            >
              MAX
            </span>
          </div>
          <p className="text-sm text-white">
            Recent stock trades by US Congress members — refreshes daily
            {lastFetched && (
              <span className="opacity-60">
                {' '}· Last updated {lastFetched.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </p>
        </div>

        {trades.length === 0 ? (
          <div
            className="rounded-2xl p-16 flex flex-col items-center justify-center text-center"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <Users className="w-10 h-10 mb-4" style={{ color: '#a78bfa' }} />
            <h3 className="text-lg font-bold text-white mb-2">No trades yet</h3>
            <p className="text-sm text-white">
              Data is fetched daily from Capitol Trades. Check back after the next scheduled refresh.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {trades.map((trade) => {
              const partyStyle = PARTY_COLORS[trade.party] ?? { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8' }
              const sigColor = SIGNIFICANCE_COLORS[trade.significance] ?? '#94a3b8'
              const isBuy = trade.tradeType.toLowerCase().includes('buy') || trade.tradeType.toLowerCase() === 'purchase'
              return (
                <div
                  key={trade.id}
                  className="rounded-xl p-5"
                  style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-bold text-white">{trade.politicianName}</span>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: partyStyle.bg, color: partyStyle.text }}
                        >
                          {trade.party}
                        </span>
                        <span className="text-xs text-white opacity-60">{trade.chamber}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className="text-xl font-black text-white">{trade.ticker}</span>
                        <span className="text-sm text-white">{trade.companyName}</span>
                        <span
                          className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                          style={
                            isBuy
                              ? { backgroundColor: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }
                              : { backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }
                          }
                        >
                          {isBuy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {trade.tradeType.toUpperCase()}
                        </span>
                      </div>

                      {trade.aiCommentary && (
                        <p className="text-sm text-white leading-relaxed">{trade.aiCommentary}</p>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-white opacity-60">Amount</p>
                        <p className="text-sm font-semibold text-white">{trade.amountRange}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-white opacity-60">Filed</p>
                        <p className="text-sm text-white">
                          {trade.filedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${sigColor}20`, color: sigColor, border: `1px solid ${sigColor}40` }}
                      >
                        {trade.significance}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-xs text-white opacity-40 mt-8 text-center">
          Data sourced from Capitol Trades. All trades are public disclosures required by the STOCK Act. Not financial advice.
        </p>
      </div>
    </div>
  )
}
