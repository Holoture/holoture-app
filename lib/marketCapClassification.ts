/**
 * Real, live market-cap classification for signal-category tagging
 * (large_cap vs small_cap on the signal board). Replaces several
 * independent hardcoded ticker lists that used to live in
 * momentum/route.ts, intraday-signals/route.ts, and
 * components/SignalBoardClient.tsx — those lists were built under the old
 * >$10B large-cap definition and never updated when the universe screen's
 * bands moved to >$1B, so tickers like HOOD/SOFI/RIOT that have since
 * crossed $1B were still being hardcoded as small_cap regardless of their
 * actual market cap. This queries Schwab's real per-symbol market cap
 * instead of trusting any static list.
 */
import { getInstrumentFundamental } from './schwab'
import { LARGE_CAP_MIN_MARKET_CAP } from './liquidityFloor'

export type MarketCapCategory = 'large_cap' | 'small_cap'

/**
 * Classifies each ticker by real market cap > $1B (large_cap) or not
 * (small_cap). Tickers whose market cap can't be fetched default to
 * small_cap — the conservative choice, since it's the pre-existing default
 * these routes used for anything not on their old hardcoded lists.
 */
export async function classifyByMarketCap(tickers: string[]): Promise<Map<string, MarketCapCategory>> {
  const out = new Map<string, MarketCapCategory>()
  const unique = [...new Set(tickers)]
  const results = await Promise.all(
    unique.map(async (ticker) => {
      const fundamental = await getInstrumentFundamental(ticker)
      const category: MarketCapCategory =
        fundamental?.marketCap != null && fundamental.marketCap > LARGE_CAP_MIN_MARKET_CAP
          ? 'large_cap'
          : 'small_cap'
      return [ticker, category] as const
    })
  )
  for (const [ticker, category] of results) out.set(ticker, category)
  return out
}
