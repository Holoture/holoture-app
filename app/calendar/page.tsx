import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Header from '@/components/Header'
import { prisma } from '@/lib/prisma'
import { CalendarDays, AlertCircle } from 'lucide-react'

const MACRO_EVENTS = [
  { date: 'Weekly', event: 'Initial Jobless Claims', impact: 'Medium', color: '#fbbf24', description: 'Leading indicator for labor market health' },
  { date: 'Monthly', event: 'CPI — Consumer Price Index', impact: 'High', color: '#f87171', description: 'Key inflation gauge watched by the Fed' },
  { date: 'Monthly', event: 'Non-Farm Payrolls', impact: 'High', color: '#f87171', description: 'Primary employment report; major market mover' },
  { date: 'Monthly', event: 'FOMC Interest Rate Decision', impact: 'High', color: '#f87171', description: 'Fed rate decisions drive equity & bond volatility' },
  { date: 'Monthly', event: 'PCE — Core Personal Consumption', impact: 'High', color: '#f87171', description: "The Fed's preferred inflation measure" },
  { date: 'Monthly', event: 'Retail Sales', impact: 'Medium', color: '#fbbf24', description: 'Measures consumer spending strength' },
  { date: 'Quarterly', event: 'GDP Advance Estimate', impact: 'High', color: '#f87171', description: 'Broad measure of economic growth' },
  { date: 'Quarterly', event: 'Earnings Season', impact: 'High', color: '#f87171', description: 'S&P 500 companies report quarterly results' },
]

async function getCalendarEntries() {
  try {
    const today = new Date().toISOString().split('T')[0]
    return await prisma.calendarEntry.findMany({
      where: { date: { gte: today } },
      orderBy: { date: 'asc' },
      take: 60,
    })
  } catch { return [] }
}

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)
  return d >= weekStart && d < weekEnd
}

export default async function CalendarPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const entries = await getCalendarEntries()

  const byDate: Record<string, typeof entries> = {}
  for (const e of entries) {
    if (!byDate[e.date]) byDate[e.date] = []
    byDate[e.date].push(e)
  }
  const sortedDates = Object.keys(byDate).sort()

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <CalendarDays className="w-6 h-6" style={{ color: '#009BFF' }} />
            <h1 className="text-2xl font-black text-white">Earnings Calendar</h1>
          </div>
          <p className="text-sm text-white">Upcoming earnings dates with Claude AI impact ratings — updates daily at midnight</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="text-lg font-bold text-white mb-4">Earnings — Next 30 Days</h2>
            {entries.length === 0 ? (
              <div className="rounded-xl p-10 text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <CalendarDays className="w-8 h-8 mx-auto mb-3" style={{ color: '#009BFF' }} />
                <p className="font-semibold text-white">No earnings data yet</p>
                <p className="text-sm text-white mt-1">The calendar cron runs daily at midnight. Ensure FINNHUB_API_KEY and ANTHROPIC_API_KEY are set.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedDates.map((date) => {
                  const items = byDate[date]
                  const d = new Date(date + 'T00:00:00')
                  const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                  const thisWeek = isThisWeek(date)
                  return (
                    <div key={date}>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs font-bold uppercase tracking-widest text-white">{label}</p>
                        {thisWeek && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF' }}>
                            This Week
                          </span>
                        )}
                      </div>
                      <div className="rounded-xl overflow-hidden" style={{ border: thisWeek ? '1px solid rgba(0,155,255,0.4)' : '1px solid var(--border)' }}>
                        {items.map((item, i) => {
                          const impactColor = item.impactRating === 'High' ? '#f87171' : item.impactRating === 'Medium' ? '#fbbf24' : '#4ade80'
                          return (
                            <div
                              key={item.id}
                              className="flex items-center gap-4 px-4 py-3"
                              style={{
                                backgroundColor: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-surface-2)',
                                borderBottom: i < items.length - 1 ? '1px solid var(--border-faint)' : 'none',
                              }}
                            >
                              <div className="w-16 shrink-0">
                                <span className="font-black text-white">{item.symbol}</span>
                              </div>
                              <div className="flex-1 text-xs text-white">
                                {item.hour === 'bmo' ? '🌅 Pre-Market' : item.hour === 'amc' ? '🌙 After Close' : '🕑 During'}
                              </div>
                              {item.epsEstimate !== null && (
                                <div className="text-xs text-white hidden sm:block">
                                  EPS est. <span className="font-semibold">${item.epsEstimate.toFixed(2)}</span>
                                </div>
                              )}
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: impactColor + '20', color: impactColor, border: `1px solid ${impactColor}40` }}>
                                {item.impactRating}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-4">Macro Events</h2>
            <div className="space-y-3">
              {MACRO_EVENTS.map((evt) => (
                <div key={evt.event} className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm text-white leading-snug">{evt.event}</p>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: evt.color + '20', color: evt.color, border: `1px solid ${evt.color}40` }}>
                      {evt.impact}
                    </span>
                  </div>
                  <p className="text-xs text-white">{evt.date}</p>
                  <p className="text-xs text-white mt-1">{evt.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl p-4" style={{ backgroundColor: 'rgba(0,155,255,0.08)', border: '1px solid rgba(0,155,255,0.3)' }}>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#009BFF' }} />
                <p className="text-xs text-white leading-relaxed">Earnings dates can shift. Always confirm with your broker before trading around announcements.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
