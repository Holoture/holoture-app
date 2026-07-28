// Temporary diagnostic — audits active signals for missing/invalid confidence
// values, grouped by timeframeCategory. Uses $queryRaw so a literal NULL in
// the confidence column (which Prisma's typed client would refuse to
// deserialize into its non-nullable Float field) doesn't crash the query.
// Deleted after the one-time audit this was built for.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

type Row = { timeframeCategory: string | null; confidence: number | null; count: bigint }

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const totalActive = await prisma.signal.count({ where: { isActive: true } })

  const bad = await prisma.$queryRaw<Row[]>`
    SELECT "timeframeCategory", confidence, COUNT(*) as count
    FROM "Signal"
    WHERE "isActive" = true
      AND (confidence IS NULL OR confidence != confidence OR confidence < 0 OR confidence > 100)
    GROUP BY "timeframeCategory", confidence
  `

  const byCategory: Record<string, number> = {}
  let totalBad = 0
  for (const r of bad) {
    const key = r.timeframeCategory ?? 'null_category'
    const n = Number(r.count)
    byCategory[key] = (byCategory[key] ?? 0) + n
    totalBad += n
  }

  const sampleIds = totalBad > 0
    ? await prisma.$queryRaw<{ id: string; ticker: string; timeframeCategory: string | null; confidence: number | null }[]>`
        SELECT id, ticker, "timeframeCategory", confidence
        FROM "Signal"
        WHERE "isActive" = true
          AND (confidence IS NULL OR confidence != confidence OR confidence < 0 OR confidence > 100)
        LIMIT 50
      `
    : []

  return NextResponse.json({ totalActive, totalBad, byCategory, sample: sampleIds })
}
