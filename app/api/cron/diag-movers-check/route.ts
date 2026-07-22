import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

const TARGETS = ['LSTA', 'ZYBT', 'SGRP', 'GORO', 'FWRD', 'RPT', 'GOAI', 'JUNS', 'HIHO', 'SLGB', 'KIDZ', 'CDTG', 'GVH', 'LBGJ', 'DHR', 'UTZ', 'VIVK', 'CIGL', 'XPON']

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const found = await prisma.moverSnapshot.findMany({
    where: { session: 'afterhours', ticker: { in: TARGETS } },
    select: { ticker: true, pctChange: true, dollarChange: true },
  })
  const foundTickers = new Set(found.map((f) => f.ticker))
  const missing = TARGETS.filter((t) => !foundTickers.has(t))
  return NextResponse.json({ found, missing })
}
