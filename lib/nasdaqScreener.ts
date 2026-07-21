/**
 * NASDAQ's public screener endpoint (api.nasdaq.com/api/screener/stocks) —
 * used only for weekly universe screening, not the daily signal path.
 *
 * Why this instead of Schwab: Schwab's API has no market-cap/volume
 * screener (verified against schwab-py's full get_instruments projection
 * enum — SYMBOL_SEARCH, SYMBOL_REGEX, DESCRIPTION_SEARCH, DESCRIPTION_REGEX,
 * SEARCH, FUNDAMENTAL — none numeric-filterable). NASDAQ's screener is
 * unauthenticated, filterable by both market-cap band AND sector
 * simultaneously, and returns real market cap directly. Schwab is still
 * used downstream (getQuotesWithFundamentals) to verify live liquidity
 * before a candidate is admitted to the universe — this module only
 * supplies the candidate list + sector tag.
 */

const SCREENER_BASE = 'https://api.nasdaq.com/api/screener/stocks'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'

export const NASDAQ_SECTORS = [
  'technology',
  'telecommunications',
  'health_care',
  'finance',
  'real_estate',
  'consumer_discretionary',
  'consumer_staples',
  'industrials',
  'basic_materials',
  'energy',
  'utilities',
] as const

export type NasdaqSector = (typeof NASDAQ_SECTORS)[number]

// NASDAQ's own fixed bucket categories. Our target bands ($1B boundary,
// $10M floor) don't align to these boundaries, so callers fetch whichever
// buckets can contain their band and then filter by the real numeric
// marketCap value returned per ticker (see screenBand's min/max params) —
// bucket selection here is just "which pages to fetch," not the actual
// admission filter.
type NasdaqMarketCapBucket = 'mega' | 'large' | 'mid' | 'small' | 'micro' | 'nano'

export type ScreenedTicker = {
  ticker: string
  sector: NasdaqSector
  marketCap: number
}

async function fetchScreenerPage(
  marketcap: NasdaqMarketCapBucket,
  sector: NasdaqSector,
  limit: number
): Promise<ScreenedTicker[]> {
  const qs = new URLSearchParams({
    tableonly: 'true',
    limit: String(limit),
    offset: '0',
    marketcap,
    sector,
  })
  try {
    const res = await fetch(`${SCREENER_BASE}?${qs.toString()}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const rows: Array<{ symbol: string; marketCap: string }> = data?.data?.table?.rows ?? []
    return rows
      .map((r) => ({
        ticker: r.symbol,
        sector,
        marketCap: Number(String(r.marketCap).replace(/,/g, '')) || 0,
      }))
      // Exclude class-share/unit tickers NASDAQ renders with a slash
      // (e.g. "BRK/B") — not tradable as typed on most downstream APIs.
      .filter((r) => r.ticker && /^[A-Z]{1,5}$/.test(r.ticker) && r.marketCap > 0)
  } catch {
    return []
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

/**
 * Screen one target band across all 11 sectors, capping each sector at
 * `perSectorCap` candidates (by market cap desc) so no sector can dominate
 * the pool. `buckets` controls which NASDAQ pages to fetch (coarse — must
 * be a superset of the target range); `minMarketCap`/`maxMarketCap` do the
 * real, exact admission filtering against each ticker's actual returned
 * market cap, since our band boundaries don't line up with NASDAQ's own
 * bucket edges.
 */
export async function screenBand(
  buckets: NasdaqMarketCapBucket[],
  perSectorCap: number,
  bounds: { min: number; minInclusive: boolean; max: number; maxInclusive: boolean }
): Promise<ScreenedTicker[]> {
  const { min, minInclusive, max, maxInclusive } = bounds
  const passesLowerBound = (mc: number) => (minInclusive ? mc >= min : mc > min)
  const passesUpperBound = (mc: number) => (maxInclusive ? mc <= max : mc < max)
  const jobs: Array<{ bucket: NasdaqMarketCapBucket; sector: NasdaqSector }> = []
  for (const bucket of buckets) {
    for (const sector of NASDAQ_SECTORS) {
      jobs.push({ bucket, sector })
    }
  }

  const pages = await mapWithConcurrency(jobs, 6, ({ bucket, sector }) =>
    fetchScreenerPage(bucket, sector, perSectorCap * 3) // over-fetch, dedupe+filter+trim after
  )

  // Merge multi-bucket results per sector (e.g. large + mega), apply the
  // real market-cap band filter, keep top perSectorCap by market cap,
  // dedupe by ticker.
  const bySector = new Map<NasdaqSector, Map<string, ScreenedTicker>>()
  for (const page of pages) {
    for (const t of page) {
      if (!passesLowerBound(t.marketCap) || !passesUpperBound(t.marketCap)) continue
      if (!bySector.has(t.sector)) bySector.set(t.sector, new Map())
      const m = bySector.get(t.sector)!
      const existing = m.get(t.ticker)
      if (!existing || t.marketCap > existing.marketCap) m.set(t.ticker, t)
    }
  }

  const out: ScreenedTicker[] = []
  for (const m of bySector.values()) {
    const sorted = [...m.values()].sort((a, b) => b.marketCap - a.marketCap).slice(0, perSectorCap)
    out.push(...sorted)
  }
  return out
}
