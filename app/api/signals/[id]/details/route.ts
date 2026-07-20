/**
 * GET /api/signals/:id/details
 *
 * Fetches live stock details from Schwab for a given ticker.
 * The :id param is the ticker symbol (not a DB id).
 *
 * Security:
 * - Auth required (Clerk)
 * - Rate limited: 30 / minute / user (protects Schwab API quota)
 * - Ticker validated with strict regex before being passed to Schwab
 *   (prevents SSRF-style injection into the upstream API URL)
 *
 * Note: Schwab's API has no sector/industry classification field at all
 * (unlike Finnhub's profile2) — `industry` is always null here.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getQuotes, getInstrumentFundamental } from '@/lib/schwab'
import { checkRateLimit, tooManyRequests, DETAILS_LIMIT, DETAILS_WINDOW_MS } from '@/lib/rate-limit'
import { parseBody, tickerParamSchema } from '@/lib/validate'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limiting: 30 / minute / user ──────────────────────────────────────
  // Protects Schwab API quota and prevents scrapers from extracting all data.
  const rl = checkRateLimit(`signal-details:${userId}`, DETAILS_LIMIT, DETAILS_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  // ── Ticker validation ───────────────────────────────────────────────────────
  // Validates format before constructing Schwab URL to prevent injection.
  const { id } = await params
  const tickerParsed = parseBody(tickerParamSchema, id)
  if (!tickerParsed.ok) {
    return NextResponse.json({ error: 'Invalid ticker symbol' }, { status: 400 })
  }
  const sym = tickerParsed.data

  try {
    const [quotes, inst] = await Promise.all([
      getQuotes([sym]),
      getInstrumentFundamental(sym),
    ])
    const quote = quotes.get(sym)

    return NextResponse.json({
      companyName:  inst?.description ?? null,
      exchange:     inst?.exchange ?? null,
      industry:     null, // not available from Schwab's API
      marketCap:    inst?.marketCap ?? null,
      currentPrice: quote?.lastPrice ?? null,
      todayVolume:  quote?.totalVolume ?? null,
      peRatio:      inst?.peRatio ?? null,
      week52High:   quote?.week52High ?? inst?.high52 ?? null,
      week52Low:    quote?.week52Low ?? inst?.low52 ?? null,
      avgVolume:    inst?.avg10DaysVolume ?? null,
      beta:         inst?.beta ?? null,
      dividendYield: inst?.dividendYield ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch stock details' }, { status: 500 })
  }
}
