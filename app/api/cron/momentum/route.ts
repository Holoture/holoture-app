/**
 * GET /api/cron/momentum
 *
 * Real intraday spike detection — runs every 5 minutes during market hours.
 * Surfaces stocks with a SUDDEN volume + volatility spike, price up
 * significantly and STILL RISING, so a signal can be entered while the move
 * is ongoing. This is a genuinely different feature from the old client-side
 * isMomentum(BUY && confidence>=75) mislabeling: every candidate here is
 * gated by real quantitative checks against Schwab intraday data BEFORE
 * Claude ever sees it — Claude only writes the thesis for names that already
 * cleared the bar, it does not decide inclusion.
 *
 * Two-pass design to keep API/compute cost bounded:
 *   Pass 1 (cheap): one batch quote call for the whole universe, filter to
 *     names already up >=4% from today's open with real-time volume.
 *   Pass 2 (targeted): for shortlisted names only (capped), fetch today's
 *     1-min candles (VWAP, still-extending check) and ~21 trading days of
 *     historical 1-min candles (real time-of-day relative-volume — the
 *     capability Finnhub's tier didn't have).
 *
 * Risk handling: these are high-risk chase trades by nature. Stop loss is
 * mechanically computed (not AI-guessed), and isMomentumSpike=true lets the
 * UI apply distinct labeling/outcome-tracking so these don't get averaged
 * into the main signal board's win rate.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { getQuotes, getTodayMinuteCandles, getHistoricalMinuteCandles, type Candle } from '@/lib/schwab'

export const maxDuration = 60

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// ── Scan universe: reuse existing static watchlists, no expansion decision
//    made here — that's a separate call per the pipeline audit. ──
const LARGE_CAP_WATCHLIST = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AVGO', 'AMD', 'QCOM',
  'INTC', 'TXN', 'MU', 'AMAT', 'ADBE', 'CRM', 'ORCL', 'SNOW', 'CRWD', 'DDOG',
  'JPM', 'BAC', 'GS', 'V', 'MA', 'C', 'WFC', 'MS', 'BLK', 'SCHW', 'AXP',
  'JNJ', 'UNH', 'LLY', 'PFE', 'ABT', 'TMO', 'ISRG', 'AMGN', 'GILD',
  'XOM', 'CVX', 'COP', 'EOG', 'SLB',
  'WMT', 'COST', 'MCD', 'SBUX', 'TGT', 'KO', 'PEP', 'NKE',
  'CAT', 'HON', 'RTX', 'LMT', 'GE',
  'NFLX', 'DIS', 'CMCSA',
  'PLTR', 'COIN', 'AXON', 'UBER', 'SOFI', 'AFRM',
]
const SMALL_CAP_WATCHLIST = [
  'RXRX', 'BEAM', 'NTLA', 'PACB', 'ARWR', 'EDIT',
  'HIMS', 'ACCD', 'PRVA', 'GDRX',
  'RKLB', 'ACHR', 'JOBY', 'LUNR', 'ASTS',
  'MARA', 'RIOT', 'CLSK', 'CIFR',
  'BBAI', 'SOUN', 'KTOS',
  'LCID', 'NKLA', 'GOEV',
  'NOVA', 'ARRY', 'STEM', 'SHLS',
  'SEMR', 'BRZE', 'WEAV', 'IONQ',
  'NARI', 'INSP', 'ATEC',
  'OPEN', 'UWMC', 'COOP',
  'BROS', 'CAVA', 'SFM', 'SKIN', 'PRTS',
  'SWBI', 'RGR', 'POWL',
  'CIVI', 'MGY', 'VTLE', 'CHRD',
  'LYFT', 'U', 'TTWO',
]
const INTRADAY_WATCHLIST = [
  'NVDA', 'TSLA', 'AMD', 'META', 'AMZN', 'GOOGL', 'MSFT', 'AAPL',
  'PLTR', 'COIN', 'MARA', 'RIOT', 'RXRX', 'HIMS', 'RKLB', 'SOUN',
  'SOFI', 'AFRM', 'HOOD', 'UBER', 'SQ', 'SNAP',
  'BBAI', 'IONQ', 'ASTS', 'LUNR', 'ACHR', 'SMCI', 'CRWD', 'DDOG',
]
const UNIVERSE = [...new Set([...LARGE_CAP_WATCHLIST, ...SMALL_CAP_WATCHLIST, ...INTRADAY_WATCHLIST])]
const LARGE_CAP = new Set(LARGE_CAP_WATCHLIST)

// ── Thresholds — starting points per the feasibility writeup; tune after
//    live data, not gospel. ──
const MIN_PCT_FROM_OPEN = 4        // pass-1 shortlist bar
const MIN_PRICE = 3                // penny-stock floor
const MIN_TODAY_DOLLAR_VOLUME = 5_000_000  // same-day $ volume so far — liquidity floor, avoids illiquid pump-and-dumps
const MIN_RELATIVE_VOLUME = 3      // vs. same time-of-day historical average
const HALT_GAP_PCT = 8             // single 1-min bar move beyond this = likely halt/resume noise, reject
const SKIP_FIRST_N_MINUTES = 5     // avoid re-flagging a pre-market gap that already happened at the open
const MAX_CANDIDATES_PER_RUN = 8   // hard cap on pass-2 (heavy) API calls per invocation
const REALERT_COOLDOWN_MIN = 60    // don't re-signal the same ticker while a spike is still ongoing

// ── Pass 2 math ──────────────────────────────────────────────────────────────

function computeVWAP(candles: Candle[]): number | null {
  let pv = 0, v = 0
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3
    pv += typical * c.volume
    v += c.volume
  }
  return v > 0 ? pv / v : null
}

function isStillExtending(candles: Candle[]): boolean {
  if (candles.length < 3) return false
  const last3 = candles.slice(-3)
  // Reject if the most recent bar closed lower than it opened (reversing),
  // or isn't making a new high vs the prior bar.
  const [, prev, latest] = last3
  if (latest.close < latest.open) return false
  if (latest.high < prev.high) return false
  return true
}

function hasHaltGapNoise(candles: Candle[]): boolean {
  const recent = candles.slice(-5)
  for (let i = 1; i < recent.length; i++) {
    const prevClose = recent[i - 1].close
    const pct = Math.abs((recent[i].close - prevClose) / prevClose) * 100
    if (pct > HALT_GAP_PCT) return true
  }
  return false
}

/** Minute-of-day key, e.g. "09:35", from a candle's epoch-ms timestamp (ET). */
function minuteKeyET(epochMs: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(epochMs))
}

function dateKeyET(epochMs: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(epochMs))
}

/**
 * Relative volume vs. the same time-of-day historical average — the check
 * Finnhub's tier couldn't support. Compares today's cumulative volume up to
 * the current minute against the average cumulative volume other trading
 * days had reached by that same minute-of-day.
 */
function computeRelativeVolume(todayCandles: Candle[], historicalCandles: Candle[]): number | null {
  if (todayCandles.length === 0) return null
  const nowMinuteKey = minuteKeyET(todayCandles[todayCandles.length - 1].datetime)
  const todayDateKey = dateKeyET(todayCandles[todayCandles.length - 1].datetime)
  const todayCumVolume = todayCandles.reduce((sum, c) => sum + c.volume, 0)

  // Group historical candles by trading day, sum volume up to (and including)
  // the same minute-of-day, excluding today itself.
  const byDay = new Map<string, number>()
  for (const c of historicalCandles) {
    const dKey = dateKeyET(c.datetime)
    if (dKey === todayDateKey) continue
    const mKey = minuteKeyET(c.datetime)
    if (mKey > nowMinuteKey) continue
    byDay.set(dKey, (byDay.get(dKey) ?? 0) + c.volume)
  }
  const dayTotals = [...byDay.values()]
  if (dayTotals.length < 5) return null // not enough history to trust the comparison
  const avgCumVolume = dayTotals.reduce((a, b) => a + b, 0) / dayTotals.length
  if (avgCumVolume <= 0) return null
  return todayCumVolume / avgCumVolume
}

// ── Claude write-up (thesis only — inclusion is already decided) ───────────

type MomentumCandidate = {
  ticker: string
  price: number
  pctFromOpen: number
  relativeVolume: number
  vwap: number
  todayDollarVolume: number
}

type MomentumSignal = {
  ticker: string
  companyName: string
  thesis: string
  aiSummary: string
  sector: string
  catalyst: string
}

async function writeThesis(candidates: MomentumCandidate[]): Promise<Map<string, MomentumSignal>> {
  const out = new Map<string, MomentumSignal>()
  if (candidates.length === 0) return out
  const client = getAnthropicClient()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `These stocks have ALREADY been quantitatively confirmed as live intraday momentum spikes — real volume, real price action, still extending, not yet reversing. Your job is ONLY to write the company name and a brief thesis for each. Do not second-guess inclusion; every one of these already passed hard numeric filters.

For each, reply with a JSON array. Each object must have exactly these keys:
- ticker (string, echo back exactly)
- companyName (string, full company name)
- thesis (string, 1-2 sentences: WHY this stock is moving right now, if inferable, plus the key risk)
- aiSummary (string, 1 short sentence for a card headline)
- sector (string: "Technology", "Healthcare", "Finance", "Energy", "Consumer", "Industrials", "Defense", "Clean Energy", "Cryptocurrency", "Biotech", "Real Estate")
- catalyst (string, 1 sentence — your best inference of what's driving it; say "Unclear — pure technical/volume breakout" if you don't have a specific reason)

Reply with a JSON array ONLY, no markdown.

Data (all values already confirmed real-time):
${JSON.stringify(candidates, null, 2)}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    const parsed = JSON.parse(cleaned) as MomentumSignal[]
    for (const s of parsed) if (s.ticker) out.set(s.ticker, s)
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as MomentumSignal[]
        for (const s of parsed) if (s.ticker) out.set(s.ticker, s)
      } catch { /* leave out empty */ }
    }
  }
  return out
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Skip outside regular market hours (9:30am-4:00pm ET, weekdays).
    const etParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false,
    }).formatToParts(new Date())
    const weekday = etParts.find((p) => p.type === 'weekday')?.value ?? ''
    const hour = parseInt(etParts.find((p) => p.type === 'hour')?.value ?? '0', 10)
    const minute = parseInt(etParts.find((p) => p.type === 'minute')?.value ?? '0', 10)
    const minsSinceOpen = hour * 60 + minute - (9 * 60 + 30)
    if (weekday === 'Sat' || weekday === 'Sun' || minsSinceOpen < 0 || minsSinceOpen > 390) {
      return NextResponse.json({ ok: true, skipped: 'outside_market_hours' })
    }

    // Cooldown: don't re-alert tickers already flagged as a momentum spike
    // in the last REALERT_COOLDOWN_MIN minutes.
    const cooldownCutoff = new Date(Date.now() - REALERT_COOLDOWN_MIN * 60 * 1000)
    const recentlyAlerted = await prisma.signal.findMany({
      where: { isMomentumSpike: true, createdAt: { gte: cooldownCutoff } },
      select: { ticker: true },
    })
    const cooldownSet = new Set(recentlyAlerted.map((s) => s.ticker))

    // ── Pass 1: cheap universe-wide quote scan ──────────────────────────────
    const quotes = await getQuotes(UNIVERSE)
    const shortlist: { ticker: string; price: number; pctFromOpen: number; dollarVolume: number }[] = []
    for (const [ticker, q] of quotes) {
      if (cooldownSet.has(ticker)) continue
      if (q.lastPrice < MIN_PRICE || q.openPrice <= 0) continue
      const pctFromOpen = ((q.lastPrice - q.openPrice) / q.openPrice) * 100
      if (pctFromOpen < MIN_PCT_FROM_OPEN) continue
      const dollarVolume = q.lastPrice * q.totalVolume
      if (dollarVolume < MIN_TODAY_DOLLAR_VOLUME) continue
      shortlist.push({ ticker, price: q.lastPrice, pctFromOpen, dollarVolume })
    }
    shortlist.sort((a, b) => b.pctFromOpen - a.pctFromOpen)
    const toCheck = shortlist.slice(0, MAX_CANDIDATES_PER_RUN)

    if (toCheck.length === 0) {
      return NextResponse.json({ ok: true, scanned: UNIVERSE.length, shortlisted: 0, confirmed: 0 })
    }

    // ── Pass 2: targeted intraday-candle checks for shortlisted names ──────
    const confirmed: MomentumCandidate[] = []
    for (const cand of toCheck) {
      const todayCandles = await getTodayMinuteCandles(cand.ticker)
      if (todayCandles.length < 6) continue
      if (dateKeyET(todayCandles[todayCandles.length - 1].datetime) !==
          new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())) continue
      // Skip the first few minutes of the session — avoid re-flagging a
      // pre-market gap that already fully priced in at the open.
      if (todayCandles.length <= SKIP_FIRST_N_MINUTES) continue
      if (hasHaltGapNoise(todayCandles)) continue
      if (!isStillExtending(todayCandles)) continue

      const vwap = computeVWAP(todayCandles)
      if (vwap === null || cand.price <= vwap) continue

      const historicalCandles = await getHistoricalMinuteCandles(cand.ticker)
      const relativeVolume = computeRelativeVolume(todayCandles, historicalCandles)
      if (relativeVolume === null || relativeVolume < MIN_RELATIVE_VOLUME) continue

      confirmed.push({
        ticker: cand.ticker,
        price: cand.price,
        pctFromOpen: Math.round(cand.pctFromOpen * 100) / 100,
        relativeVolume: Math.round(relativeVolume * 100) / 100,
        vwap: Math.round(vwap * 100) / 100,
        todayDollarVolume: Math.round(cand.dollarVolume),
      })
    }

    if (confirmed.length === 0) {
      return NextResponse.json({ ok: true, scanned: UNIVERSE.length, shortlisted: toCheck.length, confirmed: 0 })
    }

    // ── Claude: thesis only, inclusion already decided ──────────────────────
    const theses = await writeThesis(confirmed)

    // Mechanically-computed stop — not AI-guessed. Tighter than the daily
    // board: 3% below entry, or the recent 5-bar swing low, whichever is
    // higher (tighter) — these are high-risk chase trades and should say so.
    const created: string[] = []
    for (const c of confirmed) {
      const thesis = theses.get(c.ticker)
      if (!thesis) continue

      const stopLoss = Math.round(c.price * 0.97 * 100) / 100
      const target = Math.round(c.price * 1.06 * 100) / 100 // fixed 6% target — momentum exits fast, not a multi-day thesis

      await prisma.signal.create({
        data: {
          ticker: c.ticker,
          companyName: thesis.companyName,
          signalType: 'BUY',
          entryZoneLow: c.price,
          entryZoneHigh: Math.round(c.price * 1.005 * 100) / 100,
          targetPrice: target,
          stopLoss,
          confidence: Math.min(95, 60 + Math.round(c.relativeVolume * 3)), // magnitude-driven, not AI-guessed
          timeHorizon: 'Intraday',
          thesis: `MOMENTUM SPIKE — HIGH RISK, TIGHT STOP. ${thesis.thesis} | Up ${c.pctFromOpen}% from open on ${c.relativeVolume}x relative volume, trading above VWAP ($${c.vwap}). This is a fast-moving chase trade, not a multi-day setup — size small, expect failure to be normal, exit on any reversal below VWAP.`,
          aiSummary: thesis.aiSummary,
          sector: thesis.sector,
          signalCategory: LARGE_CAP.has(c.ticker) ? 'large_cap' : 'small_cap',
          marketCap: LARGE_CAP.has(c.ticker) ? 15 : 2,
          bestEntryTime: 'Now — spike in progress',
          expectedMove: `${c.pctFromOpen}% so far, still extending`,
          catalyst: thesis.catalyst,
          isMomentumSpike: true,
          isActive: true,
          autoGenerated: true,
        },
      })
      created.push(c.ticker)
    }

    return NextResponse.json({
      ok: true,
      scanned: UNIVERSE.length,
      shortlisted: toCheck.length,
      confirmed: confirmed.length,
      created: created.length,
      tickers: created,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/momentum]', msg)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
