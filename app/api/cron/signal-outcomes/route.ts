import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuotes } from '@/lib/schwab'
import { isValidTimeframeCategory, classifyLegacyTimeHorizon, type TimeframeCategory } from '@/lib/timeframe'
import { createNotificationsBulk, pruneOldNotifications, type NotificationType } from '@/lib/notifications'
import { pruneOldHealthChecks, pruneOldWebhookLogs } from '@/lib/db-cleanup'
import { formatCurrency } from '@/lib/utils'

export const maxDuration = 60

// Max age before an unresolved signal is marked EXPIRED — i.e. how long a
// signal gets to hit its target or stop before the outcome checker gives up
// on it. This is deliberately uniform and generous (3 months) across every
// category: it is NOT the signal's own timeHorizon/timeframeCategory (which
// still governs how the signal is framed and how it's dedup'd on generation
// — see cron/signals's per-ticker freshness check, which is untouched by
// this value and keeps the daily feed from going stale). This window only
// controls when an unresolved trade stops being tracked toward target/stop.
const MAX_AGE_DAYS_BY_CATEGORY: Record<TimeframeCategory, number> = {
  intraday: 90,
  momentum: 90,
  days_1_3: 90,
  swing: 90,
  long_term: 90,
}
const DEFAULT_MAX_AGE_DAYS = 90 // pre-migration rows with no recoverable category at all

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

    // Tracked-signal notifications — only for users who tracked one of these
    // specific signals, never a broadcast.
    if (updates.length > 0) {
      const bySignalId = new Map(signals.map((s) => [s.id, s]))
      const trackers = await prisma.trackedSignal.findMany({
        where: { signalId: { in: updates.map((u) => u.id) }, closedAt: null },
        select: { userId: true, signalId: true },
      })
      const notifTypeFor: Record<string, NotificationType> = {
        HIT_TARGET: 'signal_hit_target',
        HIT_STOP: 'signal_hit_stop',
        EXPIRED: 'signal_expired',
      }
      const updateBySignalId = new Map(updates.map((u) => [u.id, u]))
      await createNotificationsBulk(
        trackers.flatMap((t) => {
          const update = updateBySignalId.get(t.signalId)
          const s = bySignalId.get(t.signalId)
          const type = update ? notifTypeFor[update.outcome] : undefined
          if (!update || !s || !type) return []
          const title =
            update.outcome === 'HIT_TARGET' ? `${s.ticker} hit its target` :
            update.outcome === 'HIT_STOP'   ? `${s.ticker} hit its stop loss` :
            `${s.ticker} expired without resolution`
          const body =
            update.outcome === 'HIT_TARGET' ? `Target price of ${formatCurrency(s.targetPrice)} was reached.` :
            update.outcome === 'HIT_STOP'   ? `Stop loss price of ${formatCurrency(s.stopLoss)} was reached.` :
            `Neither the target nor the stop loss was reached before the signal's timeframe ended.`
          return [{ userId: t.userId, type, title, body, linkUrl: '/tracker' }]
        }),
      )
    }

    const [pruned, healthChecksPruned, webhookLogsPruned] = await Promise.all([
      pruneOldNotifications(),
      pruneOldHealthChecks(),
      pruneOldWebhookLogs(),
    ])

    console.log(`Signal outcomes: evaluated ${evaluated} signals`)
    return NextResponse.json({
      message: 'Success',
      evaluated,
      breakdown: {
        hit_target: updates.filter((u) => u.outcome === 'HIT_TARGET').length,
        hit_stop: updates.filter((u) => u.outcome === 'HIT_STOP').length,
        expired: updates.filter((u) => u.outcome === 'EXPIRED').length,
      },
      notificationsPruned: pruned,
      healthChecksPruned,
      webhookLogsPruned,
    })
  } catch (err) {
    console.error('Signal outcomes cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
