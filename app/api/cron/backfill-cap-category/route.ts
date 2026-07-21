import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { classifyByMarketCap } from '@/lib/marketCapClassification'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// One-time correction: existing active signals were tagged large_cap/
// small_cap by the stale hardcoded lists momentum/route.ts and
// intraday-signals/route.ts used before this fix. Re-classifies every
// currently-active signal by real live market cap and corrects any that
// were wrong. Not a recurring cron — delete after running once.
export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const active = await prisma.signal.findMany({
      where: { isActive: true },
      select: { id: true, ticker: true, signalCategory: true },
    })
    const tickers = [...new Set(active.map((s) => s.ticker))]
    const categories = await classifyByMarketCap(tickers)

    const toFix = active.filter((s) => {
      const real = categories.get(s.ticker)
      return real && real !== s.signalCategory
    })

    if (toFix.length > 0) {
      await prisma.$transaction(
        toFix.map((s) =>
          prisma.signal.update({
            where: { id: s.id },
            data: {
              signalCategory: categories.get(s.ticker),
              marketCap: categories.get(s.ticker) === 'large_cap' ? 15 : 2,
            },
          })
        )
      )
    }

    return NextResponse.json({
      ok: true,
      totalActive: active.length,
      uniqueTickers: tickers.length,
      corrected: toFix.length,
      correctedTickers: toFix.map((s) => s.ticker),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/backfill-cap-category]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
