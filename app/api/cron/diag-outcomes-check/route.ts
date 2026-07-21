import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [allTimeHitTarget, allTimeHitStop, allTimeExpired, allTimePending] = await Promise.all([
    prisma.signal.count({ where: { outcome: 'HIT_TARGET' } }),
    prisma.signal.count({ where: { outcome: 'HIT_STOP' } }),
    prisma.signal.count({ where: { outcome: 'EXPIRED' } }),
    prisma.signal.count({ where: { outcome: null } }),
  ])

  const recentClosed = await prisma.signal.findMany({
    where: { outcome: { in: ['HIT_TARGET', 'HIT_STOP', 'EXPIRED'] } },
    orderBy: { outcomeCheckedAt: 'desc' },
    take: 100,
    select: { outcome: true },
  })
  const hitTarget = recentClosed.filter((s) => s.outcome === 'HIT_TARGET').length
  const hitStop = recentClosed.filter((s) => s.outcome === 'HIT_STOP').length
  const expired = recentClosed.filter((s) => s.outcome === 'EXPIRED').length
  const winRatePct = recentClosed.length > 0 ? Math.round((hitTarget / recentClosed.length) * 1000) / 10 : 0

  return NextResponse.json({
    allTime: { hitTarget: allTimeHitTarget, hitStop: allTimeHitStop, expired: allTimeExpired, pending: allTimePending, closedTotal: allTimeHitTarget + allTimeHitStop + allTimeExpired },
    last100ClosedWindow: { hitTarget, hitStop, expired, size: recentClosed.length, winRatePct },
  })
}
