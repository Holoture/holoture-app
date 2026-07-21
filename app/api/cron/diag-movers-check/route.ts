import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [afterhoursTotal, afterhoursAbove4, premarketTotal, premarketAbove4] = await Promise.all([
    prisma.moverSnapshot.count({ where: { session: 'afterhours' } }),
    prisma.moverSnapshot.count({ where: { session: 'afterhours', OR: [{ pctChange: { gte: 4 } }, { pctChange: { lte: -4 } }] } }),
    prisma.moverSnapshot.count({ where: { session: 'premarket' } }),
    prisma.moverSnapshot.count({ where: { session: 'premarket', OR: [{ pctChange: { gte: 4 } }, { pctChange: { lte: -4 } }] } }),
  ])
  return NextResponse.json({ afterhoursTotal, afterhoursAbove4, premarketTotal, premarketAbove4 })
}
