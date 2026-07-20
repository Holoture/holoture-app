// TEMPORARY ONE-TIME BACKFILL — DELETE AFTER USE
//
// GET /api/cron/timeframe-backfill
//
// Populates timeframeCategory on pre-existing signals that predate the
// server-side assignment (Task 2). Uses classifyLegacyTimeHorizon() —
// never assigns 'momentum' to a backfilled row (reserved for the real
// intraday scanner going forward, per Task 3). Skips rows that already
// have a timeframeCategory (safe to re-run).

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { classifyLegacyTimeHorizon } from '@/lib/timeframe'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rows = await prisma.signal.findMany({
      where: { timeframeCategory: null },
      select: { id: true, timeHorizon: true },
    })

    const counts: Record<string, number> = { intraday: 0, days_1_3: 0, swing: 0, long_term: 0, unmapped: 0 }
    const unmappedStrings = new Set<string>()

    const CHUNK = 25
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      await Promise.all(
        chunk.map(async (row) => {
          const category = classifyLegacyTimeHorizon(row.timeHorizon)
          if (category) {
            counts[category] = (counts[category] ?? 0) + 1
            await prisma.signal.update({ where: { id: row.id }, data: { timeframeCategory: category } })
          } else {
            counts.unmapped++
            unmappedStrings.add(row.timeHorizon)
          }
        })
      )
    }

    return NextResponse.json({
      ok: true,
      totalRowsConsidered: rows.length,
      counts,
      unmappedTimeHorizonStrings: [...unmappedStrings],
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
