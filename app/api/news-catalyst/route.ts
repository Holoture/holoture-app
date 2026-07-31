/**
 * GET /api/news-catalyst
 *
 * Read path for the News Catalyst Alerts page. Max-tier only — see
 * app/catalyst-alerts/page.tsx for the access-tier rationale. Returns the
 * last 48 hours of alerts with a live price refresh where available (reads
 * LiveQuoteCache, the same cache every other live-price surface in this app
 * reads, rather than calling Schwab directly on every page view).
 */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { computeTier } from '@/lib/user'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: {
      tier: true, subscriptionStatus: true,
      isLifetimePro: true, proExpiresAt: true,
      isLifetimeMax: true, maxExpiresAt: true,
    },
  })
  const tier = user ? computeTier(user) : 'free'
  if (tier !== 'max') return NextResponse.json({ error: 'Max tier required' }, { status: 403 })

  const cutoff = new Date(Date.now() - 48 * 60 * 60_000)
  const alerts = await prisma.newsCatalystAlert.findMany({
    where: { detectedAt: { gte: cutoff } },
    orderBy: { detectedAt: 'desc' },
    take: 100,
  })

  const tickers = [...new Set(alerts.map((a) => a.ticker))]
  const live = tickers.length > 0
    ? await prisma.liveQuoteCache.findMany({ where: { ticker: { in: tickers } } })
    : []
  const liveByTicker = new Map(live.map((l) => [l.ticker, l]))

  const out = alerts.map((a) => {
    const l = liveByTicker.get(a.ticker)
    return {
      id: a.id,
      ticker: a.ticker,
      tickerConfidence: a.tickerConfidence,
      headline: a.headline,
      sourceUrl: a.sourceUrl,
      category: a.category,
      publishedAt: a.publishedAt.toISOString(),
      detectedAt: a.detectedAt.toISOString(),
      relativeVolumeAtDetection: a.relativeVolumeAtDetection,
      priceAtDetection: a.currentPrice,
      priceChangePercentAtDetection: a.priceChangePercent,
      isHalted: a.isHalted,
      // Live price/session data when the existing cache has it; null
      // otherwise (e.g. market closed, or ticker not in the live-quotes
      // universe) — the UI falls back to the at-detection snapshot.
      livePrice: l?.price ?? null,
      liveSession: l?.session ?? null,
      liveUpdatedAt: l?.lastUpdated?.toISOString() ?? null,
    }
  })

  return NextResponse.json({ alerts: out })
}
