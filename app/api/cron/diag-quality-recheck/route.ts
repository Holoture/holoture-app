/** TEMPORARY — GET /api/cron/diag-quality-recheck — post-rescrape field-quality check. Delete after use. */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [total, partyUnknown, tradeTypeUnknown, amountUnknown, incomplete, displayable] = await Promise.all([
    prisma.politicianTrade.count(),
    prisma.politicianTrade.count({ where: { OR: [{ party: '' }, { party: 'Unknown' }] } }),
    prisma.politicianTrade.count({ where: { OR: [{ tradeType: '' }, { tradeType: 'UNKNOWN' }] } }),
    prisma.politicianTrade.count({ where: { OR: [{ amountRange: '' }, { amountRange: 'Unknown' }] } }),
    prisma.politicianTrade.count({ where: { isIncomplete: true } }),
    prisma.politicianTrade.count({ where: { isIncomplete: false } }),
  ])
  const badDisplayed = await prisma.politicianTrade.count({
    where: { isIncomplete: false, OR: [{ party: 'Unknown' }, { tradeType: 'UNKNOWN' }, { amountRange: 'Unknown' }] },
  })
  return NextResponse.json({ ok: true, total, partyUnknown, tradeTypeUnknown, amountUnknown, incomplete, displayable, badDisplayed })
}
