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

/**
 * The live refresh token: DB first (written by the admin panel's Schwab
 * re-auth flow), env var as fallback. The DB path exists because Schwab's
 * refresh token expires every 7 days with no programmatic renewal — routing
 * it through SchwabToken lets a re-auth take effect immediately, instead of
 * requiring a Vercel env-var edit plus a redeploy. The env fallback keeps
 * everything working before the first admin re-auth ever writes a row.
 *
 * Imported lazily so this module stays usable in any context that doesn't
 * already have a Prisma connection available.
 */
async function getRefreshToken(): Promise<string | null> {
  try {
    const { prisma } = await import('./prisma')
    const row = await prisma.schwabToken.findUnique({ where: { singleton: 'main' } })
    if (row?.refreshToken) return row.refreshToken
  } catch {
    // DB unavailable — fall through to the env var.
  }
  return process.env.SCHWAB_REFRESH_TOKEN ?? null
}

async function getAccessToken(): Promise<string | null> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 30_000) {
    return cachedAccessToken.token
  }

  const appKey = process.env.SCHWAB_APP_KEY
  const appSecret = process.env.SCHWAB_APP_SECRET
  const refreshToken = await getRefreshToken()
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
  // "Normal" | "Halted" | "Closed" — Schwab's own halt indicator, not
  // previously mapped by this client. Added for the News Catalyst Alerts
  // feature, which needs to show halt status directly rather than infer it.
  securityStatus: string | null
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
      securityStatus: (q as unknown as { securityStatus?: string }).securityStatus ?? null,
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
        securityStatus: (q as unknown as { securityStatus?: string }).securityStatus ?? null,
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

export type ExtendedHoursQuote = {
  symbol: string
  companyName: string | null
  regularLastPrice: number
  regularClosePrice: number
  extendedLastPrice: number
  extendedVolume: number
  // extended.totalVolume comes back 0 on every live symbol checked (verified
  // via a raw payload dump against BABA) — it does not appear to be a usable
  // in-session traded-volume figure on this Schwab entitlement, unlike the
  // regular-session quote.totalVolume. Kept on the type (still 0) since it's
  // real data Schwab returns, but callers needing an in-session liquidity
  // proxy should use extendedBidPrice/extendedAskPrice (spread) and
  // extendedLastSize (last print size) instead — see cron/extended-signals.
  extendedBidPrice: number
  extendedAskPrice: number
  extendedLastSize: number
  extendedTradeTime: number // epoch ms
  pctChange: number // vs regularLastPrice — see getExtendedHoursQuotes doc
  securityStatus: string | null // "Normal" | "Halted" | "Closed"

  // ── The fields that actually carry live extended-hours truth. Added
  //    2026-08-10; prefer these over anything named `extended*` above. ──
  /** LIVE price including extended trades (quote.lastPrice). */
  livePrice: number
  /** TODAY's regular-session close (regular.regularMarketLastPrice). The correct after-hours baseline. */
  regularMarketLastPrice: number
  /** Schwab's own after-hours $ change vs today's regular close. */
  postMarketChange: number
  /** Schwab's own after-hours % change vs today's regular close — verified against an independent public quote. */
  postMarketPercentChange: number
  /** Today's regular-session share volume (quote.totalVolume) — a real liquidity figure, unlike extended.totalVolume which is always 0 here. */
  dayVolume: number
}

/**
 * Batch premarket/after-hours quote fetch.
 *
 * ── CORRECTED 2026-08-10 after a live three-way audit. Read this before
 *    changing any field mapping here. ──
 *
 * The `extended` block is NOT a usable live price source on this
 * entitlement. Proven live at 18:26 ET during an active after-hours
 * session: every sampled ticker's `extended.tradeTime` was 03:42-03:59 ET
 * — 14+ hours stale — with `extended.totalVolume: 0` and
 * `extended.quoteTime: 0`. It appears to freeze after the overnight/
 * premarket session and never update for after-hours. Treating it as
 * "the current extended price" produced a sign-flipped, magnitude-wrong
 * number (PAYC displayed +41.69% when the real after-hours move was
 * -29.45%). `extendedLastPrice`/`extendedLastSize` are still returned
 * below because other callers historically read them, but NOTHING should
 * derive a current price or a liquidity figure from them.
 *
 * The correct fields, each verified against both Schwab's own computed
 * values and an independent public quote for PAYC on 2026-08-10:
 *   quote.lastPrice                  = the LIVE price, including extended
 *                                      trades (150.5887 — matched the
 *                                      public after-hours quote exactly)
 *   regular.regularMarketLastPrice   = TODAY's regular-session close
 *                                      (213.45 — matched "At close")
 *   quote.closePrice                 = the PRIOR day's close (214.94)
 *   quote.postMarketPercentChange    = Schwab's own after-hours % change
 *                                      (-29.45012884 — matched the public
 *                                      source to the decimal)
 *
 * A PRIOR VERSION OF THIS COMMENT CLAIMED quote.lastPrice is "today's
 * final regular-session print, frozen once the session ends." That is
 * empirically FALSE and was the root of the bug: during after-hours
 * lastPrice tracks extended trades (150.5887), while the frozen regular
 * close lives in regular.regularMarketLastPrice (213.45). The claim was
 * most likely verified during premarket — where lastPrice genuinely IS a
 * frozen prior-session value — and wrongly generalized to after-hours.
 *
 * Tickers with no real extended-session trade yet (extendedTradeTime = 0)
 * are omitted — a 0.0 last price is "no data," not a real quote.
 */
export async function getExtendedHoursQuotes(symbols: string[]): Promise<Map<string, ExtendedHoursQuote>> {
  const out = new Map<string, ExtendedHoursQuote>()
  if (symbols.length === 0) return out

  const data = (await schwabGet('/quotes', {
    symbols: symbols.join(','),
    fields: 'quote,extended,regular,reference',
  })) as Record<
    string,
    {
      symbol: string
      quote?: Record<string, number>
      extended?: Record<string, number>
      regular?: Record<string, number>
      reference?: { description?: string }
    }
  > | null
  if (!data) return out

  for (const [sym, entry] of Object.entries(data)) {
    const q = entry.quote
    const ext = entry.extended
    if (!q) continue

    // livePrice is the gating value now, not extended.lastPrice — a symbol
    // with a live quote but a dead `extended` block (the normal case in
    // after-hours, see the doc comment above) must NOT be dropped.
    const livePrice = q.lastPrice ?? 0
    if (livePrice === 0) continue

    const extendedTradeTime = ext?.tradeTime ?? 0
    const extendedLastPrice = ext?.lastPrice ?? 0

    out.set(sym, {
      symbol: entry.symbol ?? sym,
      companyName: entry.reference?.description ?? null,
      regularLastPrice: livePrice, // legacy alias — misleadingly named, see doc comment
      regularClosePrice: q.closePrice ?? 0,
      extendedLastPrice,
      extendedVolume: ext?.totalVolume ?? 0,
      extendedBidPrice: ext?.bidPrice ?? 0,
      extendedAskPrice: ext?.askPrice ?? 0,
      extendedLastSize: ext?.lastSize ?? 0,
      extendedTradeTime,
      pctChange: ((extendedLastPrice - livePrice) / livePrice) * 100,
      securityStatus: (q as unknown as { securityStatus?: string }).securityStatus ?? null,

      livePrice,
      regularMarketLastPrice: entry.regular?.regularMarketLastPrice ?? 0,
      postMarketChange: q.postMarketChange ?? 0,
      postMarketPercentChange: q.postMarketPercentChange ?? 0,
      dayVolume: q.totalVolume ?? 0,
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

// ── Options chain ────────────────────────────────────────────────────────────

/**
 * One real, tradable contract from Schwab's live options chain
 * (/marketdata/v1/chains). Every field here is what Schwab actually quotes
 * for that specific strike/expiration right now — nothing in this type is
 * estimated or computed client-side except `dte`, which is a same-day
 * calendar-day diff from the exp-date map key Schwab itself provides.
 */
export type OptionContract = {
  symbol: string // real OCC-format contract symbol, e.g. "AAPL  260821C00230000"
  putCall: 'CALL' | 'PUT'
  strike: number
  expirationDate: string // "YYYY-MM-DD"
  dte: number
  bid: number
  ask: number
  mark: number
  volatility: number | null // Schwab's per-contract IV, percent
  openInterest: number
  totalVolume: number
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
  breakEven: number | null
  inTheMoney: boolean
}

type SchwabChainContract = {
  putCall: 'CALL' | 'PUT'
  symbol: string
  bid: number
  ask: number
  mark: number
  volatility: number
  openInterest: number
  totalVolume: number
  delta: number
  gamma: number
  theta: number
  vega: number
  breakEven: number
  strikePrice: number
  expirationDate: string
  daysToExpiration: number
  inTheMoney: boolean
}

type SchwabChainResponse = {
  symbol: string
  status: string
  underlyingPrice?: number
  callExpDateMap?: Record<string, Record<string, SchwabChainContract[]>>
  putExpDateMap?: Record<string, Record<string, SchwabChainContract[]>>
}

function flattenExpDateMap(
  map: Record<string, Record<string, SchwabChainContract[]>> | undefined
): OptionContract[] {
  if (!map) return []
  const out: OptionContract[] = []
  for (const strikeMap of Object.values(map)) {
    for (const contracts of Object.values(strikeMap)) {
      for (const c of contracts) {
        out.push({
          symbol: c.symbol,
          putCall: c.putCall,
          strike: c.strikePrice,
          expirationDate: c.expirationDate.split('T')[0],
          dte: c.daysToExpiration,
          bid: c.bid ?? 0,
          ask: c.ask ?? 0,
          mark: c.mark ?? 0,
          volatility: typeof c.volatility === 'number' && c.volatility > 0 ? c.volatility : null,
          openInterest: c.openInterest ?? 0,
          totalVolume: c.totalVolume ?? 0,
          delta: typeof c.delta === 'number' ? c.delta : null,
          gamma: typeof c.gamma === 'number' ? c.gamma : null,
          theta: typeof c.theta === 'number' ? c.theta : null,
          vega: typeof c.vega === 'number' ? c.vega : null,
          breakEven: typeof c.breakEven === 'number' ? c.breakEven : null,
          inTheMoney: !!c.inTheMoney,
        })
      }
    }
  }
  return out
}

/**
 * Real options chain for one underlying — replaces the old fabricated-data
 * path (a bare stock quote + Claude "estimating" strike/premium/expiration
 * out of thin air). Every strike/expiration/bid/ask/IV/Greek returned here
 * is what Schwab is actually quoting for that exact contract right now.
 *
 * Scoped with fromDate/toDate (~5-60 DTE) and strikeCount to keep the
 * payload reasonable — options signals are meant to be near-term
 * directional trades, not LEAPS or same-day 0DTE noise.
 */
export async function getOptionChain(
  symbol: string,
  dateWindow?: { fromDate: string; toDate: string },
): Promise<{
  underlyingPrice: number | null
  contracts: OptionContract[]
} | null> {
  const today = new Date()
  // Default window (5-60 DTE) is tuned for cron/options' signal generation.
  // cron/options-outcomes passes its own narrow window (today -> the exact
  // signal's expirationDate) since a contract close to or at expiration
  // falls outside this default range and would otherwise never be found.
  const fromDate = dateWindow?.fromDate ?? new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const toDate = dateWindow?.toDate ?? new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const data = (await schwabGet('/chains', {
    symbol,
    contractType: 'ALL',
    strikeCount: '20',
    includeUnderlyingQuote: 'true',
    strategy: 'SINGLE',
    fromDate,
    toDate,
  })) as SchwabChainResponse | null

  if (!data || data.status !== 'SUCCESS') return null

  const contracts = [
    ...flattenExpDateMap(data.callExpDateMap),
    ...flattenExpDateMap(data.putExpDateMap),
  ]

  return { underlyingPrice: data.underlyingPrice ?? null, contracts }
}
