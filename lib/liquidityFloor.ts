/**
 * Shared market-cap bands and liquidity floor. Single source of truth for
 * both the daily signal generator (cron/signals/route.ts, which trusts
 * whatever's already in TickerUniverse) and the weekly universe screen
 * (cron/universe-screen/route.ts, which does the actual admission
 * filtering) — the screen can never admit a ticker the generator would
 * then reject, because both read the same constants.
 *
 * Bands are non-overlapping and meet at $1B: large-cap requires market cap
 * STRICTLY greater than $1B; small/mid-cap is $10M up to AND INCLUDING $1B.
 * A company at exactly $1B market cap resolves to small/mid, never large.
 */
export const LARGE_CAP_MIN_MARKET_CAP = 1_000_000_000 // exclusive lower bound (> $1B)
export const SMALL_MID_MIN_MARKET_CAP = 10_000_000    // inclusive lower bound ($10M)
export const SMALL_MID_MAX_MARKET_CAP = 1_000_000_000 // inclusive upper bound (<= $1B)

// Minimum average 10-day dollar volume, computed as lastPrice x
// avg10DaysVolume from Schwab's batch fundamental data.
//
// SMALL_CAP_MIN_DOLLAR_VOLUME is $5M, not the originally-requested $1M —
// a live dry run against the $10M-$1B band showed $1M barely filtered
// anything (98.8% of qualified small/mid names traded under $50M/day).
// $5M keeps the small/mid floor at its pre-existing value while letting
// the market-cap band itself widen, instead of loosening both at once.
export const LARGE_CAP_MIN_DOLLAR_VOLUME = 1_000_000
export const SMALL_CAP_MIN_DOLLAR_VOLUME = 5_000_000
