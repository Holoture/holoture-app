/**
 * GET /api/signals/:id/details
 *
 * Fetches live stock details from Finnhub for a given ticker.
 * The :id param is the ticker symbol (not a DB id).
 *
 * Security:
 * - Auth required (Clerk)
 * - Rate limited: 30 / minute / user (protects Finnhub API quota)
 * - Ticker validated with strict regex before being passed to Finnhub
 *   (prevents SSRF-style injection into the upstream API URL)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { finnhubGet } from '@/lib/finnhub'
import { checkRateLimit, tooManyRequests, DETAILS_LIMIT, DETAILS_WINDOW_MS } from '@/lib/rate-limit'
import { parseBody, tickerParamSchema } from '@/lib/validate'

interface FinnhubProfile {
  name?: string
  exchange?: string
  finnhubIndustry?: string
  marketCapitalization?: number
}

interface FinnhubQuote {
  c?: number
  v?: number
}

interface FinnhubMetric {
  '52WeekHigh'?: number
  '52WeekLow'?: number
  '10DayAverageTradingVolume'?: number
  beta?: number
  peBasicExclExtraTTM?: number
  currentDividendYieldTTM?: number
  dividendYieldIndicatedAnnual?: number
}

interface FinnhubMetrics {
  metric?: FinnhubMetric
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limiting: 30 / minute / user ──────────────────────────────────────
  // Protects Finnhub API quota and prevents scrapers from extracting all data.
  const rl = checkRateLimit(`signal-details:${userId}`, DETAILS_LIMIT, DETAILS_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  // ── Ticker validation ───────────────────────────────────────────────────────
  // Validates format before constructing Finnhub URL to prevent injection.
  const { id } = await params
  const tickerParsed = parseBody(tickerParamSchema, id)
  if (!tickerParsed.ok) {
    return NextResponse.json({ error: 'Invalid ticker symbol' }, { status: 400 })
  }
  const sym = tickerParsed.data

  try {
    const [profile, quote, metrics] = await Promise.all([
      finnhubGet<FinnhubProfile>(`/stock/profile2?symbol=${sym}`, 3600),
      finnhubGet<FinnhubQuote>(`/quote?symbol=${sym}`, 60),
      finnhubGet<FinnhubMetrics>(`/stock/metric?symbol=${sym}&metric=all`, 3600),
    ])

    const m = metrics?.metric ?? {}

    return NextResponse.json({
      companyName:  profile?.name ?? null,
      exchange:     profile?.exchange ?? null,
      industry:     profile?.finnhubIndustry ?? null,
      marketCap:    profile?.marketCapitalization != null ? profile.marketCapitalization * 1_000_000 : null,
      currentPrice: quote?.c ?? null,
      todayVolume:  quote?.v ?? null,
      peRatio:      m.peBasicExclExtraTTM ?? null,
      week52High:   m['52WeekHigh'] ?? null,
      week52Low:    m['52WeekLow'] ?? null,
      avgVolume:    m['10DayAverageTradingVolume'] != null ? m['10DayAverageTradingVolume'] * 1_000_000 : null,
      beta:         m.beta ?? null,
      dividendYield: m.currentDividendYieldTTM ?? m.dividendYieldIndicatedAnnual ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch stock details' }, { status: 500 })
  }
}
