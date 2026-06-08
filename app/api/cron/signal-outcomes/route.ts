import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const maxDuration = 60

const FINNHUB_KEY = process.env.FINNHUB_API_KEY

async function getQuote(ticker: string): Promise<number | null> {
  if (!FINNHUB_KEY) return null
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    return typeof data.c === 'number' && data.c > 0 ? data.c : null
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Find active signals whose time horizon has elapsed and outcome not yet set
    const now = new Date()

    // Get signals older than 1 day that are still active and have no outcome
    const signals = await prisma.signal.findMany({
      where: {
        isActive: true,
        outcome: null,
        signalDate: {
          lte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // at least 1 day old
        },
      },
      select: {
        id: true,
        ticker: true,
        targetPrice: true,
        stopLoss: true,
        entryZoneLow: true,
        entryZoneHigh: true,
        timeHorizon: true,
        signalDate: true,
        confidence: true,
      },
    })

    if (signals.length === 0) {
      return NextResponse.json({ message: 'No signals to evaluate', evaluated: 0 })
    }

    // Deduplicate tickers to minimize API calls
    const uniqueTickers = [...new Set(signals.map((s) => s.ticker))]
    const priceMap: Record<string, number | null> = {}

    // Fetch prices with small delay to avoid rate limiting
    for (const ticker of uniqueTickers) {
      priceMap[ticker] = await getQuote(ticker)
      await new Promise((r) => setTimeout(r, 150))
    }

    let evaluated = 0
    const updates: Array<{
      id: string
      outcome: string
      outcomePrice: number | null
      isActive: boolean
    }> = []

    for (const signal of signals) {
      const currentPrice = priceMap[signal.ticker]
      const ageMs = now.getTime() - signal.signalDate.getTime()
      const ageDays = ageMs / (1000 * 60 * 60 * 24)

      // Determine max age based on time horizon
      const horizon = signal.timeHorizon.toLowerCase()
      let maxAgeDays = 5 // default

      if (horizon.includes('intra') || horizon.includes('hour')) {
        maxAgeDays = 1
      } else if (horizon.includes('1') && horizon.includes('3')) {
        maxAgeDays = 3
      } else if (horizon.includes('momentum') || horizon.includes('week')) {
        maxAgeDays = 7
      } else if (horizon.includes('swing')) {
        maxAgeDays = 14
      } else if (horizon.includes('long') || horizon.includes('month')) {
        maxAgeDays = 45
      }

      let outcome: string | null = null

      if (currentPrice !== null) {
        if (currentPrice >= signal.targetPrice) {
          outcome = 'HIT_TARGET'
        } else if (currentPrice <= signal.stopLoss) {
          outcome = 'HIT_STOP'
        } else if (ageDays >= maxAgeDays) {
          // Signal expired without hitting target or stop
          outcome = 'EXPIRED'
        }
      } else if (ageDays >= maxAgeDays) {
        // No price data but signal is expired
        outcome = 'EXPIRED'
      }

      if (outcome) {
        updates.push({
          id: signal.id,
          outcome,
          outcomePrice: currentPrice,
          isActive: false,
        })
        evaluated++
      }
    }

    // Apply updates
    for (const update of updates) {
      await prisma.signal.update({
        where: { id: update.id },
        data: {
          outcome: update.outcome,
          outcomeCheckedAt: now,
          outcomePrice: update.outcomePrice ?? undefined,
          isActive: update.isActive,
        },
      })
    }

    console.log(`Signal outcomes: evaluated ${evaluated} signals`)
    return NextResponse.json({
      message: 'Success',
      evaluated,
      breakdown: {
        hit_target: updates.filter((u) => u.outcome === 'HIT_TARGET').length,
        hit_stop: updates.filter((u) => u.outcome === 'HIT_STOP').length,
        expired: updates.filter((u) => u.outcome === 'EXPIRED').length,
      },
    })
  } catch (err) {
    console.error('Signal outcomes cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
