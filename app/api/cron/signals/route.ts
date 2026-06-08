import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'

export const maxDuration = 120

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// ─── Ticker universe ──────────────────────────────────────────────────────────

const LARGE_CAP = new Set([
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AVGO', 'AMD', 'QCOM',
  'INTC', 'TXN', 'MU', 'AMAT', 'ADBE', 'CRM', 'ORCL', 'SNOW', 'CRWD', 'DDOG',
  'JPM', 'BAC', 'GS', 'V', 'MA', 'C', 'WFC', 'MS', 'BLK', 'AXP', 'SCHW', 'ICE',
  'JNJ', 'UNH', 'LLY', 'PFE', 'ABT', 'TMO', 'ISRG', 'MDT', 'AMGN', 'GILD',
  'XOM', 'CVX', 'COP', 'EOG', 'SLB',
  'WMT', 'COST', 'MCD', 'SBUX', 'TGT', 'KO', 'PEP', 'NKE', 'PM', 'MO',
  'CAT', 'HON', 'RTX', 'LMT', 'GE', 'DE', 'MMM', 'EMR',
  'NFLX', 'DIS', 'CMCSA', 'T', 'VZ',
  'NEE', 'DUK', 'D', 'AMT', 'PLD', 'EQIX',
  'PLTR', 'COIN', 'AXON', 'UBER', 'DASH', 'RBLX', 'HWM', 'TDG',
  'S', 'ZS', 'PATH', 'SOFI', 'AFRM',
])

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

// ─── Technical indicator computation ─────────────────────────────────────────

interface Candles {
  c: number[]; h: number[]; l: number[]; o: number[]
  v: number[]; t: number[]; s: string
}

interface TechnicalIndicators {
  rsi14: number | null
  macdLine: number | null
  macdSignal: number | null
  macdHist: number | null
  sma50: number | null
  sma200: number | null
  bollingerUpper: number | null
  bollingerLower: number | null
  bollingerMid: number | null
  volumeRatio: number | null  // current vol / 20-day avg vol
  priceVsSma50: number | null // % above/below SMA50
  priceVsSma200: number | null
}

function computeEMA(prices: number[], period: number): number[] {
  if (prices.length < period) return []
  const k = 2 / (period + 1)
  const emas: number[] = []
  // Seed with SMA
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  emas.push(ema)
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k)
    emas.push(ema)
  }
  return emas
}

function computeSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null
  return prices.slice(-period).reduce((a, b) => a + b, 0) / period
}

function computeRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1]
    if (delta > 0) gains += delta
    else losses += Math.abs(delta)
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function computeMACD(
  closes: number[]
): { macdLine: number; signalLine: number; histogram: number } | null {
  if (closes.length < 35) return null
  const ema12 = computeEMA(closes, 12)
  const ema26 = computeEMA(closes, 26)
  if (ema12.length === 0 || ema26.length === 0) return null

  // Align: ema26 is shorter, align from end
  const macdSeries: number[] = []
  const len = Math.min(ema12.length, ema26.length)
  for (let i = 0; i < len; i++) {
    macdSeries.push(ema12[ema12.length - len + i] - ema26[ema26.length - len + i])
  }

  const signalEMA = computeEMA(macdSeries, 9)
  if (signalEMA.length === 0) return null

  const macdLine = macdSeries[macdSeries.length - 1]
  const signalLine = signalEMA[signalEMA.length - 1]
  return {
    macdLine,
    signalLine,
    histogram: macdLine - signalLine,
  }
}

function computeBollinger(
  closes: number[],
  period = 20
): { upper: number; mid: number; lower: number } | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  const mid = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((a, b) => a + Math.pow(b - mid, 2), 0) / period
  const std = Math.sqrt(variance)
  return { upper: mid + 2 * std, mid, lower: mid - 2 * std }
}

function computeIndicators(candles: Candles): TechnicalIndicators {
  const closes = candles.c
  const volumes = candles.v

  const rsi14 = computeRSI(closes)
  const macd = computeMACD(closes)
  const sma50 = computeSMA(closes, 50)
  const sma200 = computeSMA(closes, 200)
  const bollinger = computeBollinger(closes)

  const currentPrice = closes[closes.length - 1]
  const avgVol20 = volumes.length >= 20
    ? volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
    : null
  const currentVol = volumes[volumes.length - 1]
  const volumeRatio = avgVol20 && avgVol20 > 0 ? currentVol / avgVol20 : null

  return {
    rsi14: rsi14 !== null ? Math.round(rsi14 * 10) / 10 : null,
    macdLine: macd ? Math.round(macd.macdLine * 1000) / 1000 : null,
    macdSignal: macd ? Math.round(macd.signalLine * 1000) / 1000 : null,
    macdHist: macd ? Math.round(macd.histogram * 1000) / 1000 : null,
    sma50: sma50 !== null ? Math.round(sma50 * 100) / 100 : null,
    sma200: sma200 !== null ? Math.round(sma200 * 100) / 100 : null,
    bollingerUpper: bollinger ? Math.round(bollinger.upper * 100) / 100 : null,
    bollingerLower: bollinger ? Math.round(bollinger.lower * 100) / 100 : null,
    bollingerMid: bollinger ? Math.round(bollinger.mid * 100) / 100 : null,
    volumeRatio: volumeRatio !== null ? Math.round(volumeRatio * 100) / 100 : null,
    priceVsSma50: sma50 && sma50 > 0 ? Math.round(((currentPrice - sma50) / sma50) * 10000) / 100 : null,
    priceVsSma200: sma200 && sma200 > 0 ? Math.round(((currentPrice - sma200) / sma200) * 10000) / 100 : null,
  }
}

// ─── Multi-factor pre-scoring ─────────────────────────────────────────────────

interface FactorScores {
  technical: number   // 0-100
  fundamental: number // 0-100
  momentum: number    // 0-100
  sentiment: number   // 0-100
  composite: number   // weighted average
}

function computeFactorScores(
  ind: TechnicalIndicators,
  metrics: FinnhubMetrics | null,
  analystRating: number | null, // 1=Strong Buy, 2=Buy, 3=Hold, 4=Sell, 5=Strong Sell
  quote: Quote,
  newsCount: number
): FactorScores {
  // ── Technical (25%) ──
  let techScore = 50
  // RSI
  if (ind.rsi14 !== null) {
    if (ind.rsi14 >= 55 && ind.rsi14 <= 70) techScore += 15  // bullish momentum
    else if (ind.rsi14 >= 45 && ind.rsi14 < 55) techScore += 5
    else if (ind.rsi14 > 70) techScore -= 10  // overbought
    else if (ind.rsi14 < 35) techScore += 10  // oversold bounce potential
    else techScore -= 5
  }
  // MACD histogram direction
  if (ind.macdHist !== null && ind.macdLine !== null) {
    if (ind.macdHist > 0 && ind.macdLine > 0) techScore += 10
    else if (ind.macdHist > 0) techScore += 5
    else if (ind.macdHist < 0 && ind.macdLine < 0) techScore -= 10
    else techScore -= 5
  }
  // Price vs SMAs
  if (ind.priceVsSma50 !== null) {
    if (ind.priceVsSma50 > 0 && ind.priceVsSma50 < 10) techScore += 8  // just above — healthy
    else if (ind.priceVsSma50 > 10) techScore += 3  // extended
    else techScore -= 8  // below 50-day
  }
  if (ind.priceVsSma200 !== null) {
    if (ind.priceVsSma200 > 0) techScore += 7
    else techScore -= 7
  }
  techScore = Math.max(0, Math.min(100, techScore))

  // ── Fundamental (20%) ──
  let fundScore = 50
  if (metrics) {
    // Revenue growth
    if (metrics.revenueGrowthTTMYoy !== null) {
      if (metrics.revenueGrowthTTMYoy > 20) fundScore += 20
      else if (metrics.revenueGrowthTTMYoy > 10) fundScore += 10
      else if (metrics.revenueGrowthTTMYoy > 0) fundScore += 5
      else fundScore -= 10
    }
    // P/E ratio
    if (metrics.peBasicExclExtraTTM !== null && metrics.peBasicExclExtraTTM > 0) {
      if (metrics.peBasicExclExtraTTM < 20) fundScore += 10
      else if (metrics.peBasicExclExtraTTM < 35) fundScore += 5
      else if (metrics.peBasicExclExtraTTM > 60) fundScore -= 10
    }
    // EPS growth
    if (metrics.epsGrowthTTMYoy !== null) {
      if (metrics.epsGrowthTTMYoy > 25) fundScore += 15
      else if (metrics.epsGrowthTTMYoy > 10) fundScore += 8
      else if (metrics.epsGrowthTTMYoy < 0) fundScore -= 10
    }
  }
  fundScore = Math.max(0, Math.min(100, fundScore))

  // ── Momentum (20%) ──
  let momScore = 50
  // 1-day change
  if (quote.dp > 3) momScore += 20
  else if (quote.dp > 1) momScore += 10
  else if (quote.dp > 0) momScore += 5
  else if (quote.dp < -3) momScore -= 20
  else if (quote.dp < -1) momScore -= 10
  // Volume surge
  if (ind.volumeRatio !== null) {
    if (ind.volumeRatio > 2.5) momScore += 15
    else if (ind.volumeRatio > 1.5) momScore += 8
    else if (ind.volumeRatio < 0.7) momScore -= 8
  }
  // 52-week position
  const range52w = quote.h - quote.l  // proxy for 52w range using today's h/l isn't accurate but we use what we have
  // Use % from 52w high (Finnhub quote h/l are daily, not 52w — limited accuracy here)
  momScore = Math.max(0, Math.min(100, momScore))

  // ── Sentiment (15%) ──
  let sentScore = 50
  if (newsCount >= 3) sentScore += 10
  else if (newsCount >= 1) sentScore += 5
  if (analystRating !== null) {
    if (analystRating <= 1.5) sentScore += 20
    else if (analystRating <= 2.5) sentScore += 10
    else if (analystRating >= 3.5) sentScore -= 10
    else if (analystRating >= 4.5) sentScore -= 20
  }
  sentScore = Math.max(0, Math.min(100, sentScore))

  // Weighted composite: Technical 25%, Fundamental 20%, Momentum 20%, Sentiment 15%
  // Remaining 20% defaults to 50 (catalyst + risk are Claude-assessed)
  const composite =
    techScore * 0.25 +
    fundScore * 0.20 +
    momScore  * 0.20 +
    sentScore * 0.15 +
    50        * 0.20  // catalyst + risk placeholder

  return {
    technical: Math.round(techScore),
    fundamental: Math.round(fundScore),
    momentum: Math.round(momScore),
    sentiment: Math.round(sentScore),
    composite: Math.round(composite * 10) / 10,
  }
}

// ─── API fetching ─────────────────────────────────────────────────────────────

type Quote = { c: number; d: number; dp: number; h: number; l: number; o: number; pc: number; t: number }
type NewsItem = { headline: string; datetime: number; source: string }

interface FinnhubMetrics {
  peBasicExclExtraTTM: number | null
  revenueGrowthTTMYoy: number | null
  epsGrowthTTMYoy: number | null
  roeTTM: number | null
  debtToEquity: number | null
}

interface AnalystRec {
  buy: number; hold: number; sell: number; strongBuy: number; strongSell: number
}

async function fetchQuote(symbol: string): Promise<Quote | null> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return null
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

async function fetchCandles(symbol: string): Promise<Candles | null> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return null
  const to = Math.floor(Date.now() / 1000)
  const from = to - 252 * 24 * 3600 // ~1 year of daily candles
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${key}`,
      { cache: 'no-store', signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data.s !== 'ok' || !data.c || data.c.length < 20) return null
    return data as Candles
  } catch { return null }
}

async function fetchMetrics(symbol: string): Promise<FinnhubMetrics | null> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return null
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${key}`,
      { cache: 'no-store', signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const m = data.metric || {}
    return {
      peBasicExclExtraTTM: m.peBasicExclExtraTTM ?? null,
      revenueGrowthTTMYoy: m.revenueGrowthTTMYoy ?? null,
      epsGrowthTTMYoy: m.epsGrowthTTMYoy ?? null,
      roeTTM: m.roeTTM ?? null,
      debtToEquity: m['totalDebt/totalEquityAnnual'] ?? null,
    }
  } catch { return null }
}

async function fetchAnalystRec(symbol: string): Promise<number | null> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return null
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${key}`,
      { cache: 'no-store', signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data: AnalystRec[] = await res.json()
    if (!data || data.length === 0) return null
    const latest = data[0]
    const total = (latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell) || 1
    // Weighted score: strongBuy=1, buy=2, hold=3, sell=4, strongSell=5
    const score =
      (latest.strongBuy * 1 + latest.buy * 2 + latest.hold * 3 + latest.sell * 4 + latest.strongSell * 5) / total
    return Math.round(score * 100) / 100
  } catch { return null }
}

async function fetchRecentNews(symbol: string): Promise<NewsItem[]> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return []
  const to = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${key}`,
      { cache: 'no-store' }
    )
    if (!res.ok) return []
    const data: NewsItem[] = await res.json()
    return data.slice(0, 3)
  } catch { return [] }
}

// ─── Enriched stock data ──────────────────────────────────────────────────────

type EnrichedStockData = {
  symbol: string
  price: number
  changePct: number
  high52w: number
  low52w: number
  recentHeadlines: string[]
  isLargeCap: boolean
  indicators: TechnicalIndicators | null
  metrics: FinnhubMetrics | null
  analystRating: number | null
  factorScores: FactorScores | null
}

async function fetchStockData(watchlist: string[], isLargeCap: boolean): Promise<EnrichedStockData[]> {
  // Fetch quotes for all tickers first (cheap, 1 call each)
  const quotesRaw = await Promise.all(watchlist.map((sym) => fetchQuote(sym)))
  const withQuotes = watchlist
    .map((sym, i) => ({ sym, quote: quotesRaw[i] }))
    .filter(({ quote }) => quote && quote.c > 2) // filter penny stocks / no data

  if (withQuotes.length === 0) return []

  // Enrich top 20 large cap / top 20 small cap with candles + metrics + analyst ratings
  // (stay within 60 req/min: 20 candles + 20 metrics + 20 recs = 60 calls)
  const toEnrich = withQuotes.slice(0, 20)
  const toSkip = withQuotes.slice(20)

  // Fetch all enrichment data in parallel
  const [candleResults, metricsResults, analystResults, newsResults] = await Promise.all([
    Promise.all(toEnrich.map(({ sym }) => fetchCandles(sym))),
    Promise.all(toEnrich.map(({ sym }) => fetchMetrics(sym))),
    Promise.all(toEnrich.map(({ sym }) => fetchAnalystRec(sym))),
    Promise.all(toEnrich.map(({ sym }) => fetchRecentNews(sym))),
  ])

  const enriched: EnrichedStockData[] = toEnrich.map(({ sym, quote }, i) => {
    const candles = candleResults[i]
    const indicators = candles ? computeIndicators(candles) : null
    const metrics = metricsResults[i]
    const analystRating = analystResults[i]
    const news = newsResults[i]
    const factorScores = indicators && quote
      ? computeFactorScores(indicators, metrics, analystRating, quote!, news.length)
      : null

    return {
      symbol: sym,
      price: quote!.c,
      changePct: quote!.dp,
      high52w: quote!.h,
      low52w: quote!.l,
      recentHeadlines: news.map((n) => n.headline),
      isLargeCap,
      indicators,
      metrics,
      analystRating,
      factorScores,
    }
  })

  // Append unenriched tickers (quote-only)
  const unenriched: EnrichedStockData[] = toSkip.map(({ sym, quote }) => ({
    symbol: sym,
    price: quote!.c,
    changePct: quote!.dp,
    high52w: quote!.h,
    low52w: quote!.l,
    recentHeadlines: [],
    isLargeCap,
    indicators: null,
    metrics: null,
    analystRating: null,
    factorScores: null,
  }))

  return [...enriched, ...unenriched]
}

// ─── Signal generation ────────────────────────────────────────────────────────

type GeneratedSignal = {
  ticker: string
  companyName: string
  signalType: 'BUY' | 'WATCH' | 'SHORT'
  entryZoneLow: number
  entryZoneHigh: number
  targetPrice: number
  stopLoss: number
  confidence: number
  timeHorizon: string
  thesis: string
  aiSummary: string
  sector: string
}

async function generateSignals(
  stocks: EnrichedStockData[],
  minTarget: number,
  capType: 'large' | 'small'
): Promise<GeneratedSignal[]> {
  if (stocks.length === 0) return []
  const client = getAnthropicClient()

  const capContext =
    capType === 'small'
      ? `These are small and mid-cap stocks (market cap $100M–$8B). Generate at least ${minTarget} signals. Include growth names, speculative plays, and momentum setups.`
      : `These are large cap stocks (market cap >$8B). Focus on established companies with clear fundamental or technical setups.`

  // Format enriched stock data for the prompt
  const stocksJson = stocks.map((s) => {
    const base: Record<string, unknown> = {
      symbol: s.symbol,
      price: s.price,
      changePct: s.changePct,
      recentHeadlines: s.recentHeadlines,
    }
    if (s.indicators) {
      base.technicals = {
        rsi14: s.indicators.rsi14,
        macdLine: s.indicators.macdLine,
        macdSignal: s.indicators.macdSignal,
        macdHistogram: s.indicators.macdHist,
        sma50: s.indicators.sma50,
        sma200: s.indicators.sma200,
        bollingerUpper: s.indicators.bollingerUpper,
        bollingerLower: s.indicators.bollingerLower,
        volumeRatio: s.indicators.volumeRatio,
        priceVsSma50Pct: s.indicators.priceVsSma50,
        priceVsSma200Pct: s.indicators.priceVsSma200,
      }
    }
    if (s.metrics) {
      base.fundamentals = {
        peRatioTTM: s.metrics.peBasicExclExtraTTM,
        revenueGrowthYoY: s.metrics.revenueGrowthTTMYoy,
        epsGrowthYoY: s.metrics.epsGrowthTTMYoy,
        roeTTM: s.metrics.roeTTM,
      }
    }
    if (s.analystRating !== null) {
      base.analystConsensus = s.analystRating  // 1=Strong Buy → 5=Strong Sell
    }
    if (s.factorScores) {
      base.preComputedFactorScores = {
        technical: s.factorScores.technical,
        fundamental: s.factorScores.fundamental,
        momentum: s.factorScores.momentum,
        sentiment: s.factorScores.sentiment,
        composite: s.factorScores.composite,
        note: 'These are pre-computed 0-100 factor scores. Use composite as your confidence anchor, then adjust ±5 based on your assessment of catalyst quality and risk factors not captured in the data.',
      }
    }
    return base
  })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `You are a professional equity analyst with deep expertise in quantitative and fundamental analysis. ${capContext}

You have been provided with enriched stock data including computed technical indicators (RSI, MACD, Bollinger Bands, moving averages, volume ratios), fundamental metrics (P/E, revenue growth, EPS growth, ROE), analyst consensus ratings, and pre-computed multi-factor scores.

Your task: analyze these stocks and generate trading signals for all actionable setups. Generate at least ${minTarget} signals, no more than 30.

Rules:
- Only generate signals with genuine conviction — use the quantitative data
- Distribute across sectors (max 3 per sector)
- Include BUY, WATCH, and SHORT signals as appropriate
- Include a mix of timeframes: "1-3 days" (short-term catalyst/technical setup), "2-4 weeks" (swing), "1-3 months" (momentum), "3-6 months" (long-term)
- For confidence: when preComputedFactorScores.composite is provided, use it as your anchor. Adjust ±5 max based on your assessment of catalyst quality, risk factors, and market context not captured numerically. When composite is not provided, use the simplified scoring methodology.
- Reply with a JSON array ONLY — no markdown, no explanation

Each signal object must have exactly these keys:
- ticker (string)
- companyName (string, full company name)
- signalType ("BUY", "WATCH", or "SHORT")
- entryZoneLow (number)
- entryZoneHigh (number)
- targetPrice (number)
- stopLoss (number)
- confidence (float 0-100, one decimal place, e.g. 67.3)
- timeHorizon (string)
- thesis (string — THREE PARTS separated by " | ": "SETUP: [technical/fundamental setup in 1 sentence] | CATALYST: [what will drive the move] | RISK: [key risk to monitor]")
- aiSummary (string, 1 concise sentence for the signal card headline)
- sector (string: "Technology", "Healthcare", "Finance", "Energy", "Consumer", "Industrials", "Defense", "Clean Energy", "Cryptocurrency", "Biotech", "Real Estate")

Stock data:
${JSON.stringify(stocksJson, null, 2)}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    return JSON.parse(cleaned) as GeneratedSignal[]
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (match) {
      try { return JSON.parse(match[0]) as GeneratedSignal[] } catch { return [] }
    }
    return []
  }
}

function applySectorDiversity(signals: GeneratedSignal[], maxPerSector = 3): GeneratedSignal[] {
  const counts: Record<string, number> = {}
  return signals.filter((s) => {
    const c = counts[s.sector] ?? 0
    if (c >= maxPerSector) return false
    counts[s.sector] = c + 1
    return true
  })
}

function validateSignal(s: GeneratedSignal): boolean {
  if (!s.ticker || !s.entryZoneLow || !s.entryZoneHigh || !s.targetPrice || !s.stopLoss) return false
  if (s.entryZoneLow <= 0 || s.entryZoneHigh <= 0 || s.targetPrice <= 0 || s.stopLoss <= 0) return false
  return true
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const freshSignals = await prisma.signal.findMany({
      where: { isActive: true, autoGenerated: true, createdAt: { gte: cutoff24h } },
      select: { ticker: true },
    })
    const freshTickers = new Set(freshSignals.map((s) => s.ticker))

    const filteredLargeCap = LARGE_CAP_WATCHLIST.filter((t) => !freshTickers.has(t))
    const filteredSmallCap = SMALL_CAP_WATCHLIST.filter((t) => !freshTickers.has(t))

    if (filteredLargeCap.length === 0 && filteredSmallCap.length === 0) {
      await prisma.signalGenerationLog.create({ data: { signalCount: 0, status: 'skipped' } })
      return NextResponse.json({ ok: true, count: 0, largeCap: 0, smallCap: 0, skipped: true })
    }

    // Fetch enriched data for both universes (each limited to top 20 for enrichment)
    const [largeCapData, smallCapData] = await Promise.all([
      filteredLargeCap.length > 0 ? fetchStockData(filteredLargeCap, true) : Promise.resolve([]),
      filteredSmallCap.length > 0 ? fetchStockData(filteredSmallCap, false) : Promise.resolve([]),
    ])

    if (largeCapData.length === 0 && smallCapData.length === 0) {
      await prisma.signalGenerationLog.create({ data: { signalCount: 0, status: 'no_data' } })
      return NextResponse.json({ ok: true, count: 0, largeCap: 0, smallCap: 0 })
    }

    const [rawLarge, rawSmall] = await Promise.all([
      largeCapData.length > 0 ? generateSignals(largeCapData, 10, 'large') : Promise.resolve([]),
      smallCapData.length > 0 ? generateSignals(smallCapData, 8, 'small') : Promise.resolve([]),
    ])

    let finalSmall = rawSmall
    if (rawSmall.length < 5 && smallCapData.length > 0) {
      finalSmall = await generateSignals(smallCapData, 8, 'small')
    }

    const seenTickers = new Set<string>(freshTickers)
    function dedup(signals: GeneratedSignal[]): GeneratedSignal[] {
      return signals.filter((s) => {
        if (seenTickers.has(s.ticker) || !validateSignal(s)) return false
        seenTickers.add(s.ticker)
        return true
      })
    }

    const validLarge = dedup(rawLarge)
    const validSmall = dedup(finalSmall)

    const diverseLarge = applySectorDiversity(validLarge, 3)
    const diverseSmall = applySectorDiversity(validSmall, 3)

    const allSignals = [...diverseLarge, ...diverseSmall]

    if (allSignals.length === 0) {
      await prisma.signalGenerationLog.create({ data: { signalCount: 0, status: 'no_signals' } })
      return NextResponse.json({ ok: true, count: 0, largeCap: 0, smallCap: 0 })
    }

    const largeCapCount = allSignals.filter((s) => LARGE_CAP.has(s.ticker)).length
    const smallCapCount = allSignals.length - largeCapCount

    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000)

    await prisma.$transaction([
      prisma.signal.updateMany({
        where: { autoGenerated: true, createdAt: { lt: cutoff48h } },
        data: { isActive: false },
      }),
      ...allSignals.map((s) =>
        prisma.signal.create({
          data: {
            ticker: s.ticker,
            companyName: s.companyName,
            signalType: s.signalType,
            entryZoneLow: s.entryZoneLow,
            entryZoneHigh: s.entryZoneHigh,
            targetPrice: s.targetPrice,
            stopLoss: s.stopLoss,
            confidence: s.confidence,
            timeHorizon: s.timeHorizon,
            thesis: s.thesis,
            aiSummary: s.aiSummary,
            sector: s.sector,
            signalCategory: LARGE_CAP.has(s.ticker) ? 'large_cap' : 'small_cap',
            marketCap: LARGE_CAP.has(s.ticker) ? 15 : 2,
            isActive: true,
            autoGenerated: true,
          },
        })
      ),
      prisma.signalGenerationLog.create({
        data: { signalCount: allSignals.length, status: 'success' },
      }),
    ])

    return NextResponse.json({ ok: true, count: allSignals.length, largeCap: largeCapCount, smallCap: smallCapCount })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/signals]', msg)
    await prisma.signalGenerationLog.create({ data: { signalCount: 0, status: 'error', error: msg } }).catch(() => {})
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
