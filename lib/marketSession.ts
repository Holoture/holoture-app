/**
 * Shared market-session detection — single source of truth for
 * premarket/regular/afterhours/closed window logic, previously duplicated
 * across cron/movers-snapshot, cron/zone-check, and app/movers/page.tsx.
 */
export type MarketSession = 'premarket' | 'regular' | 'afterhours' | 'closed'

export function getMarketSession(): MarketSession {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false,
  }).formatToParts(new Date())
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  const mins = hour * 60 + minute

  if (weekday === 'Sat' || weekday === 'Sun') return 'closed'
  if (mins >= 4 * 60 && mins < 9 * 60 + 30) return 'premarket'
  if (mins >= 9 * 60 + 30 && mins < 16 * 60) return 'regular'
  if (mins >= 16 * 60 && mins < 20 * 60) return 'afterhours'
  return 'closed'
}
