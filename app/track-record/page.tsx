import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import { prisma } from '@/lib/prisma'
import { PUBLIC_TRACK_RECORD_FILTER } from '@/lib/publicStats'
import { ClipboardCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Track Record & Methodology - Holoture',
  description: 'How Holoture measures and reports its stock signal win rate — what counts as a win or loss, why manual signals are excluded, and the honest sample-size caveats behind the published numbers.',
  openGraph: {
    title: 'Track Record & Methodology - Holoture',
    description: 'How Holoture measures and reports its stock signal win rate — what counts as a win or loss, why manual signals are excluded, and the honest sample-size caveats behind the published numbers.',
  },
  twitter: {
    title: 'Track Record & Methodology - Holoture',
    description: 'How Holoture measures and reports its stock signal win rate — what counts as a win or loss, why manual signals are excluded, and the honest sample-size caveats behind the published numbers.',
  },
}

const SWING_LONG_TERM_CATEGORIES = ['swing', 'long_term']
const MIN_SAMPLE = 25

async function getAllTimeStats() {
  try {
    const catFilter = { timeframeCategory: { in: SWING_LONG_TERM_CATEGORIES }, ...PUBLIC_TRACK_RECORD_FILTER }
    const [hitTarget, hitStop, expired] = await Promise.all([
      prisma.signal.count({ where: { outcome: 'HIT_TARGET', ...catFilter } }),
      prisma.signal.count({ where: { outcome: 'HIT_STOP', ...catFilter } }),
      prisma.signal.count({ where: { outcome: 'EXPIRED', ...catFilter } }),
    ])
    const closedTotal = hitTarget + hitStop + expired
    const winRatePct = closedTotal > 0 ? Math.round((hitTarget / closedTotal) * 1000) / 10 : null
    return { hitTarget, hitStop, expired, closedTotal, winRatePct, hasEnoughSample: closedTotal >= MIN_SAMPLE }
  } catch {
    return null
  }
}

export default async function TrackRecordPage() {
  const stats = await getAllTimeStats()

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-3 mb-2">
          <ClipboardCheck className="w-6 h-6" style={{ color: '#009BFF' }} />
          <h1 className="text-2xl sm:text-3xl font-black text-white">Track Record &amp; Methodology</h1>
        </div>
        <p className="text-sm mb-8" style={{ color: 'var(--text-w50)' }}>
          What the numbers on the homepage&apos;s outcomes strip actually mean, and how they&apos;re calculated.
        </p>

        {stats && (
          <div className="rounded-xl p-6 mb-8" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-w40)' }}>
              All-time — swing &amp; long-term signals only
            </p>
            {stats.hasEnoughSample ? (
              <>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-2xl font-black" style={{ color: '#4ade80' }}>{stats.hitTarget}</p>
                    <p className="text-xs" style={{ color: 'var(--text-w40)' }}>Hit target</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black" style={{ color: '#f87171' }}>{stats.hitStop}</p>
                    <p className="text-xs" style={{ color: 'var(--text-w40)' }}>Hit stop</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-white">{stats.expired}</p>
                    <p className="text-xs" style={{ color: 'var(--text-w40)' }}>Expired</p>
                  </div>
                </div>
                <p className="text-sm text-white">
                  Win rate: <strong>{stats.winRatePct}%</strong> ({stats.hitTarget} of {stats.closedTotal} closed signals)
                </p>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-w60)' }}>
                Fewer than {MIN_SAMPLE} closed signals exist in this category so far ({stats.closedTotal} closed) — not
                enough to report a win rate without it being misleading. This is the same {MIN_SAMPLE}-signal floor
                the homepage&apos;s outcomes strip uses before it will show a number at all.
              </p>
            )}
          </div>
        )}

        <div className="space-y-6" style={{ color: 'var(--text-w75)', fontSize: 15, lineHeight: 1.7 }}>
          <section>
            <h2 className="text-lg font-bold text-white mb-2">What counts as a win, a loss, or excluded entirely</h2>
            <ul className="mt-1 space-y-2 list-none">
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#4ade80' }} />
                <span><strong className="text-white">Hit target</strong> — price reached the signal&apos;s stated target before hitting its stop-loss or expiring. Counted as a win.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#f87171' }} />
                <span><strong className="text-white">Hit stop</strong> — price reached the signal&apos;s stated stop-loss first. Counted as a loss.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--text-w40)' }} />
                <span><strong className="text-white">Expired</strong> — the signal&apos;s time horizon passed without hitting either target or stop. Not a win, but included in the denominator so a pile of expired signals can&apos;t be hidden to inflate the rate.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--text-w40)' }} />
                <span><strong className="text-white">Left zone / unverifiable</strong> — the signal never validly entered its stated entry zone, or its outcome couldn&apos;t be confirmed against real market data. Excluded entirely — neither represents a resolved thesis.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">Manual signals are excluded, always</h2>
            <p>
              Any signal created or edited by hand in Holoture&apos;s admin panel is flagged internally and
              excluded from every public statistic, including this page and the homepage&apos;s outcomes strip.
              A hand-picked or hand-edited signal is not algorithm output, and counting one toward the published
              win rate would misrepresent what the track record is meant to prove. Manual-signal outcomes are
              still tracked — just separately, and never published.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">Why only swing and long-term signals are counted here</h2>
            <p>
              The published win rate covers swing and long-term timeframe signals specifically, not every
              signal type Holoture generates. Intraday, momentum, and premarket/after-hours signals are
              fundamentally different risk profiles — shorter holding periods, tighter stops, and (for
              momentum specifically) a much higher expected failure rate by design, since they&apos;re chasing
              a move already in progress. Blending those into one number with swing/long-term signals would
              misrepresent both.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">The 25-signal floor</h2>
            <p>
              If fewer than {MIN_SAMPLE} signals in this category have closed, no win rate is shown at all —
              on this page or the homepage. A win rate built from a handful of trades is not a meaningful
              statistic, and showing one anyway would create false confidence. An honest empty state is better
              than a misleading number.
            </p>
          </section>
        </div>

        <p className="text-xs mt-10 pt-6" style={{ color: 'var(--text-w25)', borderTop: '1px solid var(--border)' }}>
          Past performance does not guarantee future results. Not financial advice.{' '}
          <Link href="/learn" className="underline" style={{ color: '#009BFF' }}>Learn more about how signals work</Link>.
        </p>
      </div>
    </div>
  )
}
