/**
 * Shared liquidity floor (Task 4): minimum average daily DOLLAR volume,
 * computed as lastPrice x avg10DaysVolume from Schwab's batch fundamental
 * data. Single source of truth — both the daily signal generator
 * (cron/signals/route.ts) and the weekly universe screen
 * (cron/universe-screen/route.ts) must apply the exact same thresholds, so
 * the screen can never admit a ticker the generator would then reject.
 */
export const LARGE_CAP_MIN_DOLLAR_VOLUME = 20_000_000
export const SMALL_CAP_MIN_DOLLAR_VOLUME = 5_000_000
