const BASE = 'https://finnhub.io/api/v1'

/**
 * Fetch from Finnhub.
 *
 * @param path      API path including query string (e.g. `/stock/candle?symbol=AAPL&...`)
 * @param revalidate Seconds to cache the response in the Next.js Data Cache.
 *                   Pass 0 to opt out of caching entirely (recommended for price data).
 */
export async function finnhubGet<T = unknown>(path: string, revalidate = 300): Promise<T | null> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) {
    console.error('[finnhub] FINNHUB_API_KEY is not set — cannot fetch:', path)
    return null
  }

  const sep = path.includes('?') ? '&' : '?'
  const url = `${BASE}${path}${sep}token=${key}`

  // revalidate = 0 → bypass the Next.js Data Cache entirely so stale "no_data"
  // responses from Finnhub are never served from cache on subsequent requests.
  const fetchInit: RequestInit =
    revalidate === 0
      ? { cache: 'no-store' }
      : { next: { revalidate } }

  try {
    const res = await fetch(url, fetchInit)

    if (!res.ok) {
      console.error(`[finnhub] HTTP ${res.status} for ${path}`)
      return null
    }

    return res.json() as Promise<T>
  } catch (e) {
    console.error('[finnhub] fetch error for', path, e)
    return null
  }
}
