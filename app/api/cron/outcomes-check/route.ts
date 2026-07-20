// TEMPORARY — DELETE AFTER USE
// GET /api/cron/outcomes-check
// Reports live outcome totals (all-time + last-30-closed window) and
// momentum-tagged outcome counts, to sanity-check the landing page
// outcomes strip before/after shipping.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [hitTarget, hitStop, expired, pending] = await Promise.all([
    prisma.signal.count({ where: { outcome: 'HIT_TARGET' } }),
    prisma.signal.count({ where: { outcome: 'HIT_STOP' } }),
    prisma.signal.count({ where: { outcome: 'EXPIRED' } }),
    prisma.signal.count({ where: { outcome: null } }),
  ])

  const recentClosed = await prisma.signal.findMany({
    where: { outcome: { in: ['HIT_TARGET', 'HIT_STOP', 'EXPIRED'] } },
    orderBy: { outcomeCheckedAt: 'desc' },
    take: 30,
    select: { outcome: true },
  })

  const [momentumHitTarget, momentumHitStop, momentumExpired, momentumPending] = await Promise.all([
    prisma.signal.count({ where: { isMomentumSpike: true, outcome: 'HIT_TARGET' } }),
    prisma.signal.count({ where: { isMomentumSpike: true, outcome: 'HIT_STOP' } }),
    prisma.signal.count({ where: { isMomentumSpike: true, outcome: 'EXPIRED' } }),
    prisma.signal.count({ where: { isMomentumSpike: true, outcome: null } }),
  ])

  return NextResponse.json({
    allTime: { hitTarget, hitStop, expired, pending, closedTotal: hitTarget + hitStop + expired },
    last30ClosedWindow: {
      hitTarget: recentClosed.filter((s) => s.outcome === 'HIT_TARGET').length,
      hitStop: recentClosed.filter((s) => s.outcome === 'HIT_STOP').length,
      expired: recentClosed.filter((s) => s.outcome === 'EXPIRED').length,
      size: recentClosed.length,
    },
    momentumTagged: {
      hitTarget: momentumHitTarget,
      hitStop: momentumHitStop,
      expired: momentumExpired,
      pending: momentumPending,
      closedTotal: momentumHitTarget + momentumHitStop + momentumExpired,
    },
  })
}
