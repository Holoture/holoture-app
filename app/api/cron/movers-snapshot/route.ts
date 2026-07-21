import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getExtendedHoursQuotes } from '@/lib/schwab'
import { screenBand, type NasdaqMarketCapBucket } from '@/lib/nasdaqScreener'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

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
const ALL_BUCKETS: NasdaqMarketCapBucket[] = ['mega', 'large', 'mid', 'small', 'micro', 'nano']
const PER_SECTOR_CAP = 150 // 11 sectors x 150 = up to 1,650 tickers before de-dup

async function getBroadMoverUniverse(): Promise<{ ticker: string }[]> {
  const rows = await screenBand(ALL_BUCKETS, PER_SECTOR_CAP, {
    min: 0, minInclusive: true, max: Infinity, maxInclusive: true,
  })
  return rows.map((r) => ({ ticker: r.ticker }))
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
    const quoteEntries: Awaited<ReturnType<typeof getExtendedHoursQuotes>>[] = []
    for (let i = 0; i < tickers.length; i += CHUNK) {
      quoteEntries.push(await getExtendedHoursQuotes(tickers.slice(i, i + CHUNK)))
    }

    // Reference price differs by session — see getExtendedHoursQuotes'
    // doc comment in lib/schwab.ts for the full reasoning. In short:
    // Schwab's quote.closePrice is always the PRIOR completed regular
    // session's close (verified live — it does not update to reflect
    // today's own close once today's regular session ends). That makes it
    // the correct baseline for premarket (today hasn't opened yet, so
    // "previous regular close" really is closePrice), but the WRONG
    // baseline for after-hours — using it there would measure the after-
    // hours price against yesterday's close, silently folding today's
    // entire regular-session move into what's supposed to be an
    // after-hours-only number. quote.lastPrice (today's final regular-
    // session print, frozen once the session ends) is the correct
    // after-hours baseline instead.
    const rows: { session: string; ticker: string; companyName: string | null; referencePrice: number; extendedLastPrice: number; pctChange: number; dollarChange: number }[] = []
    for (const map of quoteEntries) {
      for (const q of map.values()) {
        const reference = session === 'premarket' ? q.regularClosePrice : q.regularLastPrice
        if (reference <= 0) continue
        const dollarChange = q.extendedLastPrice - reference
        const pctChange = (dollarChange / reference) * 100
        rows.push({
          session,
          ticker: q.symbol,
          companyName: q.companyName,
          referencePrice: reference,
          extendedLastPrice: q.extendedLastPrice,
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

    return NextResponse.json({ ok: true, session, universeSize: tickers.length, capturedRows: rows.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/movers-snapshot]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
