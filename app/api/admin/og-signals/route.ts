import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, tooManyRequests, ADMIN_LIMIT, ADMIN_WINDOW_MS } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET() {
  // ── Auth: admin only ────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Rate limiting: 20 / minute / admin ─────────────────────────────────────
  const rl = checkRateLimit(`admin-og-signals:${userId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  const signals = await prisma.signal.findMany({
    where: { isActive: true },
    orderBy: [{ confidence: 'desc' }, { signalDate: 'desc' }],
    take: 50,
    select: {
      id: true,
      ticker: true,
      companyName: true,
      signalType: true,
      entryZoneLow: true,
      entryZoneHigh: true,
      targetPrice: true,
      stopLoss: true,
      confidence: true,
      timeHorizon: true,
      thesis: true,
      aiSummary: true,
      sector: true,
      signalDate: true,
    },
  })

  return NextResponse.json(
    signals.map((s) => ({
      ...s,
      signalDate: s.signalDate.toISOString(),
    }))
  )
}
