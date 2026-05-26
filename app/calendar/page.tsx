import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Header from '@/components/Header'
import { finnhubGet } from '@/lib/finnhub'
import { CalendarDays, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react'

type EarningsEntry = {
  date: string
  epsActual: number | null
  epsEstimate: number | null
  hour: string
  quarter: number
  revenueActual: number | null
  revenueEstimate: number | null
  symbol: string
  year: number
}

type EarningsResponse = {
  earningsCalendar: EarningsEntry[]
}

function getImpactRating(symbol: string): { label: string; color: string } {
  const highImpact = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA', 'JPM', 'BAC', 'GS', 'MS', 'JNJ', 'UNH', 'XOM', 'CVX']
  const mediumImpact = ['AMD', 'INTC', 'QCOM', 'CRM', 'ORCL', 'NFLX', 'UBER', 'LYFT', 'ABNB', 'SQ', 'PYPL', 'MU', 'WMT', 'TGT', 'COST']
  if (highImpact.includes(symbol)) return { label: 'High', color: '#f87171' }
  if (mediumImpact.includes(symbol)) return { label: 'Medium', color: '#fbbf24' }
  return { label: 'Low', color: '#4ade80' }
}

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

export default async function CalendarPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const today = new Date()
  const inThirty = new Date(today)
  inThirty.setDate(today.getDate() + 30)
  const from = today.toISOString().split('T')[0]
  const to = inThirty.toISOString().split('T')[0]

  const data = await finnhubGet<EarningsResponse>(`/calendar/earnings?from=${from}&to=${to}`, 3600)
  const earnings = data?.earningsCalendar?.slice(0, 40) ?? []

  const byDate: Record<string, EarningsEntry[]> = {}
  for (const e of earnings) {
    if (!byDate[e.date]) byDate[e.date] = []
    byDate[e.date].push(e)
  }
  const sortedDates = Object.keys(byDate).sort()

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#353535' }}>
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <CalendarDays className="w-6 h-6" style={{ color: '#009BFF' }} />
            <h1 className="text-2xl font-black text-white">Earnings Calendar</h1>
          </div>
          <p className="text-sm text-white">Upcoming earnings dates and macro events with AI impact ratings</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Earnings */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-bold text-white mb-4">Earnings — Next 30 Days</h2>
            {earnings.length === 0 ? (
              <div className="rounded-xl p-10 text-center" style={{ backgroundColor: '#404040', border: '1px solid rgba(255,255,255,0.2)' }}>
                <CalendarDays className="w-8 h-8 mx-auto mb-3" style={{ color: '#009BFF' }} />
                <p className="font-semibold text-white">No earnings data</p>
                <p className="text-sm text-white mt-1">Add a FINNHUB_API_KEY to see upcoming earnings.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedDates.map((date) => {
                  const items = byDate[date]
                  const d = new Date(date + 'T00:00:00')
                  const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                  return (
                    <div key={date}>
                      <p className="text-xs font-bold uppercase tracking-widest mb-2 text-white">{label}</p>
                      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
                        {items.map((item, i) => {
                          const impact = getImpactRating(item.symbol)
                          const hasEps = item.epsEstimate !== null
                          return (
                            <div
                              key={item.symbol + i}
                              className="flex items-center gap-4 px-4 py-3"
                              style={{
                                backgroundColor: i % 2 === 0 ? '#404040' : '#3a3a3a',
                                borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                              }}
                            >
                              <div className="w-16 shrink-0">
                                <span className="font-black text-white">{item.symbol}</span>
                              </div>
                              <div className="flex-1 text-xs text-white">
                                {item.hour === 'bmo' ? '🌅 Pre-Market' : item.hour === 'amc' ? '🌙 After Close' : '🕑 During'}
                              </div>
                              {hasEps && (
                                <div className="text-xs text-white hidden sm:block">
                                  EPS est. <span className="font-semibold">${item.epsEstimate?.toFixed(2)}</span>
                                </div>
                              )}
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: impact.color + '20', color: impact.color, border: `1px solid ${impact.color}40` }}>
                                {impact.label}
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

          {/* Macro Events */}
          <div>
            <h2 className="text-lg font-bold text-white mb-4">Macro Events</h2>
            <div className="space-y-3">
              {MACRO_EVENTS.map((evt) => (
                <div key={evt.event} className="rounded-xl p-4" style={{ backgroundColor: '#404040', border: '1px solid rgba(255,255,255,0.2)' }}>
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
