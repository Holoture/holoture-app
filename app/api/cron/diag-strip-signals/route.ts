/**
 * TEMPORARY DIAGNOSTIC — GET /api/cron/diag-strip-signals
 *
 * Reports the exact rows currently in the Recent Signals strip's window
 * pool: last 20 swing/long_term, non-manual signals with outcome
 * HIT_TARGET or HIT_STOP, ordered by outcomeCheckedAt desc — same query as
 * getOutcomesSummary() in app/page.tsx. Report-only. Delete after use.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PUBLIC_TRACK_RECORD_FILTER } from '@/lib/publicStats'

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
    const rows = await prisma.signal.findMany({
      where: {
        timeframeCategory: { in: ['swing', 'long_term'] },
        outcome: { in: ['HIT_TARGET', 'HIT_STOP'] },
        ...PUBLIC_TRACK_RECORD_FILTER,
      },
      orderBy: { outcomeCheckedAt: 'desc' },
      take: 20,
      select: {
        ticker: true, companyName: true, signalType: true, timeframeCategory: true,
        outcome: true, outcomeCheckedAt: true, outcomePrice: true,
        entryZoneLow: true, entryZoneHigh: true, targetPrice: true, stopLoss: true,
        signalDate: true,
      },
    })

    return NextResponse.json({ ok: true, count: rows.length, rows })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/diag-strip-signals]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
