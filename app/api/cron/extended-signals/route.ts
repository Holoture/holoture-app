/**
 * GET /api/cron/extended-signals
 *
 * Vetted premarket / after-hours signals — the first generator in this app
 * that actually reads Schwab's extended-session pricing. One route serves
 * both windows (see vercel.json: a premarket entry and an after-hours
 * entry); the route detects which session it's in and self-skips outside
 * them, exactly like cron/movers-snapshot.
 *
 * NOT the movers section. /movers is explicitly unfiltered raw price
 * movement with no liquidity floor and no BUY/WATCH/SHORT call. These are
 * signals: drawn only from the weekly-screened TickerUniverse, gated on
 * in-session liquidity, and carrying a real entry zone, target and stop.
 *
 * Standards are TIGHTER here than the regular session, never looser.
 * Extended sessions are thin and easy to push around, so a candidate must
 * clear BOTH floors:
 *   1. the daily-average dollar-volume floor — inherited by scanning only
 *      TickerUniverse, which is where that admission check already lives;
 *   2. an in-session floor (EXTENDED_MIN_*) on actual extended-session
 *      dollar volume, price, and last-print recency.
 * See lib/liquidityFloor.ts for why the daily floor alone is insufficient.
 *
 * As in cron/momentum, Claude never decides inclusion — every candidate has
 * already passed hard numeric gates before it is shown to the model, which
 * only writes the company name and thesis. Entry/target/stop/confidence are
 * computed mechanically, so confidence can never come back null.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { getExtendedHoursQuotes } from '@/lib/schwab'
import { classifyByMarketCap } from '@/lib/marketCapClassification'
import { getMarketSession } from '@/lib/marketSession'
import {
  EXTENDED_MIN_DOLLAR_VOLUME,
  EXTENDED_MIN_PRICE,
  EXTENDED_MAX_QUOTE_AGE_MIN,
} from '@/lib/liquidityFloor'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// ── Gates ────────────────────────────────────────────────────────────────────
// Starting values, to tune against live data — not gospel.

/** Minimum absolute % move vs. the regular-session baseline to be worth surfacing. */
const MIN_PCT_MOVE = 3
/** Hard cap on Claude calls per invocation. */
const MAX_CANDIDATES_PER_RUN = 6
/** Don't re-signal the same ticker while the same move is still developing. */
const REALERT_COOLDOWN_MIN = 120
/** Schwab batch /quotes tolerates ~500 symbols; stay well under. */
const CHUNK = 400

type Candidate = {
  ticker: string
  price: number
  pctMove: number
  extendedDollarVolume: number
  regularBaseline: number
  quoteAgeMin: number
}

type WrittenSignal = {
  ticker: string
  companyName: string
  thesis: string
  aiSummary: string
  sector: string
  catalyst: string
}

/**
 * Mechanical confidence — magnitude- and liquidity-driven, never AI-guessed
 * and never null. Floor of 55 matches MIN_CONFIDENCE in cron/signals so an
 * extended-hours signal is never weaker than the daily board's minimum bar.
 */
function computeConfidence(c: Candidate): number {
  const magnitude = Math.min(20, Math.abs(c.pctMove) * 2)
  const liquidity = Math.min(15, (c.extendedDollarVolume / 500_000) * 5)
  return Math.round(Math.min(90, 55 + magnitude + liquidity) * 10) / 10
}

async function writeTheses(
  candidates: Candidate[],
  session: 'premarket' | 'afterhours',
): Promise<Map<string, WrittenSignal>> {
  const out = new Map<string, WrittenSignal>()
  if (candidates.length === 0) return out
  const client = getAnthropicClient()

  const sessionLabel = session === 'premarket' ? 'premarket' : 'after-hours'
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `These stocks have ALREADY been quantitatively confirmed as significant ${sessionLabel} movers with real, verified ${sessionLabel} liquidity. Your job is ONLY to write the company name and a brief thesis for each. Do not second-guess inclusion; every one already passed hard numeric liquidity and magnitude filters.

For each, reply with a JSON array. Each object must have exactly these keys:
- ticker (string, echo back exactly)
- companyName (string, full company name)
- thesis (string, 1-2 sentences: WHY this stock is moving in the ${sessionLabel} session, if inferable, plus the key risk)
- aiSummary (string, 1 short sentence for a card headline)
- sector (string: "Technology", "Healthcare", "Finance", "Energy", "Consumer", "Industrials", "Defense", "Clean Energy", "Cryptocurrency", "Biotech", "Real Estate")
- catalyst (string, 1 sentence — your best inference of what's driving it; say "Unclear — no identified catalyst" if you don't have a specific reason)

Reply with a JSON array ONLY, no markdown.

Data (all values already confirmed real, from Schwab's ${sessionLabel} quote feed):
${JSON.stringify(candidates, null, 2)}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
  const ingest = (raw: string) => {
    const parsed = JSON.parse(raw) as WrittenSignal[]
    for (const s of parsed) if (s.ticker) out.set(s.ticker, s)
  }
  try {
    ingest(cleaned)
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (match) {
      try { ingest(match[0]) } catch { /* leave out empty */ }
    }
  }
  return out
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Operability escape hatch: ?force=premarket|afterhours runs the full
    // scan and reports what WOULD qualify, outside the normal windows.
    // force ALWAYS implies a dry run — it never calls Claude and never
    // writes, so a forced run can't persist signals tagged with a session
    // that isn't actually happening, or price a signal off a stale print.
    const url = new URL(req.url)
    const forced = url.searchParams.get('force')
    const isDryRun = forced === 'premarket' || forced === 'afterhours'

    // When forced, `session` is already one of the two extended values, so
    // the guard below is a no-op for a dry run and narrows the type for both
    // paths.
    const session = isDryRun ? (forced as 'premarket' | 'afterhours') : getMarketSession()
    if (session !== 'premarket' && session !== 'afterhours') {
      return NextResponse.json({ ok: true, skipped: 'not_an_extended_session', session })
    }

    // Universe = the weekly-screened pool. This is precisely how the
    // regular-session daily-average liquidity floor is inherited: a ticker
    // is only in TickerUniverse if it already cleared LARGE/SMALL_CAP_MIN_
    // DOLLAR_VOLUME during cron/universe-screen.
    const universeRows = await prisma.tickerUniverse.findMany({ select: { ticker: true } })
    const universe = universeRows.map((r) => r.ticker)
    if (universe.length === 0) {
      return NextResponse.json({ ok: true, session, scanned: 0, note: 'TickerUniverse empty — run cron/universe-screen' })
    }

    const cooldownCutoff = new Date(Date.now() - REALERT_COOLDOWN_MIN * 60 * 1000)
    const recentlyAlerted = await prisma.signal.findMany({
      where: { session, createdAt: { gte: cooldownCutoff } },
      select: { ticker: true },
    })
    const cooldownSet = new Set(recentlyAlerted.map((s) => s.ticker))

    // ── Batched extended-hours quote scan ──────────────────────────────────
    const chunks: string[][] = []
    for (let i = 0; i < universe.length; i += CHUNK) chunks.push(universe.slice(i, i + CHUNK))
    const quoteMaps = await Promise.all(chunks.map((c) => getExtendedHoursQuotes(c)))

    const now = Date.now()
    const candidates: Candidate[] = []
    // Every up-move that cleared cooldown+price, retained before the
    // magnitude/liquidity/staleness gates purely so a dry run can show how
    // far the real distribution sits from the thresholds. Calibrating
    // MIN_PCT_MOVE against actual near-misses beats guessing at it.
    const upMoves: Candidate[] = []
    const rejected = { cooldown: 0, price: 0, move: 0, volume: 0, stale: 0, direction: 0 }

    for (const map of quoteMaps) {
      for (const q of map.values()) {
        if (cooldownSet.has(q.symbol)) { rejected.cooldown++; continue }
        if (q.extendedLastPrice < EXTENDED_MIN_PRICE) { rejected.price++; continue }

        // Down moves are deliberately excluded for now: an extended-hours
        // SHORT is far less actionable for retail (borrow availability and
        // spreads are much worse outside regular hours), so surfacing one
        // as a signal with an entry zone would overstate how tradable it is.
        if (q.pctChange <= 0) { rejected.direction++; continue }

        const extendedDollarVolume = q.extendedLastPrice * q.extendedVolume
        const quoteAgeMin = (now - q.extendedTradeTime) / 60_000
        const cand: Candidate = {
          ticker: q.symbol,
          price: Math.round(q.extendedLastPrice * 100) / 100,
          pctMove: Math.round(q.pctChange * 100) / 100,
          extendedDollarVolume: Math.round(extendedDollarVolume),
          regularBaseline: Math.round(q.regularLastPrice * 100) / 100,
          quoteAgeMin: Math.round(quoteAgeMin * 10) / 10,
        }
        upMoves.push(cand)

        if (Math.abs(q.pctChange) < MIN_PCT_MOVE) { rejected.move++; continue }
        if (extendedDollarVolume < EXTENDED_MIN_DOLLAR_VOLUME) { rejected.volume++; continue }
        if (quoteAgeMin > EXTENDED_MAX_QUOTE_AGE_MIN || quoteAgeMin < 0) { rejected.stale++; continue }

        candidates.push(cand)
      }
    }

    candidates.sort((a, b) => Math.abs(b.pctMove) - Math.abs(a.pctMove))
    const shortlist = candidates.slice(0, MAX_CANDIDATES_PER_RUN)

    if (isDryRun) {
      return NextResponse.json({
        ok: true, dryRun: true, session,
        scanned: universe.length,
        qualified: candidates.length,
        wouldCreate: shortlist,
        rejected,
        thresholds: {
          MIN_PCT_MOVE,
          EXTENDED_MIN_DOLLAR_VOLUME,
          EXTENDED_MIN_PRICE,
          EXTENDED_MAX_QUOTE_AGE_MIN,
        },
        topUpMoves: [...upMoves].sort((a, b) => b.pctMove - a.pctMove).slice(0, 8),
      })
    }

    if (shortlist.length === 0) {
      return NextResponse.json({
        ok: true, session, scanned: universe.length, qualified: 0, created: 0, rejected,
      })
    }

    const [theses, capCategories] = await Promise.all([
      writeTheses(shortlist, session),
      classifyByMarketCap(shortlist.map((c) => c.ticker)),
    ])

    // Premarket ideas are meant to be traded into/after the 9:30 open, so
    // they're genuinely intraday. After-hours ideas can't touch a regular
    // session until the next day, so days_1_3 is the honest horizon — and
    // it also keeps them from being swept up by the dashboard's
    // "hide intraday signals after 4pm close" rule, which would otherwise
    // delete an after-hours signal the instant it was created.
    const timeframeCategory = session === 'premarket' ? 'intraday' : 'days_1_3'
    const timeHorizon = session === 'premarket' ? 'Intraday — from premarket' : 'Next session (1–3 days)'
    const sessionLabel = session === 'premarket' ? 'PREMARKET' : 'AFTER-HOURS'

    const created: string[] = []
    for (const c of shortlist) {
      const written = theses.get(c.ticker)
      if (!written) continue

      const entryZoneLow = c.price
      const entryZoneHigh = Math.round(c.price * 1.005 * 100) / 100
      const targetPrice = Math.round(c.price * 1.04 * 100) / 100
      const stopLoss = Math.round(c.price * 0.97 * 100) / 100
      const isLarge = capCategories.get(c.ticker) === 'large_cap'

      await prisma.signal.create({
        data: {
          ticker: c.ticker,
          companyName: written.companyName,
          signalType: 'BUY',
          entryZoneLow,
          entryZoneHigh,
          targetPrice,
          stopLoss,
          confidence: computeConfidence(c),
          timeHorizon,
          timeframeCategory,
          session,
          thesis: `${sessionLabel} SIGNAL — THIN SESSION, WIDE SPREADS. ${written.thesis} | Up ${c.pctMove}% vs the regular-session price of $${c.regularBaseline}, on $${c.extendedDollarVolume.toLocaleString()} of ${sessionLabel.toLowerCase()} volume (last print ${c.quoteAgeMin}m ago). Extended-hours liquidity is a fraction of regular hours — expect wider spreads, size smaller than usual, and be aware the move can fully reverse at the open.`,
          aiSummary: written.aiSummary,
          sector: written.sector,
          signalCategory: isLarge ? 'large_cap' : 'small_cap',
          marketCap: isLarge ? 15 : 2,
          bestEntryTime: session === 'premarket' ? 'At or shortly after the 9:30am open' : 'After-hours session or next open',
          expectedMove: `${c.pctMove}% so far this ${sessionLabel.toLowerCase()} session`,
          catalyst: written.catalyst,
          isActive: true,
          autoGenerated: true,
        },
      })
      created.push(c.ticker)
    }

    return NextResponse.json({
      ok: true,
      session,
      scanned: universe.length,
      qualified: candidates.length,
      shortlisted: shortlist.length,
      created: created.length,
      tickers: created,
      rejected,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/extended-signals]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
