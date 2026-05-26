import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Header from '@/components/Header'
import { finnhubGet } from '@/lib/finnhub'
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react'

const SECTORS = [
  {
    name: 'Technology',
    symbols: ['AAPL', 'NVDA', 'MSFT', 'META', 'GOOGL'],
    color: '#009BFF',
    description: 'Software, semiconductors, hardware, cloud',
  },
  {
    name: 'Energy',
    symbols: ['XOM', 'CVX', 'COP', 'SLB', 'EOG'],
    color: '#fbbf24',
    description: 'Oil & gas, renewables, utilities',
  },
  {
    name: 'Healthcare',
    symbols: ['JNJ', 'UNH', 'PFE', 'ABBV', 'MRK'],
    color: '#4ade80',
    description: 'Pharma, biotech, medical devices, insurance',
  },
  {
    name: 'Finance',
    symbols: ['JPM', 'BAC', 'GS', 'MS', 'WFC'],
    color: '#a78bfa',
    description: 'Banks, insurance, fintech, asset management',
  },
  {
    name: 'Consumer',
    symbols: ['AMZN', 'TSLA', 'HD', 'NKE', 'MCD'],
    color: '#f87171',
    description: 'Retail, autos, travel, food & beverage',
  },
]

type Quote = { c: number; d: number; dp: number; h: number; l: number; o: number; pc: number }

async function fetchSectorQuotes() {
  const results: Record<string, { symbol: string; change: number }[]> = {}

  for (const sector of SECTORS) {
    const quotes = await Promise.all(
      sector.symbols.map(async (sym) => {
        const q = await finnhubGet<Quote>(`/quote?symbol=${sym}`, 300)
        return { symbol: sym, change: q?.dp ?? 0 }
      })
    )
    results[sector.name] = quotes
  }

  return results
}

export default async function TrendsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const sectorData = await fetchSectorQuotes()

  const sectorSummary = SECTORS.map((s) => {
    const quotes = sectorData[s.name] ?? []
    const avg = quotes.length ? quotes.reduce((acc, q) => acc + q.change, 0) / quotes.length : 0
    const hasData = quotes.some((q) => q.change !== 0)
    return { ...s, avgChange: avg, hasData }
  }).sort((a, b) => b.avgChange - a.avgChange)

  const positiveCount = sectorSummary.filter((s) => s.avgChange > 0).length
  const overallTrend = positiveCount >= 3 ? 'Broad Rally' : positiveCount >= 2 ? 'Mixed Session' : 'Broad Selloff'
  const overallColor = positiveCount >= 3 ? '#4ade80' : positiveCount >= 2 ? '#fbbf24' : '#f87171'

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <BarChart3 className="w-6 h-6" style={{ color: '#009BFF' }} />
            <h1 className="text-2xl font-black text-white">Sector Trends</h1>
          </div>
          <p className="text-sm text-white">Real-time sector heat map with AI market summary</p>
        </div>

        {/* AI Market Summary */}
        <div className="rounded-xl p-6 mb-8" style={{ background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-surface-2) 100%)', border: '1px solid rgba(0,155,255,0.3)' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#009BFF' }}>AI Market Summary</p>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-black text-white">{overallTrend}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: overallColor + '30', color: overallColor, border: `1px solid ${overallColor}50` }}>
                  {positiveCount}/5 sectors positive
                </span>
              </div>
              <p className="text-sm text-white leading-relaxed">
                {overallTrend === 'Broad Rally'
                  ? 'Momentum is broad-based today with most major sectors trading higher. Risk appetite appears elevated — watch for volume confirmation on breakouts.'
                  : overallTrend === 'Mixed Session'
                  ? 'Markets are showing mixed signals with sector rotation in play. Defensive names are drawing interest while growth areas consolidate.'
                  : 'Broad selling pressure is weighing on equities across sectors. Risk-off positioning favors cash and defensive assets near-term.'}
              </p>
            </div>
          </div>
        </div>

        {/* Sector Heatmap */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {sectorSummary.map((sector) => {
            const change = sector.avgChange
            const isPositive = change > 0
            const isNeutral = Math.abs(change) < 0.1
            const displayColor = isNeutral ? '#fbbf24' : isPositive ? '#4ade80' : '#f87171'
            const intensity = Math.min(Math.abs(change) / 3, 1)
            const bgOpacity = 0.05 + intensity * 0.15

            return (
              <div
                key={sector.name}
                className="rounded-xl p-5"
                style={{
                  backgroundColor: `rgba(${isPositive ? '34,197,94' : isNeutral ? '245,158,11' : '239,68,68'},${bgOpacity})`,
                  border: `1px solid ${displayColor}40`,
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-white">{sector.name}</h3>
                    <p className="text-xs text-white mt-0.5">{sector.description}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {isPositive ? <TrendingUp className="w-4 h-4" style={{ color: displayColor }} /> : isNeutral ? null : <TrendingDown className="w-4 h-4" style={{ color: displayColor }} />}
                    <span className="text-lg font-black" style={{ color: displayColor }}>
                      {sector.hasData ? `${isPositive ? '+' : ''}${change.toFixed(2)}%` : '—'}
                    </span>
                  </div>
                </div>

                <div className="h-1.5 rounded-full mb-3" style={{ backgroundColor: 'var(--border-subtle)' }}>
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(Math.abs(change) * 20 + 10, 100)}%`, backgroundColor: displayColor }}
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(sectorData[sector.name] ?? []).map((q) => (
                    <span key={q.symbol} className="text-xs px-2 py-0.5 rounded font-mono font-semibold text-white" style={{ backgroundColor: 'var(--border)' }}>
                      {q.symbol}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {!sectorSummary.some((s) => s.hasData) && (
          <div className="rounded-xl p-4 text-center text-sm text-white" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            Add a <code className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-surface-3)' }}>FINNHUB_API_KEY</code> to your environment to see live sector performance data.
          </div>
        )}
      </div>
    </div>
  )
}
