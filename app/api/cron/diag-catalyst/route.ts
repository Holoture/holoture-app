/**
 * TEMPORARY DIAGNOSTIC — GET /api/cron/diag-catalyst
 *
 * Real funnel numbers for the Catalyst Alerts re-investigation: total rows
 * in both tables, a sample of recent raw headlines with which category
 * (if any) they matched, and a breakdown by feedCategory. Report-only.
 * Delete after use.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { matchCatalystCategory, resolveTicker } from '@/lib/newsCatalyst'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [rawCount, alertCount] = await Promise.all([
      prisma.newsCatalystRawItem.count(),
      prisma.newsCatalystAlert.count(),
    ])

    const oldestRaw = await prisma.newsCatalystRawItem.findFirst({ orderBy: { fetchedAt: 'asc' }, select: { fetchedAt: true } })
    const newestRaw = await prisma.newsCatalystRawItem.findFirst({ orderBy: { fetchedAt: 'desc' }, select: { fetchedAt: true } })

    const byCategory = await prisma.$queryRaw<{ feedCategory: string; count: bigint }[]>`
      SELECT "feedCategory", COUNT(*) as count FROM "NewsCatalystRawItem"
      GROUP BY "feedCategory" ORDER BY count DESC
    `

    // Re-run the real category matcher against the 200 most recent raw
    // items to see the actual match rate and sample some near-miss headlines.
    const recent = await prisma.newsCatalystRawItem.findMany({
      orderBy: { fetchedAt: 'desc' },
      take: 200,
      select: { headline: true, body: true, feedCategory: true, fetchedAt: true },
    })

    let matched = 0
    const matchedSamples: { headline: string; category: string }[] = []
    const unmatchedSamples: { headline: string; feedCategory: string }[] = []
    for (const r of recent) {
      const cat = matchCatalystCategory(`${r.headline} ${r.body}`)
      if (cat) {
        matched++
        if (matchedSamples.length < 15) matchedSamples.push({ headline: r.headline, category: cat })
      } else if (unmatchedSamples.length < 25) {
        unmatchedSamples.push({ headline: r.headline, feedCategory: r.feedCategory })
      }
    }

    // For the matched ones, check how many would ALSO resolve a ticker —
    // isolates whether ticker resolution is the real bottleneck vs. category.
    let matchedWithTicker = 0
    const tickerFailSamples: string[] = []
    for (const r of recent) {
      const cat = matchCatalystCategory(`${r.headline} ${r.body}`)
      if (!cat) continue
      const resolved = await resolveTicker(`${r.headline} ${r.body}`)
      if (resolved) matchedWithTicker++
      else if (tickerFailSamples.length < 10) tickerFailSamples.push(r.headline)
    }

    return NextResponse.json({
      ok: true,
      totalRawItems: rawCount,
      totalAlerts: alertCount,
      oldestRawFetchedAt: oldestRaw?.fetchedAt ?? null,
      newestRawFetchedAt: newestRaw?.fetchedAt ?? null,
      rawItemsByFeedCategory: byCategory.map((c) => ({ feedCategory: c.feedCategory, count: Number(c.count) })),
      last200Sample: {
        totalChecked: recent.length,
        matchedCategoryCount: matched,
        matchedWithTickerCount: matchedWithTicker,
        matchedSamples,
        unmatchedSamples,
        tickerFailSamples,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
