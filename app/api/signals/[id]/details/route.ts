import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { finnhubGet } from '@/lib/finnhub'

interface FinnhubProfile {
  name?: string
  exchange?: string
  finnhubIndustry?: string
  marketCapitalization?: number // in millions USD
}

interface FinnhubQuote {
  c?: number // current price
  v?: number // current day volume (raw shares)
}

interface FinnhubMetric {
  '52WeekHigh'?: number
  '52WeekLow'?: number
  '10DayAverageTradingVolume'?: number // in millions of shares
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
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const sym = id.toUpperCase()

  const [profile, quote, metrics] = await Promise.all([
    finnhubGet<FinnhubProfile>(`/stock/profile2?symbol=${sym}`, 3600),
    finnhubGet<FinnhubQuote>(`/quote?symbol=${sym}`, 60),
    finnhubGet<FinnhubMetrics>(`/stock/metric?symbol=${sym}&metric=all`, 3600),
  ])

  const m = metrics?.metric ?? {}

  return NextResponse.json({
    companyName: profile?.name ?? null,
    exchange: profile?.exchange ?? null,
    industry: profile?.finnhubIndustry ?? null,
    marketCap: profile?.marketCapitalization != null ? profile.marketCapitalization * 1_000_000 : null,
    currentPrice: quote?.c ?? null,
    todayVolume: quote?.v ?? null,
    peRatio: m.peBasicExclExtraTTM ?? null,
    week52High: m['52WeekHigh'] ?? null,
    week52Low: m['52WeekLow'] ?? null,
    avgVolume: m['10DayAverageTradingVolume'] != null ? m['10DayAverageTradingVolume'] * 1_000_000 : null,
    beta: m.beta ?? null,
    dividendYield: m.currentDividendYieldTTM ?? m.dividendYieldIndicatedAnnual ?? null,
  })
}
