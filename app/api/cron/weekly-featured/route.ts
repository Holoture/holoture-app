/**
 * GET /api/cron/weekly-featured
 *
 * Picks the single highest-gaining CLOSED signal of ALL TIME for the
 * landing page showcase. Re-runs weekly (Sunday night, alongside
 * cron/universe-screen) so a new record is picked up when one is set —
 * the WEEKLY part is the refresh cadence, not the selection window.
 *
 * GAIN BASIS: entry price at the time the signal was posted -> the highest
 * price the stock reached afterward (lowest, for a SHORT/SELL). This is the
 * stock's best subsequent price, not the signal's actual realized exit —
 * see lib/weeklyFeatured.ts for the full tradeoff. "Entry price at posting"
 * is the entry-zone midpoint, since that's the only "as of generation" price
 * this app stores (the AI-set entry zone is Schwab-priced at generation
 * time — see cron/signals' own comments on that field).
 *
 * Eligibility:
 *   - outcome must be HIT_TARGET (never open/pending, EXPIRED, HIT_STOP,
 *     LEFT_ZONE, or UNVERIFIABLE)
 *   - isManual must be false — algorithm output only, same rule the public
 *     outcomes strip enforces via lib/publicStats.ts
 *
 * If nothing qualifies, NOTHING is written — the UI renders an explicit
 * empty state rather than falling back to a weaker result.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDailyCandles } from '@/lib/schwab'
import { PUBLIC_TRACK_RECORD_FILTER } from '@/lib/publicStats'
import { peakGainPercent, isEntryPriceTrustworthy, weekStartET } from '@/lib/weeklyFeatured'

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
    const now = new Date()

    // No date window — the pool is every qualifying signal ever recorded.
    const candidates = await prisma.signal.findMany({
      where: { outcome: 'HIT_TARGET', ...PUBLIC_TRACK_RECORD_FILTER },
      select: {
        id: true, ticker: true, signalType: true,
        entryZoneLow: true, entryZoneHigh: true, signalDate: true,
      },
    })

    if (candidates.length === 0) {
      return NextResponse.json({ ok: true, candidates: 0, selected: null, note: 'no signals have closed at target yet' })
    }

    // One Schwab candle fetch per unique ticker, not per signal — several
    // candidates commonly share a ticker.
    const uniqueTickers = [...new Set(candidates.map((c) => c.ticker))]
    const candlesByTicker = new Map(
      await Promise.all(uniqueTickers.map(async (t) => [t, await getDailyCandles(t)] as const)),
    )

    let best: { id: string; ticker: string; gain: number } | null = null
    const skipped: { ticker: string; reason: string }[] = []

    for (const c of candidates) {
      const allCandles = candlesByTicker.get(c.ticker) ?? []
      const sincePosting = allCandles.filter((cd) => cd.datetime >= c.signalDate.getTime())
      if (sincePosting.length === 0) {
        skipped.push({ ticker: c.ticker, reason: 'no candle data since posting' })
        continue
      }

      const entryPrice = (c.entryZoneLow + c.entryZoneHigh) / 2

      // Reject when the signal's own stored entry zone doesn't match where
      // the stock actually traded at posting — a stale/wrong entry, not a
      // real move, would otherwise inflate the gain against a fictional
      // starting point.
      if (!isEntryPriceTrustworthy(entryPrice, sincePosting[0])) {
        skipped.push({ ticker: c.ticker, reason: `entry zone (${entryPrice.toFixed(2)}) doesn't match real price at posting (~${((sincePosting[0].high + sincePosting[0].low) / 2).toFixed(2)})` })
        continue
      }

      const gain = peakGainPercent({ signalType: c.signalType, entryPrice, candlesSincePosting: sincePosting })
      if (gain === null) {
        skipped.push({ ticker: c.ticker, reason: 'no computable gain (bad entry price or failed sanity ceiling)' })
        continue
      }

      if (!best || gain > best.gain) best = { id: c.id, ticker: c.ticker, gain }
    }

    if (skipped.length > 0) {
      console.warn('[cron/weekly-featured] skipped candidates', skipped)
    }

    if (!best) {
      return NextResponse.json({ ok: true, candidates: candidates.length, selected: null, skipped, note: 'no candidate produced a publishable gain' })
    }

    const weekStartDate = weekStartET(now)
    await prisma.weeklyFeaturedSignal.upsert({
      where: { weekStartDate },
      create: { signalId: best.id, weekStartDate, realizedGainPercent: best.gain },
      update: { signalId: best.id, realizedGainPercent: best.gain, selectedAt: new Date() },
    })

    return NextResponse.json({
      ok: true,
      candidates: candidates.length,
      selected: { ticker: best.ticker, gainPercent: Math.round(best.gain * 100) / 100 },
      skipped,
      weekStartDate: weekStartDate.toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/weekly-featured]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
