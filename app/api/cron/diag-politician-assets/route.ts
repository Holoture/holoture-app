/**
 * TEMPORARY DIAGNOSTIC — GET /api/cron/diag-politician-assets
 *
 * Answers Step 2's first question directly from the DB: does
 * PoliticianTrade currently contain any options-related records, or is our
 * scraper equity-only? tradeType is free text (not a fielded asset-type
 * code), so this reports the distinct values actually present plus a
 * keyword scan for option-like language. Report-only. Delete after use.
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

    const distinctTradeTypes = await prisma.$queryRaw<{ tradeType: string; count: bigint }[]>`
      SELECT "tradeType", COUNT(*) as count FROM "PoliticianTrade"
      GROUP BY "tradeType" ORDER BY count DESC
    `

    // Keyword scan across ticker/companyName/tradeType for option-like language
    // ("call", "put", "option", "strike") — a free-text approximation since
    // there's no dedicated assetType/optionType column to query directly.
    const optionLike = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) FROM "PoliticianTrade"
      WHERE "tradeType" ILIKE '%option%' OR "tradeType" ILIKE '%call%' OR "tradeType" ILIKE '%put%'
        OR "companyName" ILIKE '%option%' OR "companyName" ILIKE '% call%' OR "companyName" ILIKE '% put %'
    `

    const sampleOptionLike = await prisma.politicianTrade.findMany({
      where: {
        OR: [
          { tradeType: { contains: 'option', mode: 'insensitive' } },
          { tradeType: { contains: 'call', mode: 'insensitive' } },
          { tradeType: { contains: 'put', mode: 'insensitive' } },
          { companyName: { contains: 'option', mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: { ticker: true, companyName: true, tradeType: true, politicianName: true },
    })

    return NextResponse.json({
      ok: true,
      totalRows: total,
      distinctTradeTypes: distinctTradeTypes.map((r) => ({ tradeType: r.tradeType, count: Number(r.count) })),
      optionLikeRowCount: Number(optionLike[0]?.count ?? 0),
      sampleOptionLikeRows: sampleOptionLike,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
