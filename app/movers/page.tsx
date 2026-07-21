import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Header from '@/components/Header'
import { prisma } from '@/lib/prisma'
import MoversTable from '@/components/MoversTable'
import { Sunrise, Moon, AlertTriangle } from 'lucide-react'

/** Independent live/closed state for each extended session — both lists render unconditionally. */
function getSessionWindows(): { premarketLive: boolean; afterhoursLive: boolean } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false,
  }).formatToParts(new Date())
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  const mins = hour * 60 + minute
  if (weekday === 'Sat' || weekday === 'Sun') return { premarketLive: false, afterhoursLive: false }
  return {
    premarketLive: mins >= 4 * 60 && mins < 9 * 60 + 30,
    afterhoursLive: mins >= 16 * 60 && mins < 20 * 60,
  }
}

async function getSnapshot(session: 'premarket' | 'afterhours') {
  const rows = await prisma.moverSnapshot.findMany({ where: { session } })
  const capturedAt = rows.length > 0 ? rows.reduce((max, r) => (r.capturedAt > max ? r.capturedAt : max), rows[0].capturedAt) : null
  return { rows, capturedAt }
}

function SessionSection({
  title,
  icon: Icon,
  isLive,
  capturedAt,
  rows,
}: {
  title: string
  icon: typeof Sunrise
  isLive: boolean
  capturedAt: Date | null
  rows: { ticker: string; companyName: string | null; extendedLastPrice: number; pctChange: number; dollarChange: number }[]
}) {
  const dateLabel = capturedAt
    ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }).format(capturedAt)
    : null

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Icon className="w-5 h-5" style={{ color: '#009BFF' }} />
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {isLive ? (
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
        ) : (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-w50)', border: '1px solid var(--border)' }}
          >
            {dateLabel ? `Last session — ${dateLabel}` : 'Last session'}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl p-8 text-center mt-3" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm text-white" style={{ opacity: 0.6 }}>No data captured yet for this session.</p>
        </div>
      ) : (
        <div className="mt-3">
          <MoversTable rows={rows.map((r) => ({ ticker: r.ticker, companyName: r.companyName, extendedLastPrice: r.extendedLastPrice, pctChange: r.pctChange, dollarChange: r.dollarChange }))} />
        </div>
      )}
    </div>
  )
}

export default async function MoversPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { premarketLive, afterhoursLive } = getSessionWindows()
  const [premarket, afterhours] = await Promise.all([
    getSnapshot('premarket'),
    getSnapshot('afterhours'),
  ])

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-3">
          <h1 className="text-2xl font-black text-white mb-1">Premarket &amp; After-Hours Movers</h1>
          <p className="text-sm text-white" style={{ opacity: 0.6 }}>
            Raw price-movement data — not a trading signal. No BUY/WATCH/SHORT call or confidence score applies to anything shown here.
          </p>
        </div>

        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 mb-8"
          style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#fbbf24' }} />
          <p className="text-xs" style={{ color: '#fbbf24' }}>
            Unfiltered — includes low-liquidity movers. Not a signal. This list is pulled from a much broader ticker
            universe than the vetted signal board and does not apply the liquidity floor used for actual signals.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SessionSection
            title="Premarket Movers"
            icon={Sunrise}
            isLive={premarketLive}
            capturedAt={premarket.capturedAt}
            rows={premarket.rows}
          />
          <SessionSection
            title="After-Hours Movers"
            icon={Moon}
            isLive={afterhoursLive}
            capturedAt={afterhours.capturedAt}
            rows={afterhours.rows}
          />
        </div>

        <p className="text-center mt-6 text-xs" style={{ color: 'var(--text-w30)' }}>
          $ and % change measured against the previous regular-session closing price. Not financial advice.
        </p>
      </div>
    </div>
  )
}
