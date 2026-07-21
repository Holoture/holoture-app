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
  const [premarketCount, afterhoursCount, premarketTop, afterhoursTop] = await Promise.all([
    prisma.moverSnapshot.count({ where: { session: 'premarket' } }),
    prisma.moverSnapshot.count({ where: { session: 'afterhours' } }),
    prisma.moverSnapshot.findFirst({ where: { session: 'premarket' }, orderBy: { pctChange: 'desc' } }),
    prisma.moverSnapshot.findFirst({ where: { session: 'afterhours' }, orderBy: { pctChange: 'desc' } }),
  ])
  return NextResponse.json({ premarketCount, afterhoursCount, premarketTop, afterhoursTop })
}
