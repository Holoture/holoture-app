/**
 * Outcomes strip — real, unfiltered signal track record near the top of the
 * landing page. Shows wins AND losses from the database; never hides or
 * softens the stop-outs. This is the strongest anti-guru credibility signal
 * available: nobody fabricating results publishes their misses.
 *
 * "Last 30 signals" = the 30 most recently GENERATED signals (not the 30
 * most recently resolved), so "still open" can be nonzero — an honest
 * snapshot of where a fresh batch of signals currently stands.
 *
 * Shows 4 buckets, not the minimal 3 (hit target / stopped out / open):
 * EXPIRED (timed out without hitting target or stop) is a real, distinct
 * outcome in the data and folding it into either bucket would misrepresent
 * it. Showing it separately is more transparent, not less.
 */
export type OutcomesSummary = {
  hitTarget: number
  hitStop: number
  expired: number
  open: number
  windowSize: number
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-data" style={{ fontSize: 15, fontWeight: 600, color }}>{value}</span>
      <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-mute)' }}>{label}</span>
    </span>
  )
}

export default function OutcomesStrip({ summary }: { summary: OutcomesSummary }) {
  if (summary.windowSize === 0) return null

  return (
    <div className="relative z-10" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', backgroundColor: 'var(--bg-raised)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <span className="data-label" style={{ color: 'var(--text-dim)' }}>
            Last {summary.windowSize} signals
          </span>
          <Stat label="hit target" value={summary.hitTarget} color="var(--buy)" />
          <Stat label="stopped out" value={summary.hitStop} color="var(--short)" />
          <Stat label="expired" value={summary.expired} color="var(--text-dim)" />
          <Stat label="still open" value={summary.open} color="var(--text-mute)" />
        </div>
      </div>
    </div>
  )
}
