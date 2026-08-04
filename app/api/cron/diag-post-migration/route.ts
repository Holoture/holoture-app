/**
 * TEMPORARY DIAGNOSTIC — GET /api/cron/diag-post-migration
 *
 * Row-count check after the options-outcome-tracking schema push, per the
 * explicit "confirm the migration ran successfully with a row-count check
 * before/after" requirement. Report-only. Delete after use.
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

  try {
    const [signalCount, optionsSignalCount, politicianTradeCount, optionsWithOutcomeField] = await Promise.all([
      prisma.signal.count(),
      prisma.optionsSignal.count(),
      prisma.politicianTrade.count(),
      prisma.optionsSignal.findFirst({ select: { outcome: true, outcomeCheckedAt: true, outcomePremium: true, realizedPnL: true } }),
    ])

    return NextResponse.json({
      ok: true,
      rowCounts: { Signal: signalCount, OptionsSignal: optionsSignalCount, PoliticianTrade: politicianTradeCount },
      newColumnsPresent: optionsWithOutcomeField !== null || optionsSignalCount === 0,
      sampleRow: optionsWithOutcomeField,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
