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
 * Data-quality gate for the public showcase.
 *
 * cron/signal-outcomes records outcomePrice at the moment it DETECTS the
 * target being crossed, so a genuine winner's exit lands at or just past
 * its target — in live data every legitimate result sat within ~5% of
 * target, and the largest honest overshoot was 1.56x the intended move.
 * A recorded exit far beyond that means the QUOTE is wrong (stale feed,
 * wrong instrument, unadjusted split), not that the move was real.
 *
 * This caught a real one: a GS signal targeting 665 from a 561.50 entry
 * had outcomePrice 1045 recorded — a 4.67x overshoot that would have been
 * published as an "86% gain" on the landing page.
 *
 * 2x is deliberately loose enough to keep every observed legitimate
 * result (max 1.56x) while rejecting that class of artifact. Returns true
 * when the outcome is trustworthy enough to publish.
 */
const MAX_OVERSHOOT_RATIO = 2

export function isPlausibleOutcome(s: {
  signalType: string
  entryZoneLow: number
  entryZoneHigh: number
  targetPrice: number
  outcomePrice: number
}): boolean {
  const realized = realizedGainPercent(s)
  if (realized === null) return false

  const entry = (s.entryZoneLow + s.entryZoneHigh) / 2
  const isShort = s.signalType === 'SHORT' || s.signalType === 'SELL'
  const intended = isShort
    ? ((entry - s.targetPrice) / entry) * 100
    : ((s.targetPrice - entry) / entry) * 100

  // A non-positive intended move means the signal's own target/entry are
  // inconsistent — not publishable regardless of what the exit says.
  if (!Number.isFinite(intended) || intended <= 0) return false

  return realized <= intended * MAX_OVERSHOOT_RATIO
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
