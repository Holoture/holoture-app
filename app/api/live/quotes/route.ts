/**
 * GET /api/live/quotes?tickers=A,B,C
 *
 * Reads LiveQuoteCache first — populated on the routine 1-5min schedule by
 * cron/live-quotes, the only *routine* Schwab caller. For any requested
 * ticker missing from the cache (new signal not yet swept by the poller,
 * momentary sync gap, etc.) this falls back to a single on-demand batched
 * Schwab call for just the missing tickers, upserts the result into the
 * cache immediately, and returns it — so the UI never shows a blank price,
 * and the next request for that ticker hits the cache again. Frequent
 * fallback firing means the poller's ticker list is drifting out of sync
 * with what's actually on the board — logged below so that's visible in
 * Vercel function logs (grep "[live/quotes] cache-miss fallback").
 */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { getQuotes } from '@/lib/schwab'
import { getMarketSession } from '@/lib/marketSession'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type QuoteOut = {
  price: number; dayChange: number; dayChangePercent: number; volume: number
  session: string; lastUpdated: string
}

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const tickers = [...new Set(
    (url.searchParams.get('tickers') ?? '').split(',').map((t) => t.trim()).filter(Boolean)
  )]
  if (tickers.length === 0) return NextResponse.json({})

  const rows = await prisma.liveQuoteCache.findMany({ where: { ticker: { in: tickers } } })
  const found = new Set(rows.map((r) => r.ticker))
  const missing = tickers.filter((t) => !found.has(t))

  const data: Record<string, QuoteOut> = {}
  for (const r of rows) {
    data[r.ticker] = {
      price: r.price,
      dayChange: r.dayChange,
      dayChangePercent: r.dayChangePercent,
      volume: r.volume,
      session: r.session,
      lastUpdated: r.lastUpdated.toISOString(),
    }
  }

  if (missing.length > 0) {
    console.log(`[live/quotes] cache-miss fallback for ${missing.length} ticker(s): ${missing.join(',')}`)
    try {
      const session = getMarketSession()
      const quoteMap = await getQuotes(missing)
      const toUpsert = [...quoteMap.values()]
        .filter((q) => q.lastPrice > 0)
        .map((q) => ({
          ticker: q.symbol,
          price: q.lastPrice,
          dayChange: q.netChange,
          dayChangePercent: q.netPercentChange,
          volume: q.totalVolume,
          session,
        }))

      const CONCURRENCY = 10
      let cursor = 0
      async function worker() {
        while (cursor < toUpsert.length) {
          const r = toUpsert[cursor++]
          const saved = await prisma.liveQuoteCache.upsert({
            where: { ticker: r.ticker },
            update: r,
            create: r,
          })
          data[saved.ticker] = {
            price: saved.price,
            dayChange: saved.dayChange,
            dayChangePercent: saved.dayChangePercent,
            volume: saved.volume,
            session: saved.session,
            lastUpdated: saved.lastUpdated.toISOString(),
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, toUpsert.length) }, worker))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[live/quotes] fallback fetch failed', msg)
    }
  }

  return NextResponse.json(data)
}
