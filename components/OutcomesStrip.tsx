/**
 * Outcomes strip — real, unfiltered signal track record near the top of the
 * landing page. Shows wins AND losses from the database; never hides or
 * softens the stop-outs. This is the strongest anti-guru credibility signal
 * available: nobody fabricating results publishes their misses.
 *
 * "Last 20" = the 20 most recently CLOSED signals (by outcomeCheckedAt), not
 * the 20 most recently generated. Every signal in this window already has a
 * resolved outcome, so there's no "still open" bucket — showing one would
 * always read 0 by construction, which is worse than not showing it at all.
 *
 * The "expired" count is intentionally not rendered as its own stat below
 * (hit target / hit stop only), but `expired` is still carried on the type
 * and still included in `window.size` — any win-rate math must divide by
 * the full `size`, never just `hitTarget + hitStop`, or a window with real
 * expired signals would read a falsely inflated rate. See the comment next
 * to `windowWinRatePct` in app/page.tsx for the exact calculation.
 */
export type OutcomesSummary = {
  window: { hitTarget: number; hitStop: number; expired: number; size: number; winRatePct: number }
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

  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
      <div
        className="rounded-none term-panel px-5 py-4 sm:px-6"
        style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--line)' }}
      >
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <span className="data-label" style={{ color: 'var(--text-dim)' }}>
            Recent Signals
          </span>
          <Stat label="hit target" value={summary.window.hitTarget} color="var(--buy)" />
          <Stat label="stopped out" value={summary.window.hitStop} color="var(--short)" />
        </div>
        <p className="text-center mt-3 text-xs" style={{ color: 'var(--text-w35)' }}>
          Past performance does not guarantee future results. Not financial advice.
        </p>
      </div>
    </div>
  )
}
