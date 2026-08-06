import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Header from '@/components/Header'
import { AlertTriangle } from 'lucide-react'

export default async function AdminPoliticianTradesPage() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) redirect('/dashboard')

  const [incomplete, totalIncomplete] = await Promise.all([
    prisma.politicianTrade.findMany({
      where: { isIncomplete: true },
      orderBy: { fetchedAt: 'desc' },
      take: 200,
    }),
    prisma.politicianTrade.count({ where: { isIncomplete: true } }),
  ])

  function missingFields(t: (typeof incomplete)[number]): string[] {
    const missing: string[] = []
    if (!t.party || t.party === 'Unknown') missing.push('Party')
    if (!t.tradeType || t.tradeType === 'UNKNOWN') missing.push('Trade Type')
    if (!t.amountRange || t.amountRange === 'Unknown') missing.push('Amount')
    return missing
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-3 mb-1">
          <AlertTriangle className="w-6 h-6" style={{ color: '#fbbf24' }} />
          <h1 className="text-2xl font-black text-white">Excluded Politician Trades</h1>
        </div>
        <p className="text-sm mt-1 mb-8" style={{ color: 'var(--text-w50)' }}>
          {totalIncomplete} trade{totalIncomplete !== 1 ? 's' : ''} currently excluded from the public Politician
          Scanner — missing Party, Trade Type, or Amount at ingestion time. Never shown with a placeholder value;
          they re-check on every scraper run and drop off this list automatically once resolved. Showing up to 200.
        </p>

        {incomplete.length === 0 ? (
          <div className="rounded-2xl p-16 text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <p className="text-white font-semibold mb-2">Nothing excluded right now</p>
            <p className="text-sm text-white">Every ingested trade currently has Party, Trade Type, and Amount.</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-x-auto" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  {['Politician', 'Chamber', 'Ticker', 'Party', 'Trade Type', 'Amount', 'Missing', 'Fetched'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {incomplete.map((t, i) => (
                  <tr key={t.id} style={{ backgroundColor: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="px-4 py-3 text-white whitespace-nowrap">{t.politicianName}</td>
                    <td className="px-4 py-3 text-white whitespace-nowrap">{t.chamber}</td>
                    <td className="px-4 py-3 font-data text-white whitespace-nowrap">{t.ticker}</td>
                    <td className="px-4 py-3 text-white whitespace-nowrap">{t.party || '—'}</td>
                    <td className="px-4 py-3 text-white whitespace-nowrap">{t.tradeType || '—'}</td>
                    <td className="px-4 py-3 text-white whitespace-nowrap">{t.amountRange || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-none" style={{ backgroundColor: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.35)' }}>
                        {missingFields(t).join(', ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-w50)' }}>
                      {t.fetchedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
