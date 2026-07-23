import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuotes } from '@/lib/schwab'
import { isValidTimeframeCategory, classifyLegacyTimeHorizon, type TimeframeCategory } from '@/lib/timeframe'

export const maxDuration = 60

// Max age before an unresolved signal is marked EXPIRED, keyed on the
// canonical timeframeCategory enum — not the free-text timeHorizon string.
// 'momentum' resolves fast by design (tight stop, fixed 6% target — see
// cron/momentum/route.ts), so it shares intraday's 1-day window rather
// than the old text-parser's now-irrelevant 'momentum|week' -> 7 mapping
// (that legacy branch dates to the pre-scanner fake momentum tab).
const MAX_AGE_DAYS_BY_CATEGORY: Record<TimeframeCategory, number> = {
  intraday: 1,
  momentum: 1,
  days_1_3: 3,
  swing: 14,
  long_term: 45,
}
const DEFAULT_MAX_AGE_DAYS = 5 // pre-migration rows with no recoverable category at all

function resolveMaxAgeDays(timeframeCategory: string | null, timeHorizon: string): number {
  if (isValidTimeframeCategory(timeframeCategory)) return MAX_AGE_DAYS_BY_CATEGORY[timeframeCategory]
  const legacy = classifyLegacyTimeHorizon(timeHorizon)
  if (legacy) return MAX_AGE_DAYS_BY_CATEGORY[legacy]
  return DEFAULT_MAX_AGE_DAYS
}

/**
 * Direction-aware win/loss check. BUY and WATCH share the same bullish
 * orientation (target above entry, stop below) — WATCH signals get the
 * same target/stop shape from generation as BUY (see signals/route.ts's
 * prompt), they just don't carry an explicit "act now" recommendation, so
 * there's no separate direction logic needed for them. SHORT/SELL is the
 * only inverted case: target is BELOW entry (win on decline), stop is
 * ABOVE entry (loss on rise).
 */
function evaluateDirectionalOutcome(
  signalType: string,
  currentPrice: number,
  targetPrice: number,
  stopLoss: number
): 'HIT_TARGET' | 'HIT_STOP' | null {
  const isShort = signalType === 'SHORT' || signalType === 'SELL'
  if (isShort) {
    if (currentPrice <= targetPrice) return 'HIT_TARGET'
    if (currentPrice >= stopLoss) return 'HIT_STOP'
    return null
  }
  if (currentPrice >= targetPrice) return 'HIT_TARGET'
  if (currentPrice <= stopLoss) return 'HIT_STOP'
  return null
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    const signals = await prisma.signal.findMany({
      where: {
        isActive: true,
        outcome: null,
        signalDate: {
          lte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        },
      },
      select: {
        id: true,
        ticker: true,
        signalType: true,
        targetPrice: true,
        stopLoss: true,
        entryZoneLow: true,
        entryZoneHigh: true,
        timeHorizon: true,
        timeframeCategory: true,
        signalDate: true,
        confidence: true,
      },
    })

    if (signals.length === 0) {
      return NextResponse.json({ message: 'No signals to evaluate', evaluated: 0 })
    }

    const uniqueTickers = [...new Set(signals.map((s) => s.ticker))]
    const quotes = await getQuotes(uniqueTickers)
    const priceMap: Record<string, number | null> = {}
    for (const ticker of uniqueTickers) {
      const q = quotes.get(ticker)
      priceMap[ticker] = q && q.lastPrice > 0 ? q.lastPrice : null
    }

    let evaluated = 0
    const updates: Array<{
      id: string
      outcome: string
      outcomePrice: number | null
      isActive: boolean
    }> = []

    for (const signal of signals) {
      const currentPrice = priceMap[signal.ticker]
      const ageMs = now.getTime() - signal.signalDate.getTime()
      const ageDays = ageMs / (1000 * 60 * 60 * 24)
      const maxAgeDays = resolveMaxAgeDays(signal.timeframeCategory, signal.timeHorizon)

      let outcome: string | null = null

      if (currentPrice !== null) {
        outcome = evaluateDirectionalOutcome(signal.signalType, currentPrice, signal.targetPrice, signal.stopLoss)
        if (!outcome && ageDays >= maxAgeDays) {
          outcome = 'EXPIRED'
        }
      } else if (ageDays >= maxAgeDays) {
        outcome = 'EXPIRED'
      }

      if (outcome) {
        updates.push({
          id: signal.id,
          outcome,
          outcomePrice: currentPrice,
          isActive: false,
        })
        evaluated++
      }
    }

    for (const update of updates) {
      await prisma.signal.update({
        where: { id: update.id },
        data: {
          outcome: update.outcome,
          outcomeCheckedAt: now,
          outcomePrice: update.outcomePrice ?? undefined,
          isActive: update.isActive,
        },
      })
    }

    console.log(`Signal outcomes: evaluated ${evaluated} signals`)
    return NextResponse.json({
      message: 'Success',
      evaluated,
      breakdown: {
        hit_target: updates.filter((u) => u.outcome === 'HIT_TARGET').length,
        hit_stop: updates.filter((u) => u.outcome === 'HIT_STOP').length,
        expired: updates.filter((u) => u.outcome === 'EXPIRED').length,
      },
    })
  } catch (err) {
    console.error('Signal outcomes cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
