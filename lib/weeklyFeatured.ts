/**
 * Shared math for the weekly "best performing signal" showcase — used by
 * both the selection cron and the landing-page read path, so the number the
 * cron ranks on and the number the card displays can never diverge.
 */

/**
 * Realized % gain from the entry-zone midpoint to the ACTUAL outcome price.
 *
 * Direction-aware, matching evaluateDirectionalOutcome() in
 * cron/signal-outcomes: SHORT/SELL win on a DECLINE, so their gain is
 * (entry - exit) / entry. BUY and WATCH share the bullish orientation
 * (target above entry) and use (exit - entry) / entry.
 *
 * Deliberately computed from outcomePrice, not targetPrice — targetPrice is
 * what the signal aimed at, outcomePrice is what actually happened, and a
 * published performance number must reflect the latter. Returns null when
 * the entry midpoint is non-positive (unusable denominator).
 */
export function realizedGainPercent(s: {
  signalType: string
  entryZoneLow: number
  entryZoneHigh: number
  outcomePrice: number
}): number | null {
  const entry = (s.entryZoneLow + s.entryZoneHigh) / 2
  if (!Number.isFinite(entry) || entry <= 0) return null
  if (!Number.isFinite(s.outcomePrice) || s.outcomePrice <= 0) return null

  const isShort = s.signalType === 'SHORT' || s.signalType === 'SELL'
  const raw = isShort
    ? ((entry - s.outcomePrice) / entry) * 100
    : ((s.outcomePrice - entry) / entry) * 100

  return Number.isFinite(raw) ? raw : null
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
