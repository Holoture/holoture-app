/**
 * TEMPORARY diagnostic route — read-only, no writes. Returns the raw
 * closed-signal fields needed to compute the gain/win-rate breakdown
 * requested for the average-% -gain report. Delete after use.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const signals = await prisma.signal.findMany({
    where: { isManual: false },
    select: {
      outcome: true,
      outcomePrice: true,
      entryZoneLow: true,
      entryZoneHigh: true,
      signalType: true,
      timeframeCategory: true,
      session: true,
    },
  })

  const optionsCount = await prisma.optionsSignal.count({ where: { isManual: false } })

  return NextResponse.json({
    count: signals.length,
    signals,
    optionsCount,
    // OptionsSignal has no outcome/outcomePrice field in the schema at all —
    // there is no options outcome tracking to compute a gain figure from.
    optionsHasOutcomeTracking: false,
  })
}
