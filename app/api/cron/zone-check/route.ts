/**
 * GET /api/cron/zone-check
 *
 * Watches intraday/days_1_3 signals for entry into their entry zone and
 * stamps enteredZoneAt the first time price gets there. Signals that never
 * enter their zone are no longer retired here as a separate LEFT_ZONE
 * outcome — they're left isActive with outcome null and run out the clock
 * through cron/signal-outcomes like any other unresolved signal, which
 * marks them EXPIRED (counted in the win-rate denominator) once their
 * outcome window passes.
 *
 * Deliberately separate from cron/signal-outcomes (which runs once daily,
 * well before market open — see vercel.json, 6:00 UTC = 2:00am ET — and
 * checks target/stop/expiry). Zone-entry detection needs same-day,
 * intraday-frequency checks to be meaningful at all; piggybacking on the
 * once-daily cron would mean it almost always fires nearly a full day late,
 * after the entry window that mattered has long passed.
 *
 * Interaction with cron/signal-outcomes: once enteredZoneAt is set here,
 * this route never touches that signal again — target/stop/expiry
 * tracking is signal-outcomes' job from that point on. For signals that
 * never enter their zone, signal-outcomes is the only cron that ever
 * resolves them (via EXPIRED on age).
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuotes } from '@/lib/schwab'
import { createNotificationsBulk } from '@/lib/notifications'
import { formatCurrency } from '@/lib/utils'

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
      return NextResponse.json({ ok: true, checked: 0, enteredZone: 0 })
    }

    const tickers = [...new Set(candidates.map((c) => c.ticker))]
    const quotes = await getQuotes(tickers)

    let enteredZone = 0
    const now = new Date()
    const justEntered: { id: string; ticker: string; entryZoneLow: number; entryZoneHigh: number }[] = []

    for (const c of candidates) {
      const q = quotes.get(c.ticker)
      if (!q || q.lastPrice <= 0) continue // no live price this cycle — leave as-is, try again next run
      const inZone = q.lastPrice >= c.entryZoneLow && q.lastPrice <= c.entryZoneHigh

      if (inZone && !c.enteredZoneAt) {
        await prisma.signal.update({ where: { id: c.id }, data: { enteredZoneAt: now } })
        enteredZone++
        justEntered.push(c)
        continue
      }

      // else: never entered zone yet, or already entered at some point —
      // leave to cron/signal-outcomes (target/stop/expiry)
    }

    // Tracked-signal notification — only users who opted in by tracking this
    // specific signal, never a broadcast. Highest priority per spec since
    // it's the one category the user explicitly asked for.
    if (justEntered.length > 0) {
      const trackers = await prisma.trackedSignal.findMany({
        where: { signalId: { in: justEntered.map((s) => s.id) }, closedAt: null },
        select: { userId: true, signalId: true },
      })
      const byId = new Map(justEntered.map((s) => [s.id, s]))
      await createNotificationsBulk(
        trackers.map((t) => {
          const s = byId.get(t.signalId)!
          return {
            userId: t.userId,
            type: 'zone_entered' as const,
            title: `${s.ticker} entered its entry zone`,
            body: `Price is now within the entry zone (${formatCurrency(s.entryZoneLow)}–${formatCurrency(s.entryZoneHigh)}).`,
            linkUrl: '/tracker',
          }
        }),
      )
    }

    return NextResponse.json({ ok: true, checked: candidates.length, enteredZone })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/zone-check]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
