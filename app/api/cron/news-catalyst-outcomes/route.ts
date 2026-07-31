/**
 * GET /api/cron/news-catalyst-outcomes
 *
 * Sweeps NewsCatalystAlert rows and records price change at fixed intervals
 * after detection (15 min, 1 hr, end of day) — INTERNAL REFERENCE ONLY. Never
 * published as a performance claim, never blended with Signal outcomes or
 * the public track-record stats (lib/publicStats.ts is Signal-only and never
 * imports anything from this feature).
 *
 * Runs every 10 minutes during the trading day (vercel.json). For each alert
 * still missing a checkpoint whose interval has actually elapsed, fetches one
 * quote and records it. "End of day" means the first sweep run at/after 4pm
 * ET on the alert's own detection date.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuotes } from '@/lib/schwab'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

function isPastEtClose(now: Date, detectedAt: Date): boolean {
  const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
  if (dateFmt.format(now) !== dateFmt.format(detectedAt)) return true // rolled into a new day — treat as EOD-closed
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(now)
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  return hour * 60 + minute >= 16 * 60
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const now = new Date()
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60_000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60_000)

    // Pull candidates: anything still missing at least one checkpoint whose
    // window has plausibly opened. Bounded to the last 2 days so this never
    // scans the full historical table.
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60_000)
    const candidates = await prisma.newsCatalystAlert.findMany({
      where: {
        detectedAt: { gte: twoDaysAgo },
        OR: [{ checkedAt15m: null }, { checkedAt1h: null }, { checkedAtEod: null }],
      },
      select: { id: true, ticker: true, detectedAt: true, currentPrice: true, checkedAt15m: true, checkedAt1h: true, checkedAtEod: true },
    })

    if (candidates.length === 0) {
      return NextResponse.json({ ok: true, candidates: 0, checked: 0 })
    }

    const uniqueTickers = [...new Set(candidates.map((c) => c.ticker))]
    const quotes = await getQuotes(uniqueTickers)

    let checked = 0
    for (const c of candidates) {
      const quote = quotes.get(c.ticker)
      if (!quote || quote.lastPrice <= 0) continue
      const pctChange = ((quote.lastPrice - c.currentPrice) / c.currentPrice) * 100

      const data: Record<string, unknown> = {}
      if (!c.checkedAt15m && c.detectedAt <= fifteenMinAgo) {
        data.priceChangeAt15m = pctChange
        data.checkedAt15m = now
      }
      if (!c.checkedAt1h && c.detectedAt <= oneHourAgo) {
        data.priceChangeAt1h = pctChange
        data.checkedAt1h = now
      }
      if (!c.checkedAtEod && isPastEtClose(now, c.detectedAt)) {
        data.priceChangeAtEod = pctChange
        data.checkedAtEod = now
      }

      if (Object.keys(data).length > 0) {
        await prisma.newsCatalystAlert.update({ where: { id: c.id }, data })
        checked++
      }
    }

    return NextResponse.json({ ok: true, candidates: candidates.length, checked })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/news-catalyst-outcomes]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
