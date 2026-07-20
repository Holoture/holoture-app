/**
 * Holoture health-check engine.
 *
 * Read-and-report layer only — runs a battery of lightweight checks against
 * the database and external APIs, records the result in the HealthCheck
 * table, and posts a summary to the Discord webhook (DISCORD_WEBHOOK_URL).
 *
 * Shared by:
 *   - GET  /api/cron/health-check    (daily cron, CRON_SECRET)
 *   - POST /api/admin/health-check   (manual run from /admin/signals)
 */

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { getQuotes } from '@/lib/schwab'

export type CheckStatus = 'pass' | 'warn' | 'fail'

export interface CheckResult {
  name: string
  status: CheckStatus
  detail: string
}

export interface HealthReport {
  overall: CheckStatus
  results: CheckResult[]
  ranAt: string
  discordPosted: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Start of "today" in America/New_York, as a UTC Date for DB comparison. */
function startOfTodayET(): Date {
  const now = new Date()
  const etParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now) // "YYYY-MM-DD"
  // Midnight ET expressed in UTC: parse the ET date then adjust by the offset.
  const etMidnightAsUtc = new Date(`${etParts}T00:00:00`)
  // Determine the current ET offset in minutes (EST=-300, EDT=-240).
  const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC' })
  const etStr  = now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  const offsetMin = Math.round((new Date(utcStr).getTime() - new Date(etStr).getTime()) / 60000)
  return new Date(etMidnightAsUtc.getTime() + offsetMin * 60000)
}

function isWeekdayET(): boolean {
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short',
  }).format(new Date())
  return day !== 'Sat' && day !== 'Sun'
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

// ── Individual checks ────────────────────────────────────────────────────────

async function checkSignalFreshness(todayStart: Date): Promise<CheckResult> {
  const count = await prisma.signal.count({
    where: { isActive: true, createdAt: { gte: todayStart } },
  })
  if (count === 0) {
    return { name: 'Signal freshness', status: 'fail', detail: 'Zero signals generated today — generation may not have run' }
  }
  if (count < 10) {
    return { name: 'Signal freshness', status: 'fail', detail: `Only ${count} signals generated today, expected 10+` }
  }
  return { name: 'Signal freshness', status: 'pass', detail: `${count} active signals created today` }
}

async function checkSignalDiversity(todayStart: Date): Promise<CheckResult> {
  const signals = await prisma.signal.findMany({
    where: { isActive: true, createdAt: { gte: todayStart } },
    select: { signalCategory: true, signalType: true, timeHorizon: true },
  })
  if (signals.length === 0) {
    return { name: 'Signal diversity', status: 'fail', detail: 'No signals today to evaluate' }
  }

  const byCategory: Record<string, number> = {}
  const byType: Record<string, number> = {}
  for (const s of signals) {
    byCategory[s.signalCategory] = (byCategory[s.signalCategory] ?? 0) + 1
    byType[s.signalType] = (byType[s.signalType] ?? 0) + 1
  }

  const catBreakdown = Object.entries(byCategory).map(([k, v]) => `${k}: ${v}`).join(', ')

  const [domCat, domCount] = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]
  if (signals.length >= 5 && domCount / signals.length > 0.8) {
    return {
      name: 'Signal diversity', status: 'fail',
      detail: `Category "${domCat}" is ${Math.round((domCount / signals.length) * 100)}% of today's signals (${catBreakdown})`,
    }
  }

  if (Object.keys(byType).length === 1 && signals.length >= 5) {
    return {
      name: 'Signal diversity', status: 'fail',
      detail: `All ${signals.length} signals are type ${Object.keys(byType)[0]}`,
    }
  }

  return { name: 'Signal diversity', status: 'pass', detail: catBreakdown }
}

async function checkOptionsSignals(todayStart: Date): Promise<CheckResult> {
  if (!isWeekdayET()) {
    return { name: 'Options signals', status: 'pass', detail: 'Weekend — check skipped' }
  }
  const count = await prisma.optionsSignal.count({
    where: { isActive: true, createdAt: { gte: todayStart } },
  })
  if (count === 0) {
    return { name: 'Options signals', status: 'fail', detail: 'Zero active options signals generated today' }
  }
  return { name: 'Options signals', status: 'pass', detail: `${count} active options signals today` }
}

async function checkPoliticianScanner(): Promise<CheckResult> {
  const latest = await prisma.politicianTrade.findFirst({
    orderBy: { fetchedAt: 'desc' },
    select: { fetchedAt: true },
  })
  if (!latest) {
    return { name: 'Politician scanner', status: 'fail', detail: 'PoliticianTrade table is empty' }
  }
  if (latest.fetchedAt < daysAgo(14)) {
    return { name: 'Politician scanner', status: 'fail', detail: `No new politician trades in 14+ days (last: ${latest.fetchedAt.toISOString().slice(0, 10)})` }
  }
  if (latest.fetchedAt < daysAgo(7)) {
    return { name: 'Politician scanner', status: 'warn', detail: `No new politician trades in 7+ days (last: ${latest.fetchedAt.toISOString().slice(0, 10)})` }
  }
  const weekCount = await prisma.politicianTrade.count({ where: { fetchedAt: { gte: daysAgo(7) } } })
  return { name: 'Politician scanner', status: 'pass', detail: `${weekCount} trades fetched in past 7 days` }
}

async function checkInsiderScanner(): Promise<CheckResult> {
  const latest = await prisma.insiderTrade.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  if (!latest) {
    return { name: 'Insider scanner', status: 'fail', detail: 'InsiderTrade table is empty' }
  }
  if (latest.createdAt < daysAgo(7)) {
    return { name: 'Insider scanner', status: 'fail', detail: `No new insider trades in 7+ days (last: ${latest.createdAt.toISOString().slice(0, 10)})` }
  }
  if (latest.createdAt < daysAgo(3)) {
    return { name: 'Insider scanner', status: 'warn', detail: `No new insider trades in 3+ days (last: ${latest.createdAt.toISOString().slice(0, 10)})` }
  }
  const weekCount = await prisma.insiderTrade.count({ where: { createdAt: { gte: daysAgo(7) } } })
  return { name: 'Insider scanner', status: 'pass', detail: `${weekCount} trades fetched in past 7 days` }
}

async function checkSchwab(): Promise<CheckResult> {
  if (!process.env.SCHWAB_APP_KEY || !process.env.SCHWAB_APP_SECRET || !process.env.SCHWAB_REFRESH_TOKEN) {
    return { name: 'Schwab API', status: 'fail', detail: 'SCHWAB_APP_KEY/APP_SECRET/REFRESH_TOKEN not set' }
  }
  const t0 = Date.now()
  try {
    const quotes = await getQuotes(['AAPL'])
    const ms = Date.now() - t0
    const q = quotes.get('AAPL')
    if (!q || q.lastPrice <= 0) {
      // Schwab's refresh token expires 7 days after issuance and can't be
      // renewed automatically — this is the most likely real-world cause of
      // a failure here. See scripts/schwab-reauth.md.
      return { name: 'Schwab API', status: 'fail', detail: `Empty/invalid quote response (${ms}ms) — check whether SCHWAB_REFRESH_TOKEN has expired (7-day lifetime, see scripts/schwab-reauth.md)` }
    }
    return { name: 'Schwab API', status: 'pass', detail: `AAPL quote OK in ${ms}ms` }
  } catch (e) {
    return { name: 'Schwab API', status: 'fail', detail: `Request failed: ${e instanceof Error ? e.message : 'unknown'}` }
  }
}

async function checkAnthropic(): Promise<CheckResult> {
  const t0 = Date.now()
  try {
    const client = new Anthropic()
    await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    })
    return { name: 'Anthropic API', status: 'pass', detail: `Responded in ${Date.now() - t0}ms` }
  } catch (e) {
    return { name: 'Anthropic API', status: 'fail', detail: `Request failed: ${e instanceof Error ? e.message : 'unknown'}` }
  }
}

async function checkStripeWebhooks(): Promise<CheckResult> {
  // Skip until there are paying users — no webhooks expected before then.
  const payingUsers = await prisma.user.count({ where: { tier: { not: 'free' } } })
  if (payingUsers < 3) {
    return { name: 'Stripe webhooks', status: 'pass', detail: `Skipped (${payingUsers} paying users)` }
  }
  const latest = await prisma.webhookLog.findFirst({
    where: { source: 'stripe' },
    orderBy: { receivedAt: 'desc' },
    select: { receivedAt: true, eventType: true },
  })
  if (!latest || latest.receivedAt < daysAgo(7)) {
    return {
      name: 'Stripe webhooks', status: 'warn',
      detail: latest
        ? `No webhook events in 7+ days (last: ${latest.eventType} at ${latest.receivedAt.toISOString().slice(0, 10)})`
        : 'No webhook events ever logged',
    }
  }
  return { name: 'Stripe webhooks', status: 'pass', detail: `Last event: ${latest.eventType}` }
}

// ── Discord ──────────────────────────────────────────────────────────────────

async function postToDiscord(overall: CheckStatus, results: CheckResult[]): Promise<boolean> {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) return false

  const fails = results.filter((r) => r.status === 'fail')
  const warns = results.filter((r) => r.status === 'warn')
  const passes = results.filter((r) => r.status === 'pass')

  let content: string
  if (overall === 'pass') {
    const summary = passes.map((r) => `${r.name}: ${r.detail}`).join('\n')
    content = `✅ **Holoture Health Check — All systems green**\n${summary}`
  } else {
    const lines: string[] = []
    lines.push(`🚨 **HOLOTURE ALERT — ${fails.length} check${fails.length !== 1 ? 's' : ''} failed** @everyone`)
    for (const f of fails) lines.push(`❌ **${f.name}**: ${f.detail}`)
    for (const w of warns) lines.push(`⚠️ **${w.name}**: ${w.detail}`)
    if (passes.length > 0) lines.push(`Passing: ${passes.map((r) => r.name).join(' · ')}`)
    content = lines.join('\n')
    if (overall === 'warn' && fails.length === 0) {
      // Warnings only — no @everyone ping.
      content = content.replace(' @everyone', '').replace('🚨 **HOLOTURE ALERT — 0 checks failed**', '⚠️ **Holoture Health Check — warnings**')
    }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.slice(0, 1900) }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

// ── Runner ───────────────────────────────────────────────────────────────────

export async function runHealthCheck(): Promise<HealthReport> {
  const todayStart = startOfTodayET()
  const results: CheckResult[] = []
  let dbError: string | null = null

  // DB-backed checks — run sequentially so a connection failure is caught once.
  const dbChecks: Array<() => Promise<CheckResult>> = [
    () => checkSignalFreshness(todayStart),
    () => checkSignalDiversity(todayStart),
    () => checkOptionsSignals(todayStart),
    checkPoliticianScanner,
    checkInsiderScanner,
    checkStripeWebhooks,
  ]

  for (const check of dbChecks) {
    try {
      results.push(await check())
    } catch (e) {
      dbError = e instanceof Error ? e.message : 'unknown DB error'
      results.push({ name: 'Database query', status: 'fail', detail: dbError })
      break // connection is broken — don't hammer it with more queries
    }
  }

  // External API checks run in parallel — independent of the DB.
  const [schwab, anthropic] = await Promise.all([checkSchwab(), checkAnthropic()])
  results.push(schwab, anthropic)

  // Explicit DB health line.
  results.push(
    dbError
      ? { name: 'Database health', status: 'fail', detail: `Connection error: ${dbError}` }
      : { name: 'Database health', status: 'pass', detail: 'All queries completed' }
  )

  const overall: CheckStatus = results.some((r) => r.status === 'fail')
    ? 'fail'
    : results.some((r) => r.status === 'warn')
    ? 'warn'
    : 'pass'

  const discordPosted = await postToDiscord(overall, results)

  // Persist history (best-effort — never let logging break the check).
  try {
    await prisma.healthCheck.create({
      data: { status: overall, results: JSON.stringify(results) },
    })
  } catch { /* table may not exist yet on first deploy */ }

  return { overall, results, ranAt: new Date().toISOString(), discordPosted }
}
