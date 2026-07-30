// Temporary — inspecting GS's real daily candles to confirm whether the
// 105% peak-gain figure reflects a real price move or corrupt candle data.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDailyCandles } from '@/lib/schwab'

export const dynamic = 'force-dynamic'

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const signal = await prisma.signal.findFirst({
    where: { ticker: 'GS', outcome: 'HIT_TARGET' },
    select: { id: true, entryZoneLow: true, entryZoneHigh: true, signalDate: true, targetPrice: true, outcomePrice: true },
  })
  const candles = await getDailyCandles('GS')
  const sincePosting = signal
    ? candles.filter((c) => c.datetime >= signal.signalDate.getTime())
    : []

  const sorted = [...sincePosting].sort((a, b) => b.high - a.high)

  return NextResponse.json({
    signal,
    totalCandles: candles.length,
    sincePostingCount: sincePosting.length,
    top5ByHigh: sorted.slice(0, 5).map((c) => ({ ...c, date: new Date(c.datetime).toISOString().slice(0, 10) })),
    allSincePosting: sincePosting.map((c) => ({ ...c, date: new Date(c.datetime).toISOString().slice(0, 10) })),
  })
}
