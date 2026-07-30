/**
 * Shared math for the landing page's "best result" showcase — used by both
 * the selection cron and the landing-page read path, so the number the cron
 * ranks on and the number the card displays can never diverge.
 *
 * GAIN BASIS: entry price at the time the signal was posted -> the highest
 * price the stock reached afterward (lowest, for a SHORT/SELL, since decline
 * is the favorable direction for those). This is deliberately NOT the
 * signal's actual realized exit price — it measures the best price the
 * stock touched after posting, which is a different and more favorable
 * number than what the signal actually captured at target. That tradeoff
 * was surfaced and confirmed explicitly before this was built.
 */

export type PriceCandle = { high: number; low: number; datetime: number }

// A wide sanity ceiling, NOT a "vs. target" plausibility check like the
// realized-exit-price version of this feature used. Under this gain basis,
// a huge move IS exactly what's being looked for, so a large number alone
// is no longer evidence of bad data. This only exists to reject genuinely
// corrupt candle data (a bad print, an unadjusted stock split inflating a
// historical "high" 10x) rather than a real outsized winner.
const MAX_SANE_GAIN_PCT = 500

/**
 * Direction-aware % gain from `entryPrice` to the best price reached across
 * `candlesSincePosting` (highest high for BUY/WATCH, lowest low for
 * SHORT/SELL). Returns null when there's no usable entry price, no candle
 * data, or the result fails the sanity ceiling.
 */
export function peakGainPercent(s: {
  signalType: string
  entryPrice: number
  candlesSincePosting: PriceCandle[]
}): number | null {
  if (!Number.isFinite(s.entryPrice) || s.entryPrice <= 0) return null
  if (s.candlesSincePosting.length === 0) return null

  const isShort = s.signalType === 'SHORT' || s.signalType === 'SELL'
  let extreme: number | null = null
  for (const c of s.candlesSincePosting) {
    const v = isShort ? c.low : c.high
    if (!Number.isFinite(v) || v <= 0) continue
    extreme = extreme === null ? v : isShort ? Math.min(extreme, v) : Math.max(extreme, v)
  }
  if (extreme === null) return null

  const raw = isShort
    ? ((s.entryPrice - extreme) / s.entryPrice) * 100
    : ((extreme - s.entryPrice) / s.entryPrice) * 100

  if (!Number.isFinite(raw)) return null
  if (raw > MAX_SANE_GAIN_PCT) return null

  return raw
}

/**
 * Monday 00:00 ET of the week containing `date`, returned as a UTC Date.
 * Used as the stable weekly key so a mid-week cron re-run overwrites the
 * same row instead of creating a second entry for the same week.
 */
export function weekStartET(date: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const y = parseInt(get('year'), 10)
  const m = parseInt(get('month'), 10)
  const d = parseInt(get('day'), 10)
  const weekday = get('weekday') // Mon, Tue, ...

  const DAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  const offset = DAY_INDEX[weekday] ?? 0

  return new Date(Date.UTC(y, m - 1, d - offset))
}
