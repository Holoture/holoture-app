import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

export type WeeklyFeatured = {
  ticker: string
  companyName: string
  signalType: string
  entryZoneLow: number
  entryZoneHigh: number
  targetPrice: number
  realizedGainPercent: number
  thesis: string
  /** ISO — when the signal was posted. */
  openedAt: string
  /** ISO — when the outcome checker recorded HIT_TARGET. */
  closedAt: string
  weekStartDate: string
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric',
  }).format(new Date(iso))
}

/** First two sentences of the thesis, so free users see reasoning quality without the full paywalled write-up. */
function condense(thesis: string, maxLen = 240): string {
  const clean = thesis.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxLen) return clean
  const cut = clean.slice(0, maxLen)
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
  return lastStop > 80 ? cut.slice(0, lastStop + 1) : `${cut.trimEnd()}…`
}

/**
 * The landing page's weekly showcase. This is a PAST RESULT, and the whole
 * design job here is making that impossible to misread as a live pick:
 * a CLOSED tag, a muted/dashed border instead of the active-signal
 * treatment, an explicit "this signal has closed" line, no live price
 * anywhere, and a link out to the full win/loss record so a single winner
 * is never presented in isolation.
 */
export default function WeeklyFeaturedCard({ featured }: { featured: WeeklyFeatured | null }) {
  const isShort = featured?.signalType === 'SHORT' || featured?.signalType === 'SELL'

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <p className="eyebrow" style={{ color: 'var(--text-dim)' }}>
          {featured
            ? `Best performing signal — week of ${fmtDate(featured.weekStartDate)}`
            : 'Best performing signal'}
        </p>
        <span
          className="data-label"
          style={{
            fontSize: 10, color: 'var(--text-mute)',
            border: '1px solid var(--line)', padding: '1px 6px',
          }}
        >
          CLOSED
        </span>
      </div>

      {featured ? (
        <div
          className="p-6"
          style={{
            backgroundColor: 'var(--bg-raised)',
            // Dashed + neutral, deliberately NOT the solid accent border or
            // corner ticks the live SignalCard uses — a past result should
            // not carry the same visual weight as an actionable one.
            border: '1px dashed var(--line)',
          }}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-data" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-high)' }}>
                  {featured.ticker}
                </span>
                <span
                  className="data-label"
                  style={{
                    fontSize: 10,
                    color: isShort ? 'var(--short)' : 'var(--buy)',
                    border: `1px solid ${isShort ? 'var(--short)' : 'var(--buy)'}`,
                    padding: '1px 6px',
                  }}
                >
                  {featured.signalType}
                </span>
              </div>
              <p className="truncate mt-0.5" style={{ fontSize: 13, color: 'var(--text-mute)' }}>
                {featured.companyName}
              </p>
            </div>

            <div className="text-right shrink-0">
              <p className="font-data" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, color: 'var(--buy)' }}>
                +{featured.realizedGainPercent.toFixed(1)}%
              </p>
              <p className="data-label mt-1" style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                REALIZED
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-4">
            <Row label="Entry zone" value={`${formatCurrency(featured.entryZoneLow)} – ${formatCurrency(featured.entryZoneHigh)}`} />
            <Row label="Target" value={formatCurrency(featured.targetPrice)} />
            <Row label="Played out" value={`${fmtDate(featured.openedAt)} → ${fmtDate(featured.closedAt)}`} />
          </div>

          <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-body)' }}>
            {condense(featured.thesis)}
          </p>

          <p className="mt-4 pt-3" style={{ fontSize: 12, color: 'var(--text-mute)', borderTop: '1px solid var(--line-faint)' }}>
            This signal has closed. Past result shown for illustration.
          </p>

          <p className="mt-2" style={{ fontSize: 12, color: 'var(--text-mute)' }}>
            Not every signal wins.{' '}
            <Link href="#track-record" className="underline hover:opacity-80 transition-opacity" style={{ color: '#009BFF' }}>
              See our full track record
            </Link>
          </p>
        </div>
      ) : (
        <div
          className="p-8 text-center"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px dashed var(--line)' }}
        >
          <p style={{ color: 'var(--text-body)', fontSize: 14 }}>
            No signals closed at target this week.
          </p>
          <p className="mt-2" style={{ color: 'var(--text-mute)', fontSize: 12 }}>
            Nothing is shown rather than featuring a weaker result.{' '}
            <Link href="#track-record" className="underline hover:opacity-80 transition-opacity" style={{ color: '#009BFF' }}>
              See our full track record
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="data-label" style={{ fontSize: 10, color: 'var(--text-dim)' }}>{label}</p>
      <p className="font-data mt-0.5" style={{ fontSize: 13, color: 'var(--text-body)' }}>{value}</p>
    </div>
  )
}
