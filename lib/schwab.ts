/**
 * Schwab market data client — intraday quotes and candles for the momentum
 * scanner. Finnhub's free tier has no intraday candle resolution and no
 * volume field on its quote endpoint, which made real spike detection
 * (relative volume, VWAP, rate-of-change) impossible; Schwab's
 * `/marketdata/v1/pricehistory` returns real per-minute OHLCV bars going
 * back ~48 trading days.
 *
 * Auth: OAuth2 refresh-token grant. SCHWAB_REFRESH_TOKEN is long-lived but
 * NOT permanent — Schwab expires it after 7 days regardless of use, unlike
 * a typical OAuth refresh token. There is no way to renew it programmatically;
 * see scripts/schwab-reauth.md for the manual re-auth runbook. When the
 * refresh token has expired, every call in this file will start failing
 * with a 401 until someone re-runs that flow and updates the env var.
 *
 * The access token minted from the refresh token is short-lived (30 min)
 * and is cached in-memory per warm serverless instance — cheap to refresh,
 * not worth persisting anywhere.
 */

const TOKEN_ENDPOINT = 'https://api.schwabapi.com/v1/oauth/token'
const API_BASE = 'https://api.schwabapi.com/marketdata/v1'

let cachedAccessToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string | null> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 30_000) {
    return cachedAccessToken.token
  }

  const appKey = process.env.SCHWAB_APP_KEY
  const appSecret = process.env.SCHWAB_APP_SECRET
  const refreshToken = process.env.SCHWAB_REFRESH_TOKEN
  if (!appKey || !appSecret || !refreshToken) return null

  try {
    const basic = Buffer.from(`${appKey}:${appSecret}`).toString('base64')
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      console.error('[schwab] token refresh failed', res.status, await res.text().catch(() => ''))
      return null
    }
    const data = await res.json()
    const token = data.access_token as string
    const expiresIn = (data.expires_in as number) ?? 1800
    cachedAccessToken = { token, expiresAt: Date.now() + expiresIn * 1000 }
    return token
  } catch (e) {
    console.error('[schwab] token refresh error', e)
    return null
  }
}

async function schwabGet(path: string, params: Record<string, string>): Promise<unknown | null> {
  const token = await getAccessToken()
  if (!token) return null
  const qs = new URLSearchParams(params).toString()
  try {
    const res = await fetch(`${API_BASE}${path}?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ── Quotes ───────────────────────────────────────────────────────────────────

export type SchwabQuote = {
  symbol: string
  lastPrice: number
  netChange: number
  netPercentChange: number
  totalVolume: number
  openPrice: number
  highPrice: number
  lowPrice: number
  closePrice: number // prior day's close
  week52High?: number
  week52Low?: number
}

export type SchwabFundamental = {
  peRatio: number | null
  eps: number | null
  avg10DaysVolume: number | null
  avg1YearVolume: number | null
  divYield: number | null
}

/** Batch quote fetch — one call for up to ~500 symbols. */
export async function getQuotes(symbols: string[]): Promise<Map<string, SchwabQuote>> {
  const out = new Map<string, SchwabQuote>()
  if (symbols.length === 0) return out

  const data = (await schwabGet('/quotes', { symbols: symbols.join(','), fields: 'quote' })) as Record<
    string,
    { symbol: string; quote?: Record<string, number> }
  > | null
  if (!data) return out

  for (const [sym, entry] of Object.entries(data)) {
    const q = entry.quote
    if (!q) continue
    out.set(sym, {
      symbol: entry.symbol ?? sym,
      lastPrice: q.lastPrice ?? 0,
      netChange: q.netChange ?? 0,
      netPercentChange: q.netPercentChange ?? 0,
      totalVolume: q.totalVolume ?? 0,
      openPrice: q.openPrice ?? 0,
      highPrice: q.highPrice ?? 0,
      lowPrice: q.lowPrice ?? 0,
      closePrice: q.closePrice ?? 0,
      week52High: q['52WeekHigh'],
      week52Low: q['52WeekLow'],
    })
  }
  return out
}

/**
 * Batch quote + fundamental fetch — one call for the whole universe, per-
 * ticker P/E, EPS, avg volume, dividend yield. Replaces Finnhub's per-ticker
 * /quote + /stock/metric round trips (2 calls x N tickers) with a single
 * batch call for all of them.
 */
export async function getQuotesWithFundamentals(
  symbols: string[]
): Promise<Map<string, { quote: SchwabQuote; fundamental: SchwabFundamental }>> {
  const out = new Map<string, { quote: SchwabQuote; fundamental: SchwabFundamental }>()
  if (symbols.length === 0) return out

  const data = (await schwabGet('/quotes', {
    symbols: symbols.join(','),
    fields: 'quote,fundamental',
  })) as Record<string, { symbol: string; quote?: Record<string, number>; fundamental?: Record<string, number> }> | null
  if (!data) return out

  for (const [sym, entry] of Object.entries(data)) {
    const q = entry.quote
    if (!q) continue
    const f = entry.fundamental ?? {}
    out.set(sym, {
      quote: {
        symbol: entry.symbol ?? sym,
        lastPrice: q.lastPrice ?? 0,
        netChange: q.netChange ?? 0,
        netPercentChange: q.netPercentChange ?? 0,
        totalVolume: q.totalVolume ?? 0,
        openPrice: q.openPrice ?? 0,
        highPrice: q.highPrice ?? 0,
        lowPrice: q.lowPrice ?? 0,
        closePrice: q.closePrice ?? 0,
        week52High: q['52WeekHigh'],
        week52Low: q['52WeekLow'],
      },
      fundamental: {
        peRatio: f.peRatio ?? null,
        eps: f.eps ?? null,
        avg10DaysVolume: f.avg10DaysVolume ?? null,
        avg1YearVolume: f.avg1YearVolume ?? null,
        divYield: f.divYield ?? null,
      },
    })
  }
  return out
}

/**
 * Single-symbol lookup with company description/exchange — the batch /quotes
 * endpoint doesn't return the `reference` block, so this is used only where
 * a display name is actually needed (e.g. the signal-details endpoint), not
 * in the daily generation cron (Claude already supplies companyName there).
 * Schwab's API has no sector/industry classification field at all — unlike
 * Finnhub's profile2, `industry` will always come back null here.
 */
export async function getInstrumentFundamental(symbol: string): Promise<{
  description: string | null
  exchange: string | null
  peRatio: number | null
  beta: number | null
  marketCap: number | null
  avg10DaysVolume: number | null
  high52: number | null
  low52: number | null
  dividendYield: number | null
} | null> {
  const data = (await schwabGet('/instruments', { symbol, projection: 'fundamental' })) as {
    instruments?: Array<{
      description?: string
      exchange?: string
      fundamental?: Record<string, number>
    }>
  } | null
  const inst = data?.instruments?.[0]
  if (!inst) return null
  const f = inst.fundamental ?? {}
  return {
    description: inst.description ?? null,
    exchange: inst.exchange ?? null,
    peRatio: f.peRatio ?? null,
    beta: f.beta ?? null,
    marketCap: f.marketCap ?? null,
    avg10DaysVolume: f.avg10DaysVolume ?? null,
    high52: f.high52 ?? null,
    low52: f.low52 ?? null,
    dividendYield: f.dividendYield ?? null,
  }
}

// ── Intraday candles ─────────────────────────────────────────────────────────

export type Candle = { open: number; high: number; low: number; close: number; volume: number; datetime: number }

/**
 * Today's 1-minute candles for a symbol (regular session only —
 * needExtendedHoursData=false so pre/post-market noise doesn't pollute
 * relative-volume or VWAP math).
 */
export async function getTodayMinuteCandles(symbol: string): Promise<Candle[]> {
  const data = (await schwabGet('/pricehistory', {
    symbol,
    periodType: 'day',
    period: '1',
    frequencyType: 'minute',
    frequency: '1',
    needExtendedHoursData: 'false',
  })) as { candles?: Candle[]; empty?: boolean } | null
  if (!data || data.empty || !data.candles) return []
  return data.candles
}

/**
 * ~1 year of daily candles for a symbol — replaces Finnhub's
 * /stock/candle?resolution=D. Feeds the same RSI/MACD/SMA/Bollinger
 * computation the daily signals cron already has (unchanged math, just a
 * different data source).
 */
export async function getDailyCandles(symbol: string): Promise<Candle[]> {
  const data = (await schwabGet('/pricehistory', {
    symbol,
    periodType: 'year',
    period: '1',
    frequencyType: 'daily',
    frequency: '1',
    needExtendedHoursData: 'false',
  })) as { candles?: Candle[]; empty?: boolean } | null
  if (!data || data.empty || !data.candles) return []
  return data.candles
}

/**
 * ~21 trading days (one calendar month) of 1-minute candles for a symbol —
 * the basis for computing a real time-of-day relative-volume profile (e.g.
 * "is 10:15am volume unusually high compared to the last 20 days' 10:15am
 * volume"). periodType=day only accepts period values up to 10, so a
 * ~20-trading-day lookback requires periodType=month, period=1. This is a
 * heavy call (thousands of candles); use sparingly (e.g. weekly profile
 * rebuild), not per-scan.
 */
export async function getHistoricalMinuteCandles(symbol: string): Promise<Candle[]> {
  const data = (await schwabGet('/pricehistory', {
    symbol,
    periodType: 'month',
    period: '1',
    frequencyType: 'minute',
    frequency: '1',
    needExtendedHoursData: 'false',
  })) as { candles?: Candle[]; empty?: boolean } | null
  if (!data || data.empty || !data.candles) return []
  return data.candles
}
