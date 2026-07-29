/**
 * GET /api/cron/weekly-featured
 *
 * Picks the single best-performing CLOSED signal from the trailing 7 days
 * for the landing page's weekly showcase. Runs Sunday night alongside
 * cron/universe-screen.
 *
 * Eligibility is deliberately narrow — this is a published performance
 * claim, so anything that would inflate or misattribute it is excluded:
 *   - outcome must be HIT_TARGET (never open/pending, EXPIRED, HIT_STOP,
 *     LEFT_ZONE, or UNVERIFIABLE)
 *   - isManual must be false — algorithm output only, same rule the public
 *     outcomes strip enforces via lib/publicStats.ts
 *   - outcomePrice must be present, since realized gain is computed from the
 *     REAL price at outcome, not the target price the signal aimed at
 *
 * If nothing qualifies, NOTHING is written. There is deliberately no
 * fallback to an older winner or a "least bad" signal — an honest empty
 * week beats a cherry-picked one, and the UI renders an explicit
 * "no signals closed at target this week" state.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PUBLIC_TRACK_RECORD_FILTER } from '@/lib/publicStats'
import { realizedGainPercent, weekStartET } from '@/lib/weeklyFeatured'

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
    const now = new Date()
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const candidates = await prisma.signal.findMany({
      where: {
        outcome: 'HIT_TARGET',
        outcomePrice: { not: null },
        outcomeCheckedAt: { gte: since },
        ...PUBLIC_TRACK_RECORD_FILTER,
      },
      select: {
        id: true, ticker: true, signalType: true,
        entryZoneLow: true, entryZoneHigh: true, outcomePrice: true,
      },
    })

    if (candidates.length === 0) {
      return NextResponse.json({ ok: true, candidates: 0, selected: null, note: 'no signals closed at target in the trailing 7 days' })
    }

    let best: { id: string; ticker: string; gain: number } | null = null
    for (const c of candidates) {
      if (c.outcomePrice === null) continue
      const gain = realizedGainPercent({
        signalType: c.signalType,
        entryZoneLow: c.entryZoneLow,
        entryZoneHigh: c.entryZoneHigh,
        outcomePrice: c.outcomePrice,
      })
      if (gain === null) continue
      if (!best || gain > best.gain) best = { id: c.id, ticker: c.ticker, gain }
    }

    if (!best) {
      return NextResponse.json({ ok: true, candidates: candidates.length, selected: null, note: 'no candidate produced a computable realized gain' })
    }

    const weekStartDate = weekStartET(now)
    await prisma.weeklyFeaturedSignal.upsert({
      where: { weekStartDate },
      create: { signalId: best.id, weekStartDate, realizedGainPercent: best.gain },
      update: { signalId: best.id, realizedGainPercent: best.gain, selectedAt: new Date() },
    })

    return NextResponse.json({
      ok: true,
      candidates: candidates.length,
      selected: { ticker: best.ticker, realizedGainPercent: Math.round(best.gain * 100) / 100 },
      weekStartDate: weekStartDate.toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/weekly-featured]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
