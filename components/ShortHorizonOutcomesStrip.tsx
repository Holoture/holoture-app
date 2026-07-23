/**
 * Short-horizon (intraday / days_1_3 / momentum) track record — deliberately
 * separate from OutcomesStrip.tsx (swing/long_term). Never blended: a
 * Phase-1 corrected-data analysis found these two groups perform
 * measurably differently (swing/long_term reliable-sample win rates well
 * above short-horizon's), so averaging them into one figure would misrepresent
 * both. All-time closed-signal counts, computed on outcome data corrected
 * by the Phase 1 SHORT-direction backfill.
 *
 * LEFT_ZONE (Phase 2a) and UNVERIFIABLE (Phase 1b) outcomes are excluded
 * from every count here — neither represents a resolved thesis outcome.
 */
export type ShortHorizonOutcomesSummary = {
  size: number
  winRatePct: number
  expectancyPct: number
  unverifiableCount: number
}

export default function ShortHorizonOutcomesStrip({ summary }: { summary: ShortHorizonOutcomesSummary }) {
  const isNegative = summary.expectancyPct < 0

  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
      <div
        className="rounded-none term-panel px-5 py-4 sm:px-6"
        style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid rgba(249,115,22,0.3)' }}
      >
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <span className="data-label" style={{ color: '#f97316' }}>
            Short-horizon (intraday / 1–3 day / momentum) — {summary.size} closed signals
          </span>
          <span className="inline-flex items-baseline gap-1.5">
            <span className="font-data" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-high)' }}>
              {summary.winRatePct}%
            </span>
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-mute)' }}>win rate</span>
          </span>
          <span className="hidden sm:inline" style={{ color: 'var(--line)' }}>|</span>
          <span className="inline-flex items-baseline gap-1.5">
            <span
              className="font-data"
              style={{ fontSize: 16, fontWeight: 600, color: isNegative ? 'var(--short)' : 'var(--buy)' }}
            >
              {summary.expectancyPct >= 0 ? '+' : ''}{summary.expectancyPct}%
            </span>
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-mute)' }}>expectancy per trade</span>
          </span>
        </div>
        <p className="text-center mt-3 text-xs" style={{ color: 'var(--text-w35)' }}>
          Short-horizon signals carry a materially higher historical failure rate than swing/long-term — size small.
          Past performance does not guarantee future results. Not financial advice.
        </p>
        {summary.unverifiableCount > 0 && (
          <p className="text-center mt-1 text-xs" style={{ color: 'var(--text-w25)' }}>
            {summary.unverifiableCount} additional closed signal{summary.unverifiableCount !== 1 ? 's' : ''} excluded as unverifiable
            (a single stored price check couldn&apos;t confirm a definitive outcome after a scoring-logic correction).
          </p>
        )}
      </div>
    </div>
  )
}
