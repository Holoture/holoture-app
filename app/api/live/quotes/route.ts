/**
 * GET /api/live/quotes?tickers=A,B,C
 *
 * Read-only. Never calls Schwab — reads LiveQuoteCache only, populated
 * exclusively by cron/live-quotes. This is what every client-side poller
 * (dashboard, options page, movers section) hits, so N concurrent viewers
 * cost zero additional Schwab calls.
 */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const tickers = [...new Set(
    (url.searchParams.get('tickers') ?? '').split(',').map((t) => t.trim()).filter(Boolean)
  )]
  if (tickers.length === 0) return NextResponse.json({})

  const rows = await prisma.liveQuoteCache.findMany({ where: { ticker: { in: tickers } } })

  const data: Record<string, {
    price: number; dayChange: number; dayChangePercent: number; volume: number
    session: string; lastUpdated: string
  }> = {}
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
  return NextResponse.json(data)
}
