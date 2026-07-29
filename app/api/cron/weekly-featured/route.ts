/**
 * GET /api/cron/weekly-featured
 *
 * Picks the single highest-gaining CLOSED signal of ALL TIME for the
 * landing page showcase. Re-runs weekly (Sunday night, alongside
 * cron/universe-screen) so a new record is picked up when one is set —
 * the WEEKLY part is the refresh cadence, not the selection window.
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
 * If nothing qualifies, NOTHING is written — the UI renders an explicit
 * empty state rather than falling back to a weaker result.
 *
 * NOTE: an all-time best is by construction the most favourable single
 * result available, so the card that renders it leads with "Best result to
 * date" and links to the full win/loss record. That pairing is what keeps
 * this from reading as a representative outcome.
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

    // No date window — the pool is every qualifying signal ever recorded.
    const candidates = await prisma.signal.findMany({
      where: {
        outcome: 'HIT_TARGET',
        outcomePrice: { not: null },
        ...PUBLIC_TRACK_RECORD_FILTER,
      },
      select: {
        id: true, ticker: true, signalType: true,
        entryZoneLow: true, entryZoneHigh: true, outcomePrice: true,
      },
    })

    if (candidates.length === 0) {
      return NextResponse.json({ ok: true, candidates: 0, selected: null, note: 'no signals have closed at target yet' })
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
