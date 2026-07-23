/**
 * GET /api/cron/zone-check
 *
 * Retires intraday/days_1_3 signals that leave their entry zone without
 * ever having entered it — a signal like this never presented a valid
 * entry, so it isn't a thesis failure. Marked LEFT_ZONE (isActive: false),
 * a distinct outcome from EXPIRED, and excluded from win-rate denominators
 * everywhere (win rate = HIT_TARGET / (HIT_TARGET + HIT_STOP + EXPIRED)).
 *
 * Deliberately separate from cron/signal-outcomes (which runs once daily,
 * well before market open — see vercel.json, 6:00 UTC = 2:00am ET — and
 * checks target/stop/expiry). Zone-exit detection needs same-day,
 * intraday-frequency checks to be meaningful at all; piggybacking on the
 * once-daily cron would mean the "zone" check almost always fires nearly
 * a full day late, after the entry window that mattered has long passed.
 *
 * Interaction with cron/signal-outcomes: once enteredZoneAt is set here,
 * this route never touches that signal again — target/stop/expiry
 * tracking is signal-outcomes' job from that point on. The two crons only
 * ever compete for the same signal in the narrow case where a signal has
 * NEVER entered its zone; signal-outcomes can still separately expire such
 * a signal on age even if zone-check hasn't retired it yet in the same
 * cycle, which is fine — EXPIRED and LEFT_ZONE both end up isActive:false,
 * whichever cron gets there first.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuotes } from '@/lib/schwab'

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
    const candidates = await prisma.signal.findMany({
      where: {
        isActive: true,
        outcome: null,
        timeframeCategory: { in: ['intraday', 'days_1_3'] },
      },
      select: {
        id: true, ticker: true, entryZoneLow: true, entryZoneHigh: true, enteredZoneAt: true,
      },
    })

    if (candidates.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, enteredZone: 0, retiredLeftZone: 0 })
    }

    const tickers = [...new Set(candidates.map((c) => c.ticker))]
    const quotes = await getQuotes(tickers)

    let enteredZone = 0
    let retiredLeftZone = 0
    const now = new Date()

    for (const c of candidates) {
      const q = quotes.get(c.ticker)
      if (!q || q.lastPrice <= 0) continue // no live price this cycle — leave as-is, try again next run
      const inZone = q.lastPrice >= c.entryZoneLow && q.lastPrice <= c.entryZoneHigh

      if (inZone && !c.enteredZoneAt) {
        await prisma.signal.update({ where: { id: c.id }, data: { enteredZoneAt: now } })
        enteredZone++
        continue
      }

      if (!inZone && !c.enteredZoneAt) {
        await prisma.signal.update({
          where: { id: c.id },
          data: { outcome: 'LEFT_ZONE', outcomeCheckedAt: now, outcomePrice: q.lastPrice, isActive: false },
        })
        retiredLeftZone++
      }
      // else: already entered at some point — leave to cron/signal-outcomes
    }

    return NextResponse.json({ ok: true, checked: candidates.length, enteredZone, retiredLeftZone })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/zone-check]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
