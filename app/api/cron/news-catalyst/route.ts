/**
 * GET /api/cron/news-catalyst
 *
 * News Catalyst Alerts ingestion — polls GlobeNewswire's public RSS feeds,
 * dedupes against previously-seen items, and runs each new item through
 * three gates in order: catalyst-category match -> ticker resolution ->
 * volume confirmation. A raw item that fails any gate is logged (for dedup)
 * but never becomes an alert. See lib/newsCatalyst.ts for the full feature
 * doc, the GlobeNewswire licensing note, and the honest latency caveat.
 *
 * Scheduled every minute during the trading day (vercel.json) — that cron
 * cadence, not a runtime setting, is what actually controls poll frequency.
 *
 * This is completely separate from the vetted Signal system: writes only to
 * NewsCatalystRawItem/NewsCatalystAlert, never Signal, and is never counted
 * in any public track-record stat.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  FEED_URLS, parseRssItems, filterUnseenItems, matchCatalystCategory,
  resolveTicker, checkVolumeConfirmation,
} from '@/lib/newsCatalyst'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const stats = {
      feedsPolled: 0, itemsFetched: 0, newItems: 0,
      rejected: { noCatalystCategory: 0, noTicker: 0, volumeNotConfirmed: 0 },
      alertsCreated: [] as string[],
    }

    for (const feed of FEED_URLS) {
      stats.feedsPolled++
      let xml: string
      try {
        const res = await fetch(feed.url, {
          headers: { 'User-Agent': 'Holoture News Catalyst Scanner contact@holoture.com' },
          signal: AbortSignal.timeout(15000),
          cache: 'no-store',
        })
        if (!res.ok) continue
        xml = await res.text()
      } catch {
        continue // one feed failing shouldn't abort the whole run
      }

      const parsed = parseRssItems(xml)
      stats.itemsFetched += parsed.length

      const unseen = await filterUnseenItems(parsed)
      stats.newItems += unseen.length
      if (unseen.length === 0) continue

      // Log every new raw item immediately (dedup record), regardless of
      // whether it clears the downstream gates.
      await prisma.newsCatalystRawItem.createMany({
        data: unseen.map((i) => ({
          guid: i.guid, headline: i.headline, body: i.body,
          feedCategory: feed.feedCategory, publishedAt: i.publishedAt, sourceUrl: i.sourceUrl,
        })),
        skipDuplicates: true,
      })

      for (const item of unseen) {
        const fullText = `${item.headline} ${item.body}`

        const category = matchCatalystCategory(fullText)
        if (!category) { stats.rejected.noCatalystCategory++; continue }

        const resolved = await resolveTicker(fullText)
        if (!resolved) { stats.rejected.noTicker++; continue }

        const confirmation = await checkVolumeConfirmation(resolved.ticker)
        if (!confirmation || !confirmation.confirmed) { stats.rejected.volumeNotConfirmed++; continue }

        await prisma.newsCatalystAlert.create({
          data: {
            ticker: resolved.ticker,
            tickerConfidence: resolved.confidence,
            headline: item.headline,
            sourceUrl: item.sourceUrl,
            category,
            publishedAt: item.publishedAt,
            relativeVolumeAtDetection: confirmation.relativeVolume,
            currentPrice: confirmation.currentPrice,
            priceChangePercent: confirmation.priceChangePercent,
            isHalted: confirmation.isHalted,
          },
        })
        stats.alertsCreated.push(resolved.ticker)
      }
    }

    return NextResponse.json({ ok: true, ...stats })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/news-catalyst]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
