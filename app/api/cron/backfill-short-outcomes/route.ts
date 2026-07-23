import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isValidTimeframeCategory, classifyLegacyTimeHorizon, type TimeframeCategory } from '@/lib/timeframe'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// Same category -> max-age lookup as the fixed signal-outcomes cron, needed
// here to tell EXPIRED apart from UNVERIFIABLE when the stored
// outcomePrice sat between target and stop under corrected direction logic.
const MAX_AGE_DAYS_BY_CATEGORY: Record<TimeframeCategory, number> = {
  intraday: 1,
  momentum: 1,
  days_1_3: 3,
  swing: 14,
  long_term: 45,
}
const DEFAULT_MAX_AGE_DAYS = 5

function resolveMaxAgeDays(timeframeCategory: string | null, timeHorizon: string): number {
  if (isValidTimeframeCategory(timeframeCategory)) return MAX_AGE_DAYS_BY_CATEGORY[timeframeCategory]
  const legacy = classifyLegacyTimeHorizon(timeHorizon)
  if (legacy) return MAX_AGE_DAYS_BY_CATEGORY[legacy]
  return DEFAULT_MAX_AGE_DAYS
}

/**
 * One-time backfill: every closed SHORT/SELL signal was scored under the
 * old direction-blind logic (currentPrice >= targetPrice = win), which is
 * backwards for a short (target is BELOW entry). Re-evaluates each one
 * using the SAME stored outcomePrice/outcomeCheckedAt snapshot that was
 * already captured — not a fresh live quote, since re-fetching current
 * price would conflate "outcome as of the original check" with "outcome
 * as of today" and silently corrupt historical timing. BUY/WATCH rows are
 * untouched — their direction logic was already correct.
 *
 * If the stored single price snapshot doesn't resolve to a definitive
 * win/loss/expired under the corrected logic (price was between target
 * and stop, and not yet aged past the category's max-age at check time),
 * marked UNVERIFIABLE — one snapshot can't tell us what happened, and
 * guessing would be worse than admitting the gap.
 */
export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const shorts = await prisma.signal.findMany({
      where: {
        signalType: { in: ['SHORT', 'SELL'] },
        outcome: { in: ['HIT_TARGET', 'HIT_STOP'] },
      },
      select: {
        id: true, ticker: true, signalType: true, outcome: true,
        targetPrice: true, stopLoss: true, outcomePrice: true,
        signalDate: true, outcomeCheckedAt: true,
        timeHorizon: true, timeframeCategory: true,
      },
    })

    const before = {
      hitTarget: shorts.filter((s) => s.outcome === 'HIT_TARGET').length,
      hitStop: shorts.filter((s) => s.outcome === 'HIT_STOP').length,
    }

    let flippedWinToLoss = 0
    let flippedLossToWin = 0
    let unchanged = 0
    let unverifiable = 0
    const flips: unknown[] = []
    const updates: Array<{ id: string; outcome: string }> = []

    for (const s of shorts) {
      if (s.outcomePrice == null) {
        // Shouldn't happen — HIT_TARGET/HIT_STOP were only ever set inside
        // the "currentPrice !== null" branch — but handle defensively.
        unverifiable++
        updates.push({ id: s.id, outcome: 'UNVERIFIABLE' })
        continue
      }

      let corrected: string
      if (s.outcomePrice <= s.targetPrice) {
        corrected = 'HIT_TARGET'
      } else if (s.outcomePrice >= s.stopLoss) {
        corrected = 'HIT_STOP'
      } else {
        // Price sat between target and stop at check time — under the
        // corrected logic this wasn't actually a resolved outcome yet.
        // Only call it EXPIRED if it had already aged past the window;
        // otherwise we genuinely can't say what happened next.
        const checkedAt = s.outcomeCheckedAt ?? s.signalDate
        const ageDaysAtCheck = (checkedAt.getTime() - s.signalDate.getTime()) / (1000 * 60 * 60 * 24)
        const maxAgeDays = resolveMaxAgeDays(s.timeframeCategory, s.timeHorizon)
        corrected = ageDaysAtCheck >= maxAgeDays ? 'EXPIRED' : 'UNVERIFIABLE'
      }

      if (corrected === 'UNVERIFIABLE') unverifiable++
      else if (corrected === s.outcome) unchanged++
      else if (s.outcome === 'HIT_TARGET' && corrected !== 'HIT_TARGET') {
        flippedWinToLoss++
        flips.push({ ticker: s.ticker, from: s.outcome, to: corrected, targetPrice: s.targetPrice, stopLoss: s.stopLoss, outcomePrice: s.outcomePrice })
      } else if (s.outcome === 'HIT_STOP' && corrected !== 'HIT_STOP') {
        flippedLossToWin++
        flips.push({ ticker: s.ticker, from: s.outcome, to: corrected, targetPrice: s.targetPrice, stopLoss: s.stopLoss, outcomePrice: s.outcomePrice })
      } else {
        // e.g. EXPIRED <-> EXPIRED already counted as unchanged above; any
        // other transition (shouldn't occur) still counts as a flip for
        // visibility rather than silently dropping it.
        if (s.outcome !== corrected) {
          flips.push({ ticker: s.ticker, from: s.outcome, to: corrected, targetPrice: s.targetPrice, stopLoss: s.stopLoss, outcomePrice: s.outcomePrice })
        }
      }

      if (corrected !== s.outcome) {
        updates.push({ id: s.id, outcome: corrected })
      }
    }

    for (const u of updates) {
      await prisma.signal.update({ where: { id: u.id }, data: { outcome: u.outcome } })
    }

    const afterAll = await prisma.signal.findMany({
      where: { outcome: { in: ['HIT_TARGET', 'HIT_STOP', 'EXPIRED', 'UNVERIFIABLE'] } },
      select: { outcome: true },
    })
    const after = {
      hitTarget: afterAll.filter((s) => s.outcome === 'HIT_TARGET').length,
      hitStop: afterAll.filter((s) => s.outcome === 'HIT_STOP').length,
      expired: afterAll.filter((s) => s.outcome === 'EXPIRED').length,
      unverifiable: afterAll.filter((s) => s.outcome === 'UNVERIFIABLE').length,
    }

    return NextResponse.json({
      ok: true,
      shortSignalsReviewed: shorts.length,
      before,
      flippedWinToLoss,
      flippedLossToWin,
      unchanged,
      unverifiable,
      flips,
      afterAllSignals: after,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/backfill-short-outcomes]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
