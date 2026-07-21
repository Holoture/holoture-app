import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuotesWithFundamentals } from '@/lib/schwab'
import { screenBand, type ScreenedTicker } from '@/lib/nasdaqScreener'
import {
  LARGE_CAP_MIN_DOLLAR_VOLUME,
  SMALL_CAP_MIN_DOLLAR_VOLUME,
  LARGE_CAP_MIN_MARKET_CAP,
  SMALL_MID_MIN_MARKET_CAP,
  SMALL_MID_MAX_MARKET_CAP,
} from '@/lib/liquidityFloor'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// Per-sector cap sized so 11 sectors land inside the task's target pool
// sizes while keeping every sector well under the ~15-20% diversity cap:
//   large-cap:    11 x 9  = up to 99   (target 80-100)
//   small/mid:    11 x 20 = up to 220  (target 150-250)
// Unchanged by the market-cap-band/liquidity-floor update below — the cap
// is on how many candidates get FETCHED per sector, which bounds the pool
// size regardless of how loose the downstream liquidity floor is.
const LARGE_PER_SECTOR_CAP = 9
const SMALL_MID_PER_SECTOR_CAP = 20

// NASDAQ's fixed buckets our two bands must fetch from, since the $1B
// boundary falls inside NASDAQ's own "small" bucket (300M-2B) and the $10M
// floor falls inside "nano" (<50M) — screenBand does the exact numeric cut.
const LARGE_CAP_BUCKETS = ['mega', 'large', 'mid', 'small'] as const
const SMALL_MID_BUCKETS = ['small', 'micro', 'nano'] as const

async function applyLiquidityFloor(
  candidates: ScreenedTicker[],
  minDollarVolume: number
): Promise<Array<ScreenedTicker & { avgDollarVolume: number }>> {
  const out: Array<ScreenedTicker & { avgDollarVolume: number }> = []
  // Schwab's batch quote endpoint caps at ~500 symbols per call.
  const CHUNK = 400
  for (let i = 0; i < candidates.length; i += CHUNK) {
    const chunk = candidates.slice(i, i + CHUNK)
    const quoteMap = await getQuotesWithFundamentals(chunk.map((c) => c.ticker))
    for (const c of chunk) {
      const data = quoteMap.get(c.ticker)
      if (!data) continue
      const avgVol = data.fundamental.avg10DaysVolume
      if (avgVol == null) continue // no data — exclude here (unlike the daily generator, this is a fresh admission gate, not a re-check)
      const avgDollarVolume = data.quote.lastPrice * avgVol
      if (avgDollarVolume >= minDollarVolume) {
        out.push({ ...c, avgDollarVolume })
      }
    }
  }
  return out
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Threshold-change verification: skips the DB write, only reports
  // diagnostics. Not part of the scheduled cron's normal invocation —
  // used to sanity-check new bands/floors before they go live.
  const dryRun = new URL(req.url).searchParams.get('dryRun') === 'true'

  try {
    const [largeCandidates, smallMidCandidates] = await Promise.all([
      screenBand([...LARGE_CAP_BUCKETS], LARGE_PER_SECTOR_CAP, {
        min: LARGE_CAP_MIN_MARKET_CAP, minInclusive: false, max: Infinity, maxInclusive: true,
      }),
      screenBand([...SMALL_MID_BUCKETS], SMALL_MID_PER_SECTOR_CAP, {
        min: SMALL_MID_MIN_MARKET_CAP, minInclusive: true, max: SMALL_MID_MAX_MARKET_CAP, maxInclusive: true,
      }),
    ])

    const [largeQualified, smallMidQualified] = await Promise.all([
      applyLiquidityFloor(largeCandidates, LARGE_CAP_MIN_DOLLAR_VOLUME),
      applyLiquidityFloor(smallMidCandidates, SMALL_CAP_MIN_DOLLAR_VOLUME),
    ])

    // Diagnostics requested for the threshold change: rejection counts and
    // how thin the newly-admitted small/mid pool actually is.
    const largeRejectedByLiquidity = largeCandidates.length - largeQualified.length
    const smallMidRejectedByLiquidity = smallMidCandidates.length - smallMidQualified.length
    const smallMidUnder50MDollarVolume = smallMidQualified.filter((t) => t.avgDollarVolume < 50_000_000).length

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        largeCandidatesFetched: largeCandidates.length,
        largeQualified: largeQualified.length,
        largeRejectedByLiquidity,
        smallMidCandidatesFetched: smallMidCandidates.length,
        smallMidQualified: smallMidQualified.length,
        smallMidRejectedByLiquidity,
        smallMidUnder50MDollarVolume,
        smallMidUnder50MDollarVolumePct: smallMidQualified.length > 0
          ? Math.round((smallMidUnder50MDollarVolume / smallMidQualified.length) * 1000) / 10
          : 0,
        totalUniverseSize: largeQualified.length + smallMidQualified.length,
      })
    }

    if (largeQualified.length === 0 && smallMidQualified.length === 0) {
      // Screen returned nothing usable — leave the existing TickerUniverse
      // table (and therefore the daily generator's fallback path) untouched
      // rather than wiping it out on a bad run.
      return NextResponse.json({ ok: false, error: 'Screen returned zero qualified candidates; table left unchanged' }, { status: 200 })
    }

    const now = new Date()
    const rows = [
      ...largeQualified.map((t) => ({
        ticker: t.ticker,
        marketCapBand: 'large' as const,
        sector: t.sector,
        avgDollarVolume: t.avgDollarVolume,
        lastScreenedAt: now,
      })),
      ...smallMidQualified.map((t) => ({
        ticker: t.ticker,
        marketCapBand: 'small_mid' as const,
        sector: t.sector,
        avgDollarVolume: t.avgDollarVolume,
        lastScreenedAt: now,
      })),
    ]

    // Never-appeared diagnostic (Task 4 of Universe Expansion) — standing
    // check, not one-time: of the tickers about to make up the new
    // universe, how many have zero signals in the trailing 30 days.
    const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recentTickers = await prisma.signal.findMany({
      where: { autoGenerated: true, createdAt: { gte: cutoff30d } },
      select: { ticker: true },
      distinct: ['ticker'],
    })
    const recentSet = new Set(recentTickers.map((s) => s.ticker))
    const neverAppeared = rows.filter((r) => !recentSet.has(r.ticker)).length

    await prisma.$transaction([
      prisma.tickerUniverse.deleteMany({}),
      prisma.tickerUniverse.createMany({ data: rows }),
    ])

    return NextResponse.json({
      ok: true,
      universeSize: rows.length,
      largeCap: largeQualified.length,
      smallMid: smallMidQualified.length,
      neverAppearedInLast30Days: neverAppeared,
      neverAppearedPct: Math.round((neverAppeared / rows.length) * 1000) / 10,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/universe-screen]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
