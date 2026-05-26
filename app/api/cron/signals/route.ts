import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'

export const maxDuration = 60

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// Large cap (>$8B market cap) — pre-tagged for categorization
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
])

// Full 80-ticker universe across market caps and sectors (all >$100M market cap)
const WATCHLIST = [
  // Large Cap — Technology
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AVGO', 'AMD', 'QCOM',
  'INTC', 'TXN', 'MU', 'AMAT', 'ADBE', 'CRM', 'ORCL',
  // Large Cap — Finance
  'JPM', 'BAC', 'GS', 'V', 'MA', 'C', 'WFC', 'MS', 'BLK', 'SCHW', 'AXP',
  // Large Cap — Healthcare
  'JNJ', 'UNH', 'LLY', 'PFE', 'ABT', 'TMO', 'ISRG', 'AMGN', 'GILD',
  // Large Cap — Energy
  'XOM', 'CVX', 'COP', 'EOG', 'SLB',
  // Large Cap — Consumer
  'WMT', 'COST', 'MCD', 'SBUX', 'TGT', 'KO', 'PEP', 'NKE',
  // Large Cap — Industrial / Defense
  'CAT', 'HON', 'RTX', 'LMT', 'GE',
  // Large Cap — Communication
  'NFLX', 'DIS', 'CMCSA',
  // Mid/Small Cap — Tech & Growth
  'PLTR', 'COIN', 'CRWD', 'DDOG', 'SNOW', 'PATH', 'S', 'ZS', 'AFRM', 'SOFI',
  // Mid/Small Cap — Defense & Industrial
  'AXON', 'KTOS', 'HWM', 'TDG',
  // Mid/Small Cap — Consumer & Retail
  'SFM', 'CAVA', 'BROS', 'HIMS',
  // Mid/Small Cap — EV / Space / Innovation
  'RIVN', 'LCID', 'RKLB', 'IONQ', 'ACHR', 'JOBY',
  // Mid Cap — Other
  'UBER', 'LYFT', 'DASH', 'RBLX', 'U', 'TTWO',
]

type Quote = { c: number; d: number; dp: number; h: number; l: number; o: number; pc: number; t: number }
type NewsItem = { headline: string; datetime: number; source: string }

async function fetchQuote(symbol: string): Promise<Quote | null> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return null
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
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

type StockData = {
  symbol: string
  price: number
  changePct: number
  high52w: number
  low52w: number
  recentHeadlines: string[]
  isLargeCap: boolean
}

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

async function generateSignals(stocks: StockData[], minTarget: number): Promise<GeneratedSignal[]> {
  const client = getAnthropicClient()

  const stocksJson = stocks.map((s) => ({
    symbol: s.symbol,
    price: s.price,
    changePct: s.changePct,
    high52w: s.high52w,
    low52w: s.low52w,
    recentHeadlines: s.recentHeadlines,
  }))

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `You are a professional equity analyst. Analyze these stocks and generate trading signals for all actionable setups. Generate at least ${minTarget} signals and no more than 50.

Rules:
- Include any stock with a clear directional setup — do not artificially limit yourself
- Distribute signals across sectors (max 3 per sector)
- Include both Large Cap and Small/Mid Cap picks
- Include a mix of BUY, WATCH, and SHORT signals
- Include both swing trades (1-4 weeks) and longer term plays (1-6 months)
- If fewer than ${minTarget} stocks have strong setups at confidence ≥65, lower the threshold and include WATCH signals with confidence ≥50
- Reply with a JSON array only, no markdown, no explanation

For each signal include:
- ticker (string)
- companyName (string, full company name)
- signalType ("BUY", "WATCH", or "SHORT")
- entryZoneLow (number, realistic price)
- entryZoneHigh (number, realistic price)
- targetPrice (number)
- stopLoss (number)
- confidence (integer 0-100)
- timeHorizon (string, e.g. "2-4 weeks", "1-3 months")
- thesis (string, 1-2 sentences on why)
- aiSummary (string, 1 sentence summary)
- sector (string, e.g. "Technology", "Healthcare", "Finance", "Energy", "Consumer", "Industrials", "Defense", "Real Estate")

Stock data:
${JSON.stringify(stocksJson, null, 2)}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  try {
    return JSON.parse(text) as GeneratedSignal[]
  } catch {
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

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Fetch quotes in batches of 20 to respect rate limits
    const allStockData: StockData[] = []
    for (let i = 0; i < WATCHLIST.length; i += 20) {
      const batch = WATCHLIST.slice(i, i + 20)
      const results = await Promise.all(
        batch.map(async (symbol) => {
          const quote = await fetchQuote(symbol)
          return {
            symbol,
            price: quote?.c ?? 0,
            changePct: quote?.dp ?? 0,
            high52w: quote?.h ?? 0,
            low52w: quote?.l ?? 0,
            recentHeadlines: [] as string[],
            isLargeCap: LARGE_CAP.has(symbol),
          } satisfies StockData
        })
      )
      allStockData.push(...results)
    }

    // Fetch news for stocks that have price data (top 40 only to save API calls)
    const withData = allStockData.filter((s) => s.price > 0)
    if (withData.length === 0) {
      await prisma.signalGenerationLog.create({ data: { signalCount: 0, status: 'no_data' } })
      return NextResponse.json({ ok: true, count: 0 })
    }

    const top40 = withData.slice(0, 40)
    const newsResults = await Promise.all(top40.map((s) => fetchRecentNews(s.symbol)))
    top40.forEach((s, i) => { s.recentHeadlines = newsResults[i].map((n) => n.headline) })

    // First pass: target at least 15 signals
    let rawSignals = await generateSignals(withData, 15)

    // Retry if fewer than 15 came back — lower the bar
    if (rawSignals.length < 15) {
      rawSignals = await generateSignals(withData, 15)
    }

    if (rawSignals.length === 0) {
      await prisma.signalGenerationLog.create({ data: { signalCount: 0, status: 'no_signals' } })
      return NextResponse.json({ ok: true, count: 0 })
    }

    // Deduplicate tickers and validate prices
    const seenTickers = new Set<string>()
    const validated = rawSignals.filter((s) => {
      if (seenTickers.has(s.ticker)) return false
      seenTickers.add(s.ticker)
      if (!s.entryZoneLow || !s.entryZoneHigh || !s.targetPrice || !s.stopLoss) return false
      if (s.entryZoneLow <= 0 || s.entryZoneHigh <= 0 || s.targetPrice <= 0 || s.stopLoss <= 0) return false
      return true
    })

    // Apply sector diversity (max 3 per sector) and cap at 50
    const signals = applySectorDiversity(validated).slice(0, 50)

    if (signals.length === 0) {
      await prisma.signalGenerationLog.create({ data: { signalCount: 0, status: 'no_signals' } })
      return NextResponse.json({ ok: true, count: 0 })
    }

    await prisma.$transaction([
      prisma.signal.updateMany({ where: { autoGenerated: true }, data: { isActive: false } }),
      ...signals.map((s) =>
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
            marketCap: LARGE_CAP.has(s.ticker) ? 10 : 2, // approximate, in billions
            isActive: true,
            autoGenerated: true,
          },
        })
      ),
      prisma.signalGenerationLog.create({ data: { signalCount: signals.length, status: 'success' } }),
    ])

    return NextResponse.json({ ok: true, count: signals.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/signals]', msg)
    await prisma.signalGenerationLog.create({ data: { signalCount: 0, status: 'error', error: msg } }).catch(() => {})
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
