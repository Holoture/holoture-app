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
  const rows = await prisma.moverSnapshot.findMany({
    where: { session: 'afterhours' },
    orderBy: { pctChange: 'desc' },
    take: 10,
  })
  return NextResponse.json(rows)
}
