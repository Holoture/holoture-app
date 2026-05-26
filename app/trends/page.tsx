import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Header from '@/components/Header'
import AutoRefresh from '@/components/AutoRefresh'
import { prisma } from '@/lib/prisma'
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react'

async function getSectorData() {
  try {
    const [snapshots, summary] = await Promise.all([
      prisma.sectorSnapshot.findMany(),
      prisma.marketSummary.findUnique({ where: { singleton: 'main' } }),
    ])
    return { snapshots, summary }
  } catch { return { snapshots: [], summary: null } }
}

export default async function TrendsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { snapshots, summary } = await getSectorData()

  const sorted = [...snapshots].sort((a, b) => b.change - a.change)
  const positiveCount = sorted.filter((s) => s.change > 0).length
  const overallTrend =
    positiveCount >= Math.ceil(sorted.length / 2) + 1
      ? 'Broad Rally'
      : positiveCount >= Math.floor(sorted.length / 2)
      ? 'Mixed Session'
      : 'Broad Selloff'
  const overallColor = overallTrend === 'Broad Rally' ? '#4ade80' : overallTrend === 'Mixed Session' ? '#fbbf24' : '#f87171'

  const updatedAt = snapshots[0]?.updatedAt ?? null

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <AutoRefresh intervalMs={5 * 60 * 1000} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <BarChart3 className="w-6 h-6" style={{ color: '#009BFF' }} />
              <h1 className="text-2xl font-black text-white">Sector Trends</h1>
            </div>
            <p className="text-sm text-white">ETF heat map with Claude AI market summary — refreshes every 5 min</p>
          </div>
          {updatedAt && (
            <p className="text-xs shrink-0" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>
              Updated {new Date(updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* AI Market Summary */}
        <div className="rounded-xl p-6 mb-8" style={{ background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-surface-2) 100%)', border: '1px solid rgba(0,155,255,0.3)' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#009BFF' }}>AI Market Summary</p>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              {sorted.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg font-black text-white">{overallTrend}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: overallColor + '30', color: overallColor, border: `1px solid ${overallColor}50` }}>
                    {positiveCount}/{sorted.length} sectors positive
                  </span>
                </div>
              )}
              <p className="text-sm text-white leading-relaxed">
                {summary?.content ?? (
                  sorted.length === 0
                    ? 'Awaiting first data fetch. The trends cron runs every 5 minutes — check back shortly.'
                    : overallTrend === 'Broad Rally'
                    ? 'Momentum is broad-based with most major sectors trading higher. Risk appetite appears elevated — watch for volume confirmation.'
                    : overallTrend === 'Mixed Session'
                    ? 'Markets are showing mixed signals with sector rotation in play. Defensive names are drawing interest while growth areas consolidate.'
                    : 'Broad selling pressure is weighing on equities across sectors. Risk-off positioning favors cash and defensive assets near-term.'
                )}
              </p>
            </div>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-xl p-10 text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <BarChart3 className="w-8 h-8 mx-auto mb-3" style={{ color: '#009BFF' }} />
            <p className="font-semibold text-white">No sector data yet</p>
            <p className="text-sm text-white mt-1">Ensure FINNHUB_API_KEY and ANTHROPIC_API_KEY are set and the cron has run.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sorted.map((sector) => {
              const change = sector.change
              const isPositive = change > 0
              const isNeutral = Math.abs(change) < 0.1
              const displayColor = isNeutral ? '#fbbf24' : isPositive ? '#4ade80' : '#f87171'
              const intensity = Math.min(Math.abs(change) / 3, 1)
              const bgOpacity = 0.05 + intensity * 0.15

              return (
                <div
                  key={sector.sector}
                  className="rounded-xl p-5"
                  style={{
                    backgroundColor: `rgba(${isPositive ? '34,197,94' : isNeutral ? '245,158,11' : '239,68,68'},${bgOpacity})`,
                    border: `1px solid ${displayColor}40`,
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-white">{sector.sector}</h3>
                      <p className="text-xs font-mono text-white mt-0.5">{sector.symbol}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {isPositive ? (
                        <TrendingUp className="w-4 h-4" style={{ color: displayColor }} />
                      ) : isNeutral ? null : (
                        <TrendingDown className="w-4 h-4" style={{ color: displayColor }} />
                      )}
                      <span className="text-lg font-black" style={{ color: displayColor }}>
                        {`${isPositive ? '+' : ''}${change.toFixed(2)}%`}
                      </span>
                    </div>
                  </div>

                  <div className="h-1.5 rounded-full mb-3" style={{ backgroundColor: 'var(--border-subtle)' }}>
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${Math.min(Math.abs(change) * 20 + 10, 100)}%`, backgroundColor: displayColor }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-white">
                    <span>${sector.price.toFixed(2)}</span>
                    <span style={{ color: sector.changeAmt >= 0 ? '#4ade80' : '#f87171' }}>
                      {sector.changeAmt >= 0 ? '+' : ''}{sector.changeAmt.toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
