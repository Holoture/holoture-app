/**
 * TEMPORARY DIAGNOSTIC — GET /api/cron/diag-trade-quality
 *
 * Real counts of PoliticianTrade rows with missing/unknown party, tradeType,
 * or amountRange, plus samples so the root cause (genuinely absent from
 * source vs. a parser/lookup bug) can be judged from real data. Report-only.
 * Delete after use.
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
    const total = await prisma.politicianTrade.count()

    const [partyUnknown, tradeTypeUnknown, amountUnknown] = await Promise.all([
      prisma.politicianTrade.count({ where: { OR: [{ party: '' }, { party: 'Unknown' }] } }),
      prisma.politicianTrade.count({ where: { OR: [{ tradeType: '' }, { tradeType: 'UNKNOWN' }] } }),
      prisma.politicianTrade.count({ where: { OR: [{ amountRange: '' }, { amountRange: 'Unknown' }] } }),
    ])

    const distinctParty = await prisma.$queryRaw<{ party: string; count: bigint }[]>`
      SELECT party, COUNT(*) as count FROM "PoliticianTrade" GROUP BY party ORDER BY count DESC
    `
    const distinctTradeType = await prisma.$queryRaw<{ tradeType: string; count: bigint }[]>`
      SELECT "tradeType", COUNT(*) as count FROM "PoliticianTrade" GROUP BY "tradeType" ORDER BY count DESC
    `
    const distinctAmount = await prisma.$queryRaw<{ amountRange: string; count: bigint }[]>`
      SELECT "amountRange", COUNT(*) as count FROM "PoliticianTrade" GROUP BY "amountRange" ORDER BY count DESC LIMIT 20
    `

    // Sample rows for each broken field so the failure mode can be inspected
    const partySamples = await prisma.politicianTrade.findMany({
      where: { OR: [{ party: '' }, { party: 'Unknown' }] },
      select: { politicianName: true, party: true, chamber: true, ticker: true, assetType: true, fetchedAt: true },
      distinct: ['politicianName'],
      take: 40,
    })
    const tradeTypeSamples = await prisma.politicianTrade.findMany({
      where: { OR: [{ tradeType: '' }, { tradeType: 'UNKNOWN' }] },
      select: { politicianName: true, tradeType: true, ticker: true, assetType: true, externalId: true },
      take: 20,
    })
    const amountSamples = await prisma.politicianTrade.findMany({
      where: { OR: [{ amountRange: '' }, { amountRange: 'Unknown' }] },
      select: { politicianName: true, amountRange: true, ticker: true, assetType: true, externalId: true },
      take: 20,
    })

    // Cross-tab: how many rows are missing MORE THAN ONE field (compounding issue)
    const missingMultiple = await prisma.politicianTrade.count({
      where: {
        AND: [
          { OR: [{ party: '' }, { party: 'Unknown' }] },
          { OR: [{ tradeType: '' }, { tradeType: 'UNKNOWN' }] },
        ],
      },
    })

    return NextResponse.json({
      ok: true,
      totalRows: total,
      counts: { partyUnknown, tradeTypeUnknown, amountUnknown, missingPartyAndTradeType: missingMultiple },
      distinctParty: distinctParty.map((d) => ({ party: d.party, count: Number(d.count) })),
      distinctTradeType: distinctTradeType.map((d) => ({ tradeType: d.tradeType, count: Number(d.count) })),
      distinctAmountTop20: distinctAmount.map((d) => ({ amountRange: d.amountRange, count: Number(d.count) })),
      partySamples,
      tradeTypeSamples,
      amountSamples,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
