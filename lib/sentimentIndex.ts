/**
 * Holoture Market Sentiment Index — composite 0-100 score, NOT a
 * reproduction of CNN's Fear & Greed Index (no public/licensed API for
 * that, and reproducing its name/methodology would create the same
 * redistribution risk this project has deliberately avoided with other
 * third-party data sources, e.g. declining Quiver Quantitative).
 *
 * Five weighted components, each mapped to its own 0-100 sub-score, all
 * computed from data this app can already legitimately access:
 *   - Breadth      (30%) — % of TickerUniverse above its 50-day SMA
 *   - Momentum     (25%) — SPY price vs. its own 50-day SMA
 *   - Volatility   (20%) — SPY realized volatility, 20-session, INVERTED
 *                           (high vol = fear = low score)
 *   - Signal mix   (15%) — our own BUY vs SHORT ratio, trailing 5 sessions
 *   - Safe-haven   (10%) — HYG vs TLT trailing-10-session return spread
 *
 * No stored price history exists anywhere in this app's DB (LiveQuoteCache
 * and MoverSnapshot both overwrite in place) — every price-based component
 * here is computed from a fresh Schwab getDailyCandles() call, same as
 * cron/signals' own indicator math (unchanged SMA formula, reused here).
 *
 * VIX is deliberately NOT used: no code in this app has ever called Schwab
 * with a VIX ticker, so whether it even resolves is unverified. Realized
 * volatility of SPY itself is used instead — a component this app can
 * actually prove works, not a guess.
 */
import { getDailyCandles, type Candle } from './schwab'
import { prisma } from './prisma'

export type ComponentBreakdown = {
  breadth: { score: number; weight: number; raw: { aboveSma50: number; total: number; pct: number } }
  momentum: { score: number; weight: number; raw: { spyClose: number; sma50: number; deviationPct: number } }
  volatility: { score: number; weight: number; raw: { annualizedVolPct: number } }
  signalMix: { score: number; weight: number; raw: { buyCount: number; shortCount: number } }
  safeHaven: { score: number; weight: number; raw: { hygReturnPct: number; tltReturnPct: number; spreadPct: number } }
}

export type SentimentResult = { score: number; label: string; breakdown: ComponentBreakdown }

const WEIGHTS = { breadth: 0.30, momentum: 0.25, volatility: 0.20, signalMix: 0.15, safeHaven: 0.10 }

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function computeSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  return closes.slice(-period).reduce((a, b) => a + b, 0) / period
}

/** Annualized stdev of daily log returns over the trailing `period` sessions, as a percent. */
function computeRealizedVolPct(closes: number[], period = 20): number | null {
  if (closes.length < period + 1) return null
  const recent = closes.slice(-(period + 1))
  const returns: number[] = []
  for (let i = 1; i < recent.length; i++) {
    returns.push(Math.log(recent[i] / recent[i - 1]))
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length
  const dailyStd = Math.sqrt(variance)
  return dailyStd * Math.sqrt(252) * 100 // 252 trading days/year, annualized
}

/** % return from the close `sessionsAgo` trading days back to the latest close. */
function trailingReturnPct(closes: number[], sessionsAgo: number): number | null {
  if (closes.length < sessionsAgo + 1) return null
  const start = closes[closes.length - 1 - sessionsAgo]
  const end = closes[closes.length - 1]
  if (!(start > 0)) return null
  return ((end - start) / start) * 100
}

function labelFor(score: number): string {
  if (score <= 24) return 'Extreme Fear'
  if (score <= 44) return 'Fear'
  if (score <= 55) return 'Neutral'
  if (score <= 75) return 'Greed'
  return 'Extreme Greed'
}

/** Fetches getDailyCandles for many tickers in small concurrent batches — no existing
 *  infra in this app fetches candles for hundreds of tickers at once (cron/signals only
 *  ever does 20 via a single Promise.all), so an unbounded Promise.all here risked
 *  hitting Schwab's rate limit. Batches of 20, sequential across batches; a failed
 *  fetch for one ticker is swallowed (empty array), never fails the batch. */
async function fetchCandlesBatched(tickers: string[], batchSize = 20): Promise<Map<string, Candle[]>> {
  const result = new Map<string, Candle[]>()
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize)
    const candleArrays = await Promise.all(
      batch.map((t) => getDailyCandles(t).catch(() => [] as Candle[])),
    )
    batch.forEach((t, idx) => result.set(t, candleArrays[idx]))
  }
  return result
}

export async function computeSentimentIndex(): Promise<SentimentResult> {
  // ── Breadth: % of the weekly-screened universe above its own 50-day SMA ──
  const universe = await prisma.tickerUniverse.findMany({ select: { ticker: true } })
  const universeCandles = await fetchCandlesBatched(universe.map((u) => u.ticker))
  let aboveSma50 = 0
  let breadthTotal = 0
  for (const candles of universeCandles.values()) {
    const closes = candles.map((c) => c.close)
    if (closes.length < 50) continue
    const sma50 = computeSMA(closes, 50)
    if (sma50 == null) continue
    breadthTotal++
    if (closes[closes.length - 1] > sma50) aboveSma50++
  }
  const breadthPct = breadthTotal > 0 ? (aboveSma50 / breadthTotal) * 100 : 50
  const breadthScore = clamp(breadthPct, 0, 100)

  // ── Momentum + Volatility: both derived from SPY's own daily candles ──
  const spyCandles = await getDailyCandles('SPY').catch(() => [] as Candle[])
  const spyCloses = spyCandles.map((c) => c.close)
  const spyClose = spyCloses[spyCloses.length - 1] ?? 0
  const spySma50 = computeSMA(spyCloses, 50) ?? spyClose
  const deviationPct = spySma50 > 0 ? ((spyClose - spySma50) / spySma50) * 100 : 0
  const momentumScore = clamp(((deviationPct + 10) / 20) * 100, 0, 100)

  const annualizedVolPct = computeRealizedVolPct(spyCloses, 20) ?? 20
  const volatilityScore = clamp(((40 - annualizedVolPct) / 30) * 100, 0, 100)

  // ── Signal mix: our own algorithm's real recent output, BUY vs SHORT ──
  const fiveSessionsAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
  const [buyCount, shortCount] = await Promise.all([
    prisma.signal.count({ where: { signalType: 'BUY', isManual: false, createdAt: { gte: fiveSessionsAgo } } }),
    prisma.signal.count({ where: { signalType: 'SHORT', isManual: false, createdAt: { gte: fiveSessionsAgo } } }),
  ])
  const signalMixScore = (buyCount + shortCount) > 0
    ? clamp((buyCount / (buyCount + shortCount)) * 100, 0, 100)
    : 50

  // ── Safe-haven: HYG (junk bonds, risk-on) vs TLT (long treasuries, risk-off) ──
  const [hygCandles, tltCandles] = await Promise.all([
    getDailyCandles('HYG').catch(() => [] as Candle[]),
    getDailyCandles('TLT').catch(() => [] as Candle[]),
  ])
  const hygReturnPct = trailingReturnPct(hygCandles.map((c) => c.close), 10) ?? 0
  const tltReturnPct = trailingReturnPct(tltCandles.map((c) => c.close), 10) ?? 0
  const spreadPct = hygReturnPct - tltReturnPct
  const safeHavenScore = clamp(((spreadPct + 5) / 10) * 100, 0, 100)

  const composite = Math.round(
    breadthScore * WEIGHTS.breadth +
    momentumScore * WEIGHTS.momentum +
    volatilityScore * WEIGHTS.volatility +
    signalMixScore * WEIGHTS.signalMix +
    safeHavenScore * WEIGHTS.safeHaven,
  )
  const score = clamp(composite, 0, 100)

  const breakdown: ComponentBreakdown = {
    breadth: { score: Math.round(breadthScore), weight: WEIGHTS.breadth, raw: { aboveSma50, total: breadthTotal, pct: Math.round(breadthPct * 10) / 10 } },
    momentum: { score: Math.round(momentumScore), weight: WEIGHTS.momentum, raw: { spyClose: Math.round(spyClose * 100) / 100, sma50: Math.round(spySma50 * 100) / 100, deviationPct: Math.round(deviationPct * 10) / 10 } },
    volatility: { score: Math.round(volatilityScore), weight: WEIGHTS.volatility, raw: { annualizedVolPct: Math.round(annualizedVolPct * 10) / 10 } },
    signalMix: { score: Math.round(signalMixScore), weight: WEIGHTS.signalMix, raw: { buyCount, shortCount } },
    safeHaven: { score: Math.round(safeHavenScore), weight: WEIGHTS.safeHaven, raw: { hygReturnPct: Math.round(hygReturnPct * 10) / 10, tltReturnPct: Math.round(tltReturnPct * 10) / 10, spreadPct: Math.round(spreadPct * 10) / 10 } },
  }

  return { score, label: labelFor(score), breakdown }
}

/** Truncates to UTC midnight so the unique `date` constraint gives exactly one row/day regardless of what time the cron actually runs. */
export function todayUtcMidnight(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export async function getLatestSentimentIndex() {
  try {
    return await prisma.marketSentimentIndex.findFirst({ orderBy: { date: 'desc' } })
  } catch { return null }
}
