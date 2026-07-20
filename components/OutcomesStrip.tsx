/**
 * Outcomes strip — real, unfiltered signal track record near the top of the
 * landing page. Shows wins AND losses from the database; never hides or
 * softens the stop-outs. This is the strongest anti-guru credibility signal
 * available: nobody fabricating results publishes their misses.
 *
 * "Last 30" = the 30 most recently CLOSED signals (by outcomeCheckedAt), not
 * the 30 most recently generated. Every signal in this window already has a
 * resolved outcome, so there's no "still open" bucket — showing one would
 * always read 0 by construction, which is worse than not showing it at all.
 *
 * No win-rate percentage is computed or displayed here — a bare percentage
 * without its sample size is exactly the kind of soft-sell stat this strip
 * exists to avoid.
 */
export type OutcomesSummary = {
  window: { hitTarget: number; hitStop: number; expired: number; size: number }
  allTime: { hitTarget: number; hitStop: number; expired: number }
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-data" style={{ fontSize: 16, fontWeight: 600, color }}>{value}</span>
      <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-mute)' }}>{label}</span>
    </span>
  )
}

export default function OutcomesStrip({ summary }: { summary: OutcomesSummary }) {
  if (summary.window.size === 0) return null

  const allTimeTotal = summary.allTime.hitTarget + summary.allTime.hitStop + summary.allTime.expired

  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
      <div
        className="rounded-none term-panel px-5 py-4 sm:px-6"
        style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--line)' }}
      >
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <span className="data-label" style={{ color: 'var(--text-dim)' }}>
            Last {summary.window.size} signals
          </span>
          <Stat label="hit target" value={summary.window.hitTarget} color="var(--buy)" />
          <Stat label="stopped out" value={summary.window.hitStop} color="var(--short)" />
          <Stat label="expired" value={summary.window.expired} color="var(--text-mute)" />
          <span className="hidden sm:inline" style={{ color: 'var(--line)' }}>|</span>
          <span className="font-data text-xs" style={{ color: 'var(--text-dim)' }}>
            all-time: {summary.allTime.hitTarget} / {summary.allTime.hitStop} / {summary.allTime.expired}
            {' '}({allTimeTotal} closed)
          </span>
        </div>
        <p className="text-center mt-3 text-xs" style={{ color: 'var(--text-w35)' }}>
          Past performance does not guarantee future results. Not financial advice.
        </p>
      </div>
    </div>
  )
}
