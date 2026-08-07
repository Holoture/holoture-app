/** TEMPORARY — GET /api/cron/diag-momentum-confidence — real confidence values on momentum signals. Delete after use. */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await prisma.signal.findMany({
    where: { timeframeCategory: 'momentum' },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, ticker: true, confidence: true, isMomentumSpike: true, isActive: true, timeframeCategory: true, createdAt: true },
  })
  const nullOrZero = rows.filter((r) => r.confidence == null || r.confidence === 0).length
  return NextResponse.json({ ok: true, count: rows.length, nullOrZero, rows })
}
