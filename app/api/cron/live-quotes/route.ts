/**
 * GET /api/cron/live-quotes
 *
 * The ONLY place that calls Schwab for the live-quote-cache feature.
 * Every user-facing surface (dashboard rows, options cards, movers
 * section) reads LiveQuoteCache via the read-only /api/live/quotes route
 * instead — N concurrent viewers never multiply Schwab calls, only this
 * cron's own schedule does.
 *
 * Scheduled (vercel.json) every 1 minute during regular market hours and
 * every 5 minutes during premarket/after-hours — self-checks the session
 * and skips entirely when the market is fully closed.
 *
 * Universe covered: every ticker in TickerUniverse (the screened universe
 * behind daily signal generation) plus every ticker CURRENTLY DISPLAYED on
 * the movers section (i.e. MoverSnapshot rows that clear the same ±4%/-5%
 * threshold the movers page itself applies) — not the full unfiltered
 * movers screening universe, which would be thousands of tickers.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuotes } from '@/lib/schwab'
import { getMarketSession } from '@/lib/marketSession'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// Same threshold the movers page itself uses to decide what's "displayed" —
// kept in sync manually since it's a small, stable constant duplicated in
// app/movers/page.tsx (MIN_GAIN_PCT_CHANGE / MIN_LOSS_PCT_CHANGE).
const MOVERS_MIN_GAIN_PCT = 4
const MOVERS_MIN_LOSS_PCT = -5

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const session = getMarketSession()
    if (session === 'closed') {
      return NextResponse.json({ ok: true, skipped: 'market_closed' })
    }

    const [universeRows, moverRows] = await Promise.all([
      prisma.tickerUniverse.findMany({ select: { ticker: true } }),
      prisma.moverSnapshot.findMany({
        where: { OR: [{ pctChange: { gte: MOVERS_MIN_GAIN_PCT } }, { pctChange: { lte: MOVERS_MIN_LOSS_PCT } }] },
        select: { ticker: true },
      }),
    ])

    const tickers = [...new Set([
      ...universeRows.map((r) => r.ticker),
      ...moverRows.map((r) => r.ticker),
    ])]

    if (tickers.length === 0) {
      return NextResponse.json({ ok: true, session, tickers: 0, cachedRows: 0 })
    }

    const CHUNK = 400
    const chunks: string[][] = []
    for (let i = 0; i < tickers.length; i += CHUNK) chunks.push(tickers.slice(i, i + CHUNK))
    const quoteMaps = await Promise.all(chunks.map((c) => getQuotes(c)))

    const rows: { ticker: string; price: number; dayChange: number; dayChangePercent: number; volume: number; session: string }[] = []
    for (const map of quoteMaps) {
      for (const q of map.values()) {
        if (q.lastPrice <= 0) continue
        rows.push({
          ticker: q.symbol,
          price: q.lastPrice,
          dayChange: q.netChange,
          dayChangePercent: q.netPercentChange,
          volume: q.totalVolume,
          session,
        })
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, session, tickers: tickers.length, cachedRows: 0 })
    }

    // Plain (non-transactional) upserts with bounded concurrency — same
    // pattern as cron/movers-snapshot, needed for the same reason: a
    // single interactive transaction times out well before hundreds of
    // sequential upserts complete, and this is a soft-cache table where
    // atomicity across rows doesn't matter.
    const CONCURRENCY = 20
    let cursor = 0
    async function worker() {
      while (cursor < rows.length) {
        const r = rows[cursor++]
        await prisma.liveQuoteCache.upsert({
          where: { ticker: r.ticker },
          update: r,
          create: r,
        })
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker))

    return NextResponse.json({
      ok: true,
      session,
      universeCount: universeRows.length,
      moverCount: moverRows.length,
      totalTickers: tickers.length,
      cachedRows: rows.length,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/live-quotes]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
