/**
 * TEMPORARY diagnostic route — read-only, no writes. Confirms whether any
 * Signal row has ever existed with session = 'premarket' or 'afterhours'.
 * Delete after use.
 */
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

  const [premarketEver, afterhoursEver, premarketActive, afterhoursActive, sample] = await Promise.all([
    prisma.signal.count({ where: { session: 'premarket' } }),
    prisma.signal.count({ where: { session: 'afterhours' } }),
    prisma.signal.count({ where: { session: 'premarket', isActive: true } }),
    prisma.signal.count({ where: { session: 'afterhours', isActive: true } }),
    prisma.signal.findMany({
      where: { OR: [{ session: 'premarket' }, { session: 'afterhours' }] },
      select: { ticker: true, session: true, createdAt: true },
      take: 5,
    }),
  ])

  return NextResponse.json({ premarketEver, afterhoursEver, premarketActive, afterhoursActive, sample })
}
