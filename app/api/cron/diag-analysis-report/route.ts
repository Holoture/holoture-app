import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// READ-ONLY diagnostic, Phase 1c re-run on corrected data. No writes.
export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allClosedSignals = await prisma.signal.findMany({
    where: { outcome: { in: ['HIT_TARGET', 'HIT_STOP', 'EXPIRED'] } }, // UNVERIFIABLE excluded from all win-rate math
    select: {
      id: true, ticker: true, signalType: true, signalCategory: true,
      timeframeCategory: true, confidence: true, createdAt: true,
      outcome: true, outcomeCheckedAt: true, outcomePrice: true,
      entryZoneLow: true, entryZoneHigh: true, targetPrice: true, stopLoss: true,
    },
  })
  const unverifiableCount = await prisma.signal.count({ where: { outcome: 'UNVERIFIABLE' } })

  function pctMove(s: (typeof allClosedSignals)[number]): number | null {
    if (s.outcomePrice == null) return null
    const mid = (s.entryZoneLow + s.entryZoneHigh) / 2
    if (mid <= 0) return null
    const raw = ((s.outcomePrice - mid) / mid) * 100
    return (s.signalType === 'SHORT' || s.signalType === 'SELL') ? -raw : raw
  }

  const categories = ['intraday', 'days_1_3', 'swing', 'long_term', 'momentum', 'null'] as const
  const outcomeByCategory: Record<string, unknown> = {}
  for (const cat of categories) {
    const rows = allClosedSignals.filter((s) => (s.timeframeCategory ?? 'null') === cat)
    const hitTarget = rows.filter((r) => r.outcome === 'HIT_TARGET')
    const hitStop = rows.filter((r) => r.outcome === 'HIT_STOP')
    const expired = rows.filter((r) => r.outcome === 'EXPIRED')
    const total = rows.length
    const winRate = total > 0 ? hitTarget.length / total : null

    const timesToOutcome = rows
      .filter((r) => r.outcomeCheckedAt)
      .map((r) => (r.outcomeCheckedAt!.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    const avgDaysToOutcome = timesToOutcome.length > 0
      ? timesToOutcome.reduce((a, b) => a + b, 0) / timesToOutcome.length
      : null

    const winMoves = hitTarget.map(pctMove).filter((v): v is number => v !== null)
    const lossMoves = hitStop.map(pctMove).filter((v): v is number => v !== null)
    const avgWinPct = winMoves.length > 0 ? winMoves.reduce((a, b) => a + b, 0) / winMoves.length : null
    const avgLossPct = lossMoves.length > 0 ? lossMoves.reduce((a, b) => a + b, 0) / lossMoves.length : null

    const lossRate = total > 0 ? hitStop.length / total : null
    const expectancy = (winRate !== null && avgWinPct !== null && lossRate !== null && avgLossPct !== null)
      ? (winRate * avgWinPct) - (lossRate * Math.abs(avgLossPct))
      : null

    outcomeByCategory[cat] = {
      sampleSize: total,
      reliableSample: total >= 25,
      hitTarget: hitTarget.length,
      hitStop: hitStop.length,
      expired: expired.length,
      winRate: winRate !== null ? Math.round(winRate * 1000) / 10 : null,
      avgDaysToOutcome: avgDaysToOutcome !== null ? Math.round(avgDaysToOutcome * 100) / 100 : null,
      avgWinPct: avgWinPct !== null ? Math.round(avgWinPct * 100) / 100 : null,
      avgLossPct: avgLossPct !== null ? Math.round(avgLossPct * 100) / 100 : null,
      expectancyPct: expectancy !== null ? Math.round(expectancy * 100) / 100 : null,
    }
  }

  const buckets = [
    { label: '<50', min: 0, max: 50 },
    { label: '50-60', min: 50, max: 60 },
    { label: '60-70', min: 60, max: 70 },
    { label: '70-80', min: 70, max: 80 },
    { label: '80+', min: 80, max: 1000 },
  ]
  const confidenceBuckets = buckets.map((b) => {
    const rows = allClosedSignals.filter((s) => s.confidence >= b.min && s.confidence < b.max)
    const hit = rows.filter((r) => r.outcome === 'HIT_TARGET').length
    const total = rows.length
    return {
      bucket: b.label,
      sampleSize: total,
      winRate: total > 0 ? Math.round((hit / total) * 1000) / 10 : null,
    }
  })

  // SHORT-specific breakdown, since that's exactly what changed
  const shortRows = allClosedSignals.filter((s) => s.signalType === 'SHORT' || s.signalType === 'SELL')
  const shortHit = shortRows.filter((r) => r.outcome === 'HIT_TARGET').length
  const shortStop = shortRows.filter((r) => r.outcome === 'HIT_STOP').length
  const shortExpired = shortRows.filter((r) => r.outcome === 'EXPIRED').length

  return NextResponse.json({
    outcomesByCategory: outcomeByCategory,
    confidenceBuckets,
    shortSignalBreakdown: {
      total: shortRows.length,
      hitTarget: shortHit,
      hitStop: shortStop,
      expired: shortExpired,
      winRate: shortRows.length > 0 ? Math.round((shortHit / shortRows.length) * 1000) / 10 : null,
    },
    unverifiableCount,
    totalClosedAllTime: allClosedSignals.length,
  })
}
