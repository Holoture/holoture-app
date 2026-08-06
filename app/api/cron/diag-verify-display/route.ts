/** TEMPORARY — GET /api/cron/diag-verify-display — confirms zero isIncomplete:false rows have a missing field. Delete after use. */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const badDisplayed = await prisma.politicianTrade.count({
    where: {
      isIncomplete: false,
      OR: [
        { party: '' }, { party: 'Unknown' },
        { tradeType: '' }, { tradeType: 'UNKNOWN' },
        { amountRange: '' }, { amountRange: 'Unknown' },
      ],
    },
  })
  const displayedTotal = await prisma.politicianTrade.count({ where: { isIncomplete: false } })
  return NextResponse.json({ ok: true, displayedTotal, badDisplayed })
}
