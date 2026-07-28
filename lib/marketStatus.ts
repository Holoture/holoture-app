// Full market-status computation: OPEN / PREMARKET / AFTER_HOURS / CLOSED,
// aware of US market holidays and early-close half days. Server-side only —
// the client just ticks a countdown from the nextOpenAt timestamp this hands it.

export type MarketState = 'OPEN' | 'PREMARKET' | 'AFTER_HOURS' | 'CLOSED'

export type MarketStatus = {
  state: MarketState
  /** ISO timestamp of the next Regular Trading Hours open. Null when state is OPEN. */
  nextOpenAt: string | null
  /** Name of the holiday closing the market today, if any (state is CLOSED). */
  holidayName: string | null
}

const TIMEZONE = 'America/New_York'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** nth (1-indexed) occurrence of `weekday` (0=Sun..6=Sat) in a given month. */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const firstWeekday = first.getUTCDay()
  const offset = (weekday - firstWeekday + 7) % 7
  return 1 + offset + (n - 1) * 7
}

/** Last occurrence of `weekday` in a given month. */
function lastWeekdayOfMonth(year: number, month: number, weekday: number): number {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const last = new Date(Date.UTC(year, month - 1, lastDay))
  const lastWeekday = last.getUTCDay()
  const offset = (lastWeekday - weekday + 7) % 7
  return lastDay - offset
}

/** Anonymous Gregorian algorithm — returns {month, day} of Easter Sunday. */
function computeEaster(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

/** Shifts a fixed-date holiday observed on a weekend to the nearest weekday (Sat→Fri, Sun→Mon). */
function observed(year: number, month: number, day: number): { month: number; day: number } {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  if (weekday === 6) return { month, day: day - 1 }
  if (weekday === 0) return { month, day: day + 1 }
  return { month, day }
}

type Holiday = { month: number; day: number; name: string }

function holidaysForYear(year: number): Holiday[] {
  const newYears = observed(year, 1, 1)
  const juneteenth = observed(year, 6, 19)
  const independence = observed(year, 7, 4)
  const christmas = observed(year, 12, 25)
  const easter = computeEaster(year)
  const goodFriday = new Date(Date.UTC(year, easter.month - 1, easter.day - 2))

  return [
    { ...newYears, name: "New Year's Day" },
    { month: 1, day: nthWeekdayOfMonth(year, 1, 1, 3), name: 'Martin Luther King Jr. Day' },
    { month: 2, day: nthWeekdayOfMonth(year, 2, 1, 3), name: "Washington's Birthday" },
    { month: goodFriday.getUTCMonth() + 1, day: goodFriday.getUTCDate(), name: 'Good Friday' },
    { month: 5, day: lastWeekdayOfMonth(year, 5, 1), name: 'Memorial Day' },
    { ...juneteenth, name: 'Juneteenth' },
    { ...independence, name: 'Independence Day' },
    { month: 9, day: nthWeekdayOfMonth(year, 9, 1, 1), name: 'Labor Day' },
    { month: 11, day: nthWeekdayOfMonth(year, 11, 4, 4), name: 'Thanksgiving Day' },
    { ...christmas, name: 'Christmas Day' },
  ]
}

function holidayMap(years: number[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const year of years) {
    for (const h of holidaysForYear(year)) {
      map.set(`${year}-${pad(h.month)}-${pad(h.day)}`, h.name)
    }
  }
  return map
}

/** Day-after-Thanksgiving and Christmas Eve close early at 1pm ET. */
function isHalfDay(year: number, month: number, day: number): boolean {
  const thanksgiving = nthWeekdayOfMonth(year, 11, 4, 4)
  if (month === 11 && day === thanksgiving + 1) return true
  if (month === 12 && day === 24) return true
  return false
}

/** UTC offset (minutes, e.g. -240 for EDT) America/New_York observes on a given calendar date. */
function etOffsetMinutes(year: number, month: number, day: number): number {
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, timeZoneName: 'shortOffset' }).formatToParts(probe)
  const tzName = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-5'
  const match = tzName.match(/GMT([+-]\d+)/)
  const hours = match ? parseInt(match[1], 10) : -5
  return hours * 60
}

/** Converts an America/New_York wall-clock time to a UTC Date. */
function etToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const offsetMin = etOffsetMinutes(year, month, day)
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMin * 60_000)
}

function isWeekend(year: number, month: number, day: number): boolean {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return weekday === 0 || weekday === 6
}

function isTradingDay(year: number, month: number, day: number, holidays: Map<string, string>): boolean {
  if (isWeekend(year, month, day)) return false
  return !holidays.has(`${year}-${pad(month)}-${pad(day)}`)
}

/** Adds `days` calendar days to a Y/M/D triple (UTC-safe, no DST math involved). */
function addDays(year: number, month: number, day: number, days: number): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day + days))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

function nextTradingDayOpen(year: number, month: number, day: number, holidays: Map<string, string>): Date {
  let cur = { year, month, day }
  for (let i = 0; i < 14; i++) {
    cur = addDays(cur.year, cur.month, cur.day, 1)
    if (isTradingDay(cur.year, cur.month, cur.day, holidays)) {
      return etToUtc(cur.year, cur.month, cur.day, 9, 30)
    }
  }
  // Unreachable in practice — 14 days always contains a trading day.
  return etToUtc(cur.year, cur.month, cur.day, 9, 30)
}

export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
  }).formatToParts(now)
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10)
  const year = get('year')
  const month = get('month')
  const day = get('day')

  const holidays = holidayMap([year, year + 1])
  const holidayName = holidays.get(`${year}-${pad(month)}-${pad(day)}`) ?? null
  const weekend = isWeekend(year, month, day)

  if (holidayName || weekend) {
    return { state: 'CLOSED', nextOpenAt: nextTradingDayOpen(year, month, day, holidays).toISOString(), holidayName }
  }

  const halfDay = isHalfDay(year, month, day)
  const premarketStart = etToUtc(year, month, day, 4, 0)
  const open = etToUtc(year, month, day, 9, 30)
  const close = etToUtc(year, month, day, halfDay ? 13 : 16, 0)
  const afterHoursEnd = etToUtc(year, month, day, 20, 0)

  if (now < premarketStart) {
    return { state: 'CLOSED', nextOpenAt: open.toISOString(), holidayName: null }
  }
  if (now < open) {
    return { state: 'PREMARKET', nextOpenAt: open.toISOString(), holidayName: null }
  }
  if (now < close) {
    return { state: 'OPEN', nextOpenAt: null, holidayName: null }
  }
  if (now < afterHoursEnd) {
    return { state: 'AFTER_HOURS', nextOpenAt: nextTradingDayOpen(year, month, day, holidays).toISOString(), holidayName: null }
  }
  return { state: 'CLOSED', nextOpenAt: nextTradingDayOpen(year, month, day, holidays).toISOString(), holidayName: null }
}
