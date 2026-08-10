/**
 * GET /api/snaptrade/holdings
 *
 * Real brokerage holdings for the current user, read live from SnapTrade
 * (lib/snaptrade.ts#getHoldings -> accountInformation.listUserAccounts +
 * accountInformation.getAllAccountPositions per account — the confirmed-
 * working, non-deprecated positions endpoint). Server-side only; the
 * SnapTrade userSecret never leaves lib/snaptrade.ts.
 */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getHoldings } from '@/lib/snaptrade'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, tooManyRequests, DEFAULT_LIMIT, DEFAULT_WINDOW_MS } from '@/lib/rate-limit'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = checkRateLimit(`snaptrade-holdings:${userId}`, DEFAULT_LIMIT, DEFAULT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  try {
    const accounts = await getHoldings(userId)
    if (accounts === null) {
      return NextResponse.json({ connected: false, accounts: [] })
    }

    // Cross-reference held tickers against Holoture's own active signals —
    // "does the platform currently have a live view on anything I hold."
    const heldTickers = [...new Set(accounts.flatMap((a) => a.positions.map((p) => p.symbol)))]
    const activeSignals = heldTickers.length
      ? await prisma.signal.findMany({
          where: { ticker: { in: heldTickers }, isActive: true },
          select: { ticker: true, signalType: true, confidence: true, targetPrice: true },
          orderBy: { confidence: 'desc' },
        })
      : []

    return NextResponse.json({ connected: true, accounts, activeSignals })
  } catch (err) {
    console.error('[snaptrade/holdings]', err)
    return NextResponse.json({ error: 'Failed to load holdings from your brokerage' }, { status: 502 })
  }
}
