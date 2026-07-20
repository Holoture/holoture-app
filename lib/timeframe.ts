/**
 * Canonical timeframe categories, assigned server-side at generation time —
 * NOT parsed from the free-text timeHorizon display string at read time.
 *
 * Root cause this replaces: the generation prompt told Claude to emit
 * phrases like "1-3 months", while the old client-side classifier
 * (SignalBoardClient.tsx) extracted the first number in the string and
 * required it to be >=3 for "long term". "1-3 months" extracts 1, fails
 * that check, and matched NONE of isSwingTrade/isLongTerm/isIntraday/
 * is1to3Days — a real signal orphaned from every category tab but "All".
 */

export const TIMEFRAME_CATEGORIES = ['intraday', 'days_1_3', 'swing', 'long_term', 'momentum'] as const
export type TimeframeCategory = typeof TIMEFRAME_CATEGORIES[number]

export function isValidTimeframeCategory(v: unknown): v is TimeframeCategory {
  return typeof v === 'string' && (TIMEFRAME_CATEGORIES as readonly string[]).includes(v)
}

/**
 * Best-effort mapping from a legacy free-text timeHorizon string to a
 * timeframeCategory — used ONLY for the one-time backfill of pre-existing
 * signals. Never assigns 'momentum': that value is reserved exclusively for
 * the real intraday spike scanner (isMomentumSpike) per the product decision
 * to stop mislabeling ordinary high-confidence BUYs as momentum.
 */
export function classifyLegacyTimeHorizon(raw: string): TimeframeCategory | null {
  const h = raw.toLowerCase()
  if (/intraday|hour/.test(h)) return 'intraday'
  if (/1[-–]3\s*day/.test(h)) return 'days_1_3'
  if (h.includes('week')) return 'swing'
  if (h.includes('year')) return 'long_term'
  if (h.includes('month')) {
    const m = h.match(/(\d+)/)
    const n = m ? parseInt(m[1], 10) : null
    // "1-3 months" (n=1, the old orphaning bug) and similar short ranges
    // read closer to swing than a multi-quarter long-term thesis.
    return n !== null && n >= 3 ? 'long_term' : 'swing'
  }
  return null
}
