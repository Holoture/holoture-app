/**
 * Shared "what day is it in America/New_York" helpers — dependency-free
 * (no prisma import) so this is safe to use from client components too,
 * unlike lib/scheduledSignals.ts's private equivalents which pull in
 * server-only imports.
 *
 * DST-safe by construction: Intl.DateTimeFormat with an explicit IANA zone
 * resolves EST/EDT automatically from the date given, unlike a fixed UTC
 * offset (which is exactly what caused the DST-safe extended-hours cron
 * work earlier this project) or plain `new Date()` formatting, which uses
 * the server's (or browser's) local zone — Vercel serverless functions run
 * in UTC, so any unqualified `new Date()` display or day-boundary filter
 * rolls over 4-5 hours before the real Eastern midnight.
 */

const TIMEZONE = 'America/New_York'

/** 'YYYY-MM-DD' for the given instant, in America/New_York. Safe as a sortable/comparable day-boundary key. */
export function etDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(now)
}

/** Long display label, e.g. "Monday, August 3, 2026", computed in America/New_York — not server/browser local time. */
export function etDateLabel(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(now)
}

/** Current hour:minute in America/New_York. */
export function etHourMinute(now: Date = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(now)
  return {
    hour: parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10),
    minute: parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10),
  }
}

/** Start-of-week (Sunday) and end-of-week boundaries, both midnight America/New_York, for a given instant. */
export function etWeekBounds(now: Date = new Date()): { weekStart: Date; weekEnd: Date } {
  const todayStr = etDateString(now)
  // en-US weekday index (0=Sun) computed in ET, independent of server locale/zone.
  const weekdayName = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'short' }).format(now)
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayName)
  const [y, m, d] = todayStr.split('-').map(Number)
  // Noon UTC anchor avoids DST-edge date-arithmetic surprises, then re-stringify via etDateString for each boundary.
  const anchor = new Date(Date.UTC(y, m - 1, d, 12))
  const weekStartAnchor = new Date(anchor.getTime() - weekdayIndex * 86400000)
  const weekEndAnchor = new Date(weekStartAnchor.getTime() + 7 * 86400000)
  const weekStart = new Date(`${etDateString(weekStartAnchor)}T00:00:00`)
  const weekEnd = new Date(`${etDateString(weekEndAnchor)}T00:00:00`)
  return { weekStart, weekEnd }
}
