/**
 * GET /api/cron/hero-diag   (TEMPORARY — delete after Phase 3 diagnostic check)
 *
 * Reports how many active Signal rows have complete hero-ready data
 * (ticker, entry zone, target, stop loss, confidence), plus counts from
 * PoliticianTrade for the hero's checkable-specifics micro-line.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  if (req.headers.get('x-diag-token') !== 'ht-hero-diag-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const totalActive = await prisma.signal.count({ where: { isActive: true } })

  const complete = await prisma.signal.count({
    where: {
      isActive: true,
      ticker: { not: '' },
      entryZoneLow: { gt: 0 },
      entryZoneHigh: { gt: 0 },
      targetPrice: { gt: 0 },
      stopLoss: { gt: 0 },
      confidence: { gt: 0 },
    },
  })

  const sample = await prisma.signal.findMany({
    where: {
      isActive: true,
      ticker: { not: '' },
      entryZoneLow: { gt: 0 },
      targetPrice: { gt: 0 },
      stopLoss: { gt: 0 },
      confidence: { gt: 0 },
    },
    orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
    take: 3,
    select: {
      id: true, ticker: true, companyName: true, signalType: true,
      entryZoneLow: true, entryZoneHigh: true, targetPrice: true, stopLoss: true,
      confidence: true, timeHorizon: true, aiSummary: true, signalDate: true, createdAt: true,
    },
  })

  const politicianTotal = await prisma.politicianTrade.count()
  const politicianDistinct = (
    await prisma.politicianTrade.findMany({ distinct: ['politicianName'], select: { politicianName: true } })
  ).length

  return NextResponse.json({
    signal: { totalActive, complete },
    sample,
    politician: { total: politicianTotal, distinctMembers: politicianDistinct },
  })
}
