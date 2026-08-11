import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getExtendedHoursQuotes } from '@/lib/schwab'
import { screenBand, type NasdaqMarketCapBucket } from '@/lib/nasdaqScreener'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// Movers-only universe — deliberately NOT the liquidity-floor-filtered
// TickerUniverse used for actual signal generation. Pulls every NASDAQ
// market-cap bucket (mega through nano) across all 11 sectors with no
// numeric floor at all, since Schwab has no screener of its own (same
// limitation found during the earlier universe-expansion work) — this is
// the broadest practically fetchable set without a hardcoded list.
//
// IMPORTANT: each bucket is screened in its OWN call, then unioned — never
// pass multiple buckets into a single screenBand() call here. screenBand
// applies its per-sector cap to the MERGED result of whatever buckets it's
// given, so mega/large-cap names in a sector crowd out that sector's
// nano/micro names entirely before the cap is ever applied per-bucket.
// Verified live: e.g. a real nano-cap health_care mover ranked 169th
// within the nano bucket alone (328 nano health_care names total) — it
// never had a chance in a merged top-150 that also includes every
// mega/large/mid health_care name. Capping per bucket instead gives every
// size tier its own fair allocation.
// Warrants (W/WS), units (U), and rights (R/RT) are not common stock and
// price in fractions of a cent, where one odd-lot print is a 40% "move".
// Same suffix heuristic already used in lib/newsCatalyst.ts to prefer a
// common-stock ticker over its warrant when both share a company name.
function isDerivativeTicker(ticker: string): boolean {
  return /(WS|RT|W|U|R)$/.test(ticker) && ticker.length > 4
}
const MIN_PRICE = 0.50 // below this, tick size alone produces double-digit percentages
const MIN_DAY_VOLUME = 50_000 // today's real regular-session share volume

const ALL_BUCKETS: NasdaqMarketCapBucket[] = ['mega', 'large', 'mid', 'small', 'micro', 'nano']
const PER_SECTOR_CAP = 300 // per bucket, per sector — 6 buckets x 11 sectors x 300 ceiling (most combos have far fewer)

async function getBroadMoverUniverse(): Promise<{ ticker: string }[]> {
  const allRows = await Promise.all(
    ALL_BUCKETS.map((bucket) =>
      screenBand([bucket], PER_SECTOR_CAP, { min: 0, minInclusive: true, max: Infinity, maxInclusive: true })
    )
  )
  const seen = new Set<string>()
  const out: { ticker: string }[] = []
  for (const rows of allRows) {
    for (const r of rows) {
      if (seen.has(r.ticker)) continue
      seen.add(r.ticker)
      out.push({ ticker: r.ticker })
    }
  }
  return out
}

function getSessionWindows(): { premarketLive: boolean; afterhoursLive: boolean } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false,
  }).formatToParts(new Date())
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  const mins = hour * 60 + minute
  if (weekday === 'Sat' || weekday === 'Sun') return { premarketLive: false, afterhoursLive: false }
  return {
    premarketLive: mins >= 4 * 60 && mins < 9 * 60 + 30,
    afterhoursLive: mins >= 16 * 60 && mins < 20 * 60,
  }
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const runStartedAt = new Date()
    const { premarketLive, afterhoursLive } = getSessionWindows()
    const session: 'premarket' | 'afterhours' | null = premarketLive ? 'premarket' : afterhoursLive ? 'afterhours' : null
    if (!session) {
      return NextResponse.json({ ok: true, skipped: 'outside_both_extended_sessions' })
    }

    const universe = await getBroadMoverUniverse()
    if (universe.length === 0) {
      return NextResponse.json({ ok: false, error: 'broad universe screen returned zero tickers' })
    }

    const tickers = universe.map((u) => u.ticker)
    const CHUNK = 400
    const chunks: string[][] = []
    for (let i = 0; i < tickers.length; i += CHUNK) chunks.push(tickers.slice(i, i + CHUNK))
    const quoteEntries = await Promise.all(chunks.map((c) => getExtendedHoursQuotes(c)))

    // ── REWRITTEN 2026-08-10 after a live three-way audit proved the old
    //    mapping produced sign-flipped, magnitude-wrong numbers. ──
    //
    // The `extended` block is NOT the current price. Verified live at
    // 18:26 ET inside an active after-hours session: every sampled
    // ticker's extended.tradeTime was 03:42-03:59 ET (14+ hours stale)
    // with totalVolume 0. Reading it as "the extended price" and
    // comparing it against quote.lastPrice (which actually IS the live
    // extended price) inverted the calculation — PAYC rendered +41.69%
    // when its real after-hours move was -29.45%.
    //
    // Correct mapping, each field verified against Schwab's own computed
    // values AND an independent public quote for PAYC on 2026-08-10:
    //   current price          = quote.lastPrice        (q.livePrice)
    //   premarket reference    = quote.closePrice       (prior day's close)
    //   after-hours reference  = regular.regularMarketLastPrice
    //                            (TODAY's regular close, 213.45)
    //
    // For after-hours we take Schwab's own postMarketPercentChange rather
    // than recomputing: it returned -29.45012884 for PAYC, matching the
    // independent public source to the decimal. The locally-computed value
    // is kept as a fallback for the rare row where Schwab omits it.
    const rows: { session: string; ticker: string; companyName: string | null; regularClosePrice: number; extendedLastPrice: number; pctChange: number; dollarChange: number }[] = []
    for (const map of quoteEntries) {
      for (const q of map.values()) {
        const reference = session === 'premarket' ? q.regularClosePrice : q.regularMarketLastPrice
        if (reference <= 0) continue
        if (q.livePrice <= 0) continue

        // ── Junk filters, added 2026-08-10. ──
        // The old code implicitly excluded these: it dropped any symbol
        // whose `extended` block was empty, which happened to exclude
        // everything that doesn't really trade after hours. Removing that
        // (correctly — the block is stale, see above) let warrants and
        // sub-penny names flood the list: a single odd-lot print on a
        // $0.008 warrant renders as a -40% "mover". Row count tripled
        // (74 -> 235) and the top of the list filled with BZFDW, ONFOW,
        // LOTWW, VFSWW. The percentages were arithmetically correct but
        // the list was unusable, so the filter is restored explicitly
        // rather than as a side effect of a stale-data bug.
        //
        // NOTE: this is deliberately NOT the signal-board liquidity floor.
        // The movers page is explicitly "unfiltered, includes low-liquidity
        // movers" — small caps still belong here. This only removes
        // non-common-stock derivatives and prices/volumes so low that a
        // single print produces a meaningless percentage.
        if (isDerivativeTicker(q.symbol)) continue
        if (q.livePrice < MIN_PRICE || reference < MIN_PRICE) continue
        if (q.dayVolume < MIN_DAY_VOLUME) continue

        const dollarChange = q.livePrice - reference
        const computedPct = (dollarChange / reference) * 100
        // Schwab's own after-hours figure is authoritative when present.
        const pctChange = session === 'afterhours' && q.postMarketPercentChange !== 0
          ? q.postMarketPercentChange
          : computedPct

        rows.push({
          session,
          ticker: q.symbol,
          companyName: q.companyName,
          regularClosePrice: reference, // holds the correct per-session reference price, see schema comment
          extendedLastPrice: q.livePrice, // column name is legacy; holds the LIVE extended price
          pctChange,
          dollarChange,
        })
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, session, universeSize: tickers.length, capturedRows: 0 })
    }

    // Plain (non-transactional) upserts with bounded concurrency — this is
    // a soft-cache table refreshed every 5 minutes, not a place atomicity
    // matters, and a single interactive transaction times out well before
    // ~1,000+ sequential upserts complete.
    const CONCURRENCY = 20
    let cursor = 0
    async function worker() {
      while (cursor < rows.length) {
        const r = rows[cursor++]
        await prisma.moverSnapshot.upsert({
          where: { session_ticker: { session: r.session, ticker: r.ticker } },
          update: r,
          create: r,
        })
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker))

    // Evict rows this run did not refresh. Added 2026-08-10: the table was
    // upsert-only, so any ticker that stopped qualifying kept its LAST
    // KNOWN values forever — it never disappeared, it just froze. That is
    // why warrants and sub-penny names (VFSWW, BZFDW, ONFOW, LOTWW)
    // remained at the top of the movers list even after a filter excluded
    // them, and why a ticker that spiked once could sit on the page for
    // the rest of the session showing a move that had already reverted.
    // capturedAt is @updatedAt, so every row touched above has a timestamp
    // at or after runStartedAt; anything older was not seen this run.
    const evicted = await prisma.moverSnapshot.deleteMany({
      where: { session, capturedAt: { lt: runStartedAt } },
    })

    return NextResponse.json({ ok: true, session, universeSize: tickers.length, capturedRows: rows.length, evictedStaleRows: evicted.count })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/movers-snapshot]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
