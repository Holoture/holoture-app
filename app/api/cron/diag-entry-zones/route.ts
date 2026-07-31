/**
 * TEMPORARY DIAGNOSTIC — GET /api/cron/diag-entry-zones
 *
 * Audits entry-zone staleness across the FULL signal dataset (all outcomes,
 * including currently OPEN signals), not just HIT_TARGET. For each signal,
 * compares storedEntryZone midpoint vs. the real Schwab candle midpoint
 * at/near signalDate using the same >25% divergence threshold as
 * lib/weeklyFeatured.ts's isEntryPriceTrustworthy. Report-only — does not
 * write any fixes. Delete this route after use.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDailyCandles } from '@/lib/schwab'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

function splitLikeness(ratio: number): string | null {
  const candidates = [2, 3, 1.5, 4, 2.5, 5, 7, 10]
  for (const c of candidates) {
    if (Math.abs(ratio - c) / c < 0.08) return `~${c}x`
    if (Math.abs(ratio - 1 / c) / (1 / c) < 0.08) return `~1/${c}x`
  }
  return null
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const signals = await prisma.signal.findMany({
      select: {
        id: true, ticker: true, signalType: true, outcome: true, isActive: true,
        entryZoneLow: true, entryZoneHigh: true, signalDate: true,
      },
    })

    const uniqueTickers = [...new Set(signals.map((s) => s.ticker))]
    const candlesByTicker = new Map(
      await Promise.all(uniqueTickers.map(async (t) => [t, await getDailyCandles(t)] as const)),
    )

    let checked = 0
    const diverging: {
      id: string; ticker: string; outcome: string | null; isActive: boolean
      storedMid: number; realMid: number; divergencePct: number
      ratio: number; splitLike: string | null
    }[] = []
    let noCandleData = 0

    for (const s of signals) {
      const allCandles = candlesByTicker.get(s.ticker) ?? []
      const sincePosting = allCandles.filter((c) => c.datetime >= s.signalDate.getTime())
      const ref = sincePosting[0] ?? allCandles[allCandles.length - 1]
      if (!ref) { noCandleData++; continue }

      const storedMid = (s.entryZoneLow + s.entryZoneHigh) / 2
      const realMid = (ref.high + ref.low) / 2
      if (!Number.isFinite(storedMid) || storedMid <= 0 || !Number.isFinite(realMid) || realMid <= 0) continue

      checked++
      const divergencePct = (Math.abs(storedMid - realMid) / realMid) * 100
      if (divergencePct > 25) {
        const ratio = realMid / storedMid
        diverging.push({
          id: s.id, ticker: s.ticker, outcome: s.outcome, isActive: s.isActive,
          storedMid: Math.round(storedMid * 100) / 100,
          realMid: Math.round(realMid * 100) / 100,
          divergencePct: Math.round(divergencePct * 10) / 10,
          ratio: Math.round(ratio * 100) / 100,
          splitLike: splitLikeness(ratio),
        })
      }
    }

    diverging.sort((a, b) => b.divergencePct - a.divergencePct)

    return NextResponse.json({
      ok: true,
      totalSignals: signals.length,
      checked,
      noCandleData,
      divergingCount: diverging.length,
      openDivergingCount: diverging.filter((d) => d.isActive && d.outcome === null).length,
      diverging,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/diag-entry-zones]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
