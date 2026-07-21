import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Header from '@/components/Header'
import { prisma } from '@/lib/prisma'
import { getExtendedHoursQuotes } from '@/lib/schwab'
import { formatCurrency } from '@/lib/utils'
import { Sunrise, Moon, TrendingUp, TrendingDown } from 'lucide-react'

type Session = 'premarket' | 'afterhours'

/** Which extended session to show, and whether it's still live right now. */
function getSessionState(): { session: Session; isLive: boolean } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false,
  }).formatToParts(new Date())
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  const mins = hour * 60 + minute

  const PREMARKET_START = 4 * 60          // 4:00am
  const REGULAR_OPEN = 9 * 60 + 30        // 9:30am
  const REGULAR_CLOSE = 16 * 60           // 4:00pm
  const AFTERHOURS_END = 20 * 60          // 8:00pm

  // Weekend: Friday's after-hours session is the most recent one.
  if (weekday === 'Sat' || weekday === 'Sun') return { session: 'afterhours', isLive: false }

  if (mins >= PREMARKET_START && mins < REGULAR_OPEN) return { session: 'premarket', isLive: true }
  if (mins >= REGULAR_CLOSE && mins < AFTERHOURS_END) return { session: 'afterhours', isLive: true }
  // Regular trading hours: premarket just completed, after-hours hasn't started.
  if (mins >= REGULAR_OPEN && mins < REGULAR_CLOSE) return { session: 'premarket', isLive: false }
  // Late night / early morning: after-hours from the prior session is most recent.
  return { session: 'afterhours', isLive: false }
}

async function getMovers() {
  const universe = await prisma.tickerUniverse.findMany({
    select: { ticker: true },
  })
  const tickers = universe.map((t) => t.ticker)
  if (tickers.length === 0) return []

  const quotes = await getExtendedHoursQuotes(tickers)
  return [...quotes.values()]
    .sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange))
    .slice(0, 15)
}

export default async function MoversPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { session, isLive } = getSessionState()
  const movers = await getMovers()

  const title = session === 'premarket' ? 'Premarket Movers' : 'After-Hours Movers'
  const Icon = session === 'premarket' ? Sunrise : Moon

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <Icon className="w-6 h-6" style={{ color: '#009BFF' }} />
            <h1 className="text-2xl font-black text-white">{title}</h1>
            {!isLive && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-w50)', border: '1px solid var(--border)' }}
              >
                Last session
              </span>
            )}
            {isLive && (
              <span
                className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}
              >
                <span className="relative flex w-1.5 h-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#4ade80' }} />
                  <span className="relative inline-flex rounded-full w-1.5 h-1.5" style={{ backgroundColor: '#4ade80' }} />
                </span>
                LIVE
              </span>
            )}
          </div>
          <p className="text-sm text-white" style={{ opacity: 0.6 }}>
            Raw price-movement data from the screened ticker universe — not a trading signal.
            No BUY/WATCH/SHORT call or confidence score applies to anything shown here.
          </p>
        </div>

        {movers.length === 0 ? (
          <div className="rounded-xl p-10 text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <Icon className="w-8 h-8 mx-auto mb-3" style={{ color: '#009BFF' }} />
            <p className="font-semibold text-white">No extended-hours activity yet</p>
            <p className="text-sm text-white mt-1" style={{ opacity: 0.6 }}>
              Check back once {session === 'premarket' ? 'premarket' : 'after-hours'} trading picks up.
            </p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            {/* Column headers */}
            <div
              className="hidden sm:flex items-center gap-3 px-4 py-2"
              style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface-2)' }}
            >
              <div className="text-xs font-semibold" style={{ width: 130, flexShrink: 0, color: 'var(--text-w40)' }}>Ticker</div>
              <div className="text-xs font-semibold" style={{ flex: 1, minWidth: 0, color: 'var(--text-w40)' }}>Company</div>
              <div className="text-xs font-semibold text-right" style={{ width: 100, flexShrink: 0, color: 'var(--text-w40)' }}>Price</div>
              <div className="text-xs font-semibold text-right" style={{ width: 90, flexShrink: 0, color: 'var(--text-w40)' }}>Change</div>
              <div className="text-xs font-semibold text-right" style={{ width: 100, flexShrink: 0, color: 'var(--text-w40)' }}>Volume</div>
            </div>

            {movers.map((m, idx) => {
              const isUp = m.pctChange >= 0
              return (
                <div
                  key={m.symbol}
                  className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-4 py-3"
                  style={{
                    borderBottom: idx < movers.length - 1 ? '1px solid var(--border)' : 'none',
                    backgroundColor: idx % 2 === 0 ? 'var(--surf-w18)' : 'transparent',
                  }}
                >
                  <div className="flex items-center gap-2 sm:block" style={{ width: 130, flexShrink: 0 }}>
                    <span className="font-bold text-white font-data" style={{ fontSize: 16 }}>{m.symbol}</span>
                    <span className="sm:hidden text-xs" style={{ color: 'var(--text-w40)' }}>{m.companyName ?? ''}</span>
                  </div>
                  <div className="hidden sm:block truncate text-sm text-white" style={{ flex: 1, minWidth: 0, opacity: 0.75 }}>
                    {m.companyName ?? '—'}
                  </div>
                  <div className="text-sm font-data text-white sm:text-right" style={{ width: 100, flexShrink: 0 }}>
                    {formatCurrency(m.extendedLastPrice)}
                  </div>
                  <div
                    className="flex items-center gap-1 sm:justify-end font-data font-bold text-sm"
                    style={{ width: 90, flexShrink: 0, color: isUp ? '#4ade80' : '#f87171' }}
                  >
                    {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {isUp ? '+' : ''}{m.pctChange.toFixed(2)}%
                  </div>
                  <div className="text-xs font-data sm:text-right" style={{ width: 100, flexShrink: 0, color: 'var(--text-w40)' }}>
                    {m.extendedVolume > 0 ? m.extendedVolume.toLocaleString('en-US') : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-center mt-6 text-xs" style={{ color: 'var(--text-w30)' }}>
          Sourced from the same screened universe (real market-cap band + liquidity floor) used for daily signal generation.
          Not financial advice.
        </p>
      </div>
    </div>
  )
}
