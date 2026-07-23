/**
 * GET /api/signals/live-prices?tickers=A,B,C
 *
 * Batched current-price lookup for short-horizon signal rows (Phase 2b).
 * Never called per-row — the client collects every visible intraday/
 * days_1_3 ticker once and requests them together.
 *
 * A short in-memory cache (30s TTL, matching the intended client poll
 * interval) means concurrent viewers share one upstream Schwab call
 * instead of multiplying it — N users looking at the same signal set
 * within the same 30s window costs exactly one batch quote call, not N.
 * Cache is per warm serverless instance, same tradeoff already accepted
 * by lib/rate-limit.ts elsewhere in this codebase.
 */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getQuotes } from '@/lib/schwab'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 30_000
let cache: { key: string; data: Record<string, number>; expiresAt: number } | null = null

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const tickers = [...new Set(
    (url.searchParams.get('tickers') ?? '').split(',').map((t) => t.trim()).filter(Boolean)
  )].sort()
  if (tickers.length === 0) return NextResponse.json({})

  const key = tickers.join(',')
  if (cache && cache.key === key && cache.expiresAt > Date.now()) {
    return NextResponse.json(cache.data)
  }

  const quotes = await getQuotes(tickers)
  const data: Record<string, number> = {}
  for (const t of tickers) {
    const q = quotes.get(t)
    if (q && q.lastPrice > 0) data[t] = q.lastPrice
  }
  cache = { key, data, expiresAt: Date.now() + CACHE_TTL_MS }
  return NextResponse.json(data)
}
