/**
 * GET /api/cron/options-outcomes
 *
 * Daily outcome checker for OptionsSignal — the equivalent of
 * cron/signal-outcomes, but options mechanics don't fit that cron's
 * day-count/HIT_TARGET/HIT_STOP/EXPIRED model (see the outcome enum's doc
 * comment on OptionsSignal in schema.prisma), so this is a separate cron
 * rather than an extension of that one. Never touches equity Signal rows;
 * equity signal-outcomes never touches OptionsSignal rows.
 *
 * Two evaluation paths per unresolved (outcome: null) signal:
 *
 * 1. NOT YET EXPIRED — fetch the live chain for this ticker scoped to a
 *    narrow window covering just this contract's expiration (reuses
 *    lib/schwab.ts#getOptionChain, not rebuilt), find the exact optionSymbol,
 *    and check its current mark against OPTIONS_TAKE_PROFIT_MULTIPLE. This
 *    is a take-profit heuristic (2x premium = 100% gain), not a stored
 *    per-signal target — OptionsSignal has no targetPremium field, and
 *    retrofitting one onto 412 existing rows with no real target on record
 *    would be a bigger, separate decision. Documented here rather than
 *    silently assumed. If the contract isn't found in the chain response
 *    (can happen if the underlying moved far enough that it fell outside
 *    the requested strike window), the signal is left pending and re-checked
 *    next run.
 *
 * 2. AT OR PAST EXPIRATION — an expired option isn't quotable anymore, so
 *    outcome is determined by the UNDERLYING's current price vs. strike
 *    (intrinsic value), not a chain lookup. This is a same-day-or-later
 *    proxy for the actual expiration-day close, same "checked shortly after
 *    the fact" approach cron/signal-outcomes already uses for EXPIRED.
 *
 * PUBLIC_TRACK_RECORD_FILTER (isManual: false) isn't applied here — this
 * cron resolves outcomes for every real signal, manual or not, same as
 * cron/signal-outcomes does for equity. The exclusion happens at READ time,
 * in whatever query eventually powers a public options track-record surface
 * (none exists yet), exactly like Signal.isManual.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOptionChain, getQuotes } from '@/lib/schwab'

export const maxDuration = 60

const OPTIONS_TAKE_PROFIT_MULTIPLE = 2.0 // 100% premium gain

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

function pnlPct(outcomePremium: number, premiumEstimate: number): number {
  if (premiumEstimate <= 0) return 0
  return Math.round(((outcomePremium - premiumEstimate) / premiumEstimate) * 1000) / 10
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const pending = await prisma.optionsSignal.findMany({
      where: { outcome: null },
      select: {
        id: true, ticker: true, optionSymbol: true, contractType: true,
        strikePrice: true, expirationDate: true, premiumEstimate: true,
      },
    })

    if (pending.length === 0) {
      return NextResponse.json({ ok: true, evaluated: 0 })
    }

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    const notYetExpired = pending.filter((s) => s.expirationDate >= todayStr)
    const pastExpiration = pending.filter((s) => s.expirationDate < todayStr)

    const updates: { id: string; outcome: string; outcomePremium: number; realizedPnL: number }[] = []

    // ── Path 1: not yet expired — check for early take-profit ──────────────
    const tickersToCheck = [...new Set(notYetExpired.map((s) => s.ticker))]
    const chainsByTicker = new Map<string, Awaited<ReturnType<typeof getOptionChain>>>()
    for (const ticker of tickersToCheck) {
      // Widen the window per-ticker to cover every distinct expiration this
      // ticker still has pending, rather than one call per signal.
      const expirations = notYetExpired.filter((s) => s.ticker === ticker).map((s) => s.expirationDate)
      const fromDate = todayStr
      const toDate = expirations.sort().at(-1)!
      const chain = await getOptionChain(ticker, { fromDate, toDate })
      chainsByTicker.set(ticker, chain)
    }

    for (const s of notYetExpired) {
      const chain = chainsByTicker.get(s.ticker)
      const contract = chain?.contracts.find((c) => c.symbol === s.optionSymbol)
      if (!contract || contract.mark <= 0) continue // not found this run — leave pending

      if (contract.mark >= s.premiumEstimate * OPTIONS_TAKE_PROFIT_MULTIPLE) {
        updates.push({
          id: s.id,
          outcome: 'HIT_TARGET',
          outcomePremium: contract.mark,
          realizedPnL: pnlPct(contract.mark, s.premiumEstimate),
        })
      }
    }

    // ── Path 2: at/past expiration — resolve by underlying vs. strike ──────
    if (pastExpiration.length > 0) {
      const underlyingTickers = [...new Set(pastExpiration.map((s) => s.ticker))]
      const quotes = await getQuotes(underlyingTickers)

      for (const s of pastExpiration) {
        const q = quotes.get(s.ticker)
        if (!q || q.lastPrice <= 0) continue // no quote this run — leave pending, retry next run

        const isCall = s.contractType === 'CALL'
        const intrinsic = isCall
          ? Math.max(0, q.lastPrice - s.strikePrice)
          : Math.max(0, s.strikePrice - q.lastPrice)

        if (intrinsic <= 0) {
          updates.push({ id: s.id, outcome: 'EXPIRED_WORTHLESS', outcomePremium: 0, realizedPnL: -100 })
        } else {
          updates.push({
            id: s.id,
            outcome: 'EXPIRED_ITM',
            outcomePremium: Math.round(intrinsic * 100) / 100,
            realizedPnL: pnlPct(intrinsic, s.premiumEstimate),
          })
        }
      }
    }

    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map((u) =>
          prisma.optionsSignal.update({
            where: { id: u.id },
            data: {
              outcome: u.outcome,
              outcomeCheckedAt: now,
              outcomePremium: u.outcomePremium,
              realizedPnL: u.realizedPnL,
              isActive: false,
            },
          }),
        ),
      )
    }

    return NextResponse.json({
      ok: true,
      evaluated: pending.length,
      resolved: updates.length,
      breakdown: {
        hit_target: updates.filter((u) => u.outcome === 'HIT_TARGET').length,
        expired_worthless: updates.filter((u) => u.outcome === 'EXPIRED_WORTHLESS').length,
        expired_itm: updates.filter((u) => u.outcome === 'EXPIRED_ITM').length,
      },
      stillPending: pending.length - updates.length,
    })
  } catch (err) {
    console.error('[cron/options-outcomes]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
