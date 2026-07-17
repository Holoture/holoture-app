/**
 * GET /api/cron/outcomes-diag   (TEMPORARY — delete after Phase 6 diagnostic check)
 *
 * Reports real counts of closed Signal outcomes (HIT_TARGET / HIT_STOP /
 * EXPIRED) vs. still-open signals, for the landing-page outcomes strip.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  if (req.headers.get('x-diag-token') !== 'ht-outcomes-diag-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [hitTarget, hitStop, expired, open, totalSignals, checkedSample] = await Promise.all([
    prisma.signal.count({ where: { outcome: 'HIT_TARGET' } }),
    prisma.signal.count({ where: { outcome: 'HIT_STOP' } }),
    prisma.signal.count({ where: { outcome: 'EXPIRED' } }),
    prisma.signal.count({ where: { outcome: null } }),
    prisma.signal.count(),
    prisma.signal.findFirst({ orderBy: { outcomeCheckedAt: 'desc' }, select: { outcomeCheckedAt: true } }),
  ])

  // Last-30-closed window (what a "Last 30 signals" strip would actually show).
  const last30Closed = await prisma.signal.findMany({
    where: { outcome: { in: ['HIT_TARGET', 'HIT_STOP', 'EXPIRED'] } },
    orderBy: { outcomeCheckedAt: 'desc' },
    take: 30,
    select: { outcome: true, outcomeCheckedAt: true },
  })
  const last30Breakdown = {
    hitTarget: last30Closed.filter((s) => s.outcome === 'HIT_TARGET').length,
    hitStop: last30Closed.filter((s) => s.outcome === 'HIT_STOP').length,
    expired: last30Closed.filter((s) => s.outcome === 'EXPIRED').length,
    windowSize: last30Closed.length,
  }

  return NextResponse.json({
    totalSignals,
    allTime: { hitTarget, hitStop, expired, closedTotal: hitTarget + hitStop + expired, open },
    last30: last30Breakdown,
    mostRecentCheck: checkedSample?.outcomeCheckedAt ?? null,
  })
}
