// Temporary — inspecting the top realized-gain candidates to confirm the
// all-time winner is a real result and not a data artifact (bad
// outcomePrice, split, mis-recorded entry zone). Deleted after the check.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PUBLIC_TRACK_RECORD_FILTER } from '@/lib/publicStats'
import { realizedGainPercent } from '@/lib/weeklyFeatured'

export const dynamic = 'force-dynamic'

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await prisma.signal.findMany({
    where: { outcome: 'HIT_TARGET', outcomePrice: { not: null }, ...PUBLIC_TRACK_RECORD_FILTER },
    select: {
      ticker: true, signalType: true, entryZoneLow: true, entryZoneHigh: true,
      targetPrice: true, stopLoss: true, outcomePrice: true,
      signalDate: true, outcomeCheckedAt: true, timeframeCategory: true,
    },
  })

  const scored = rows.map((r) => ({
    ticker: r.ticker,
    type: r.signalType,
    entry: `${r.entryZoneLow}-${r.entryZoneHigh}`,
    entryMid: Math.round(((r.entryZoneLow + r.entryZoneHigh) / 2) * 100) / 100,
    target: r.targetPrice,
    stop: r.stopLoss,
    outcomePrice: r.outcomePrice,
    tf: r.timeframeCategory,
    opened: r.signalDate.toISOString().slice(0, 10),
    closed: r.outcomeCheckedAt?.toISOString().slice(0, 10) ?? null,
    gain: Math.round((realizedGainPercent({
      signalType: r.signalType,
      entryZoneLow: r.entryZoneLow,
      entryZoneHigh: r.entryZoneHigh,
      outcomePrice: r.outcomePrice!,
    }) ?? 0) * 100) / 100,
    // A target the signal itself set: if outcomePrice wildly exceeds target,
    // the price is suspect rather than the move being real.
    targetGainPct: Math.round((((r.targetPrice - (r.entryZoneLow + r.entryZoneHigh) / 2) / ((r.entryZoneLow + r.entryZoneHigh) / 2)) * 100) * 100) / 100,
  }))

  scored.sort((a, b) => b.gain - a.gain)
  return NextResponse.json({ total: scored.length, top: scored.slice(0, 8) })
}
