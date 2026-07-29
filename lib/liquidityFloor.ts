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

// ── Extended-session (premarket / after-hours) additional floor ──────────────
//
// The floors above are computed from avg10DaysVolume — a FULL-DAY average.
// Extended sessions typically trade 1-5% of daily volume, so that average
// says nothing about whether a name is liquid *right now*, in this session:
// a stock can average $50M/day and still trade $80k premarket on a
// dollar-wide spread. Applying the daily figure to extended volume directly
// would instead reject essentially everything.
//
// So extended-hours signals must clear BOTH: the daily-average floor (via
// TickerUniverse membership, which is where that admission check already
// happens) AND the in-session floor below. That is strictly TIGHTER than
// the regular-session bar, never looser — extended sessions are thinner and
// more easily manipulated, so the guardrails matter more here, not less.
//
// NOTE: the in-session floor does NOT use extended.totalVolume — a live raw
// payload dump (against BABA, verified in production) showed that field is
// 0 on every symbol on this Schwab entitlement, extended session or not.
// It is not a usable traded-volume figure here. Bid/ask spread width and
// last-print trade size (both present and populated in the same payload)
// are the liquidity proxies used instead: a thin/manipulated book shows up
// as a wide spread and/or a small last-print size, which is exactly the
// failure mode the daily-average floor can't catch in an extended session.
//
// Starting values, to tune against live data — not gospel.
export const EXTENDED_MAX_SPREAD_PCT = 1.5     // bid/ask spread as % of mid — wider than this = too thin/manipulable to trust
export const EXTENDED_MIN_LAST_TRADE_DOLLARS = 5_000 // lastPrice x lastSize of the most recent print — a real trade actually happened at real size
export const EXTENDED_MIN_PRICE = 3            // penny-stock floor, same as the momentum scanner
export const EXTENDED_MAX_QUOTE_AGE_MIN = 20   // reject stale prints — a 20min-old last trade is itself a liquidity warning
