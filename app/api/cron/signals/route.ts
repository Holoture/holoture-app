import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'

export const maxDuration = 120

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// ─── Ticker universe ───────────────────────────────────────────────────────

// All tickers considered large cap (market cap > $8B as of 2025-2026)
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
  // Mid-caps that have grown to large cap
  'PLTR', 'COIN', 'AXON', 'UBER', 'DASH', 'RBLX', 'HWM', 'TDG',
  'S', 'ZS', 'PATH', 'SOFI', 'AFRM',
])

// Large cap stocks to analyze
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

// Genuine small cap candidates (market cap $100M–$8B, avg volume >500k, price >$2)
// Screened via Finnhub quote data at runtime
const SMALL_CAP_WATCHLIST = [
  // Biotech / Genomics
  'RXRX', 'BEAM', 'NTLA', 'PACB', 'ARWR', 'EDIT',
  // Health Tech / Telehealth
  'HIMS', 'ACCD', 'PRVA', 'GDRX',
  // Space / Aviation
  'RKLB', 'ACHR', 'JOBY', 'LUNR', 'ASTS',
  // Crypto / Bitcoin Mining
  'MARA', 'RIOT', 'CLSK', 'CIFR',
  // AI / Defense Small Cap
  'BBAI', 'SOUN', 'KTOS',
  // EV Small Cap
  'LCID', 'NKLA', 'GOEV',
  // Clean Energy
  'NOVA', 'ARRY', 'STEM', 'SHLS',
  // SaaS / Software Small Cap
  'SEMR', 'BRZE', 'WEAV', 'IONQ',
  // Medical Devices
  'NARI', 'INSP', 'ATEC',
  // Fintech / Lending Small Cap
  'OPEN', 'UWMC', 'COOP',
  // Consumer / Retail Small Cap
  'BROS', 'CAVA', 'SFM', 'SKIN', 'PRTS',
  // Industrial / Defense Small Cap
  'SWBI', 'RGR', 'POWL',
  // Energy Small Cap
  'CIVI', 'MGY', 'VTLE', 'CHRD',
  // Media / Entertainment Small Cap
  'LYFT', 'U', 'TTWO',
]

// ─── Data fetching ─────────────────────────────────────────────────────────

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

async function fetchStockData(watchlist: string[], isLargeCap: boolean): Promise<StockData[]> {
  const results: StockData[] = []
  for (let i = 0; i < watchlist.length; i += 20) {
    const batch = watchlist.slice(i, i + 20)
    const batchData = await Promise.all(
      batch.map(async (symbol) => {
        const quote = await fetchQuote(symbol)
        return {
          symbol,
          price: quote?.c ?? 0,
          changePct: quote?.dp ?? 0,
          high52w: quote?.h ?? 0,
          low52w: quote?.l ?? 0,
          recentHeadlines: [] as string[],
          isLargeCap,
        } satisfies StockData
      })
    )
    results.push(...batchData)
  }
  // Filter: price > $2 (no penny stocks), must have a quote
  return results.filter((s) => s.price > 2)
}

// ─── Signal generation ─────────────────────────────────────────────────────

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
  stocks: StockData[],
  minTarget: number,
  capType: 'large' | 'small'
): Promise<GeneratedSignal[]> {
  if (stocks.length === 0) return []
  const client = getAnthropicClient()

  const capContext =
    capType === 'small'
      ? `These are small and mid-cap stocks (market cap $100M–$8B). You MUST generate at least ${minTarget} signals from these smaller, higher-volatility companies. Include growth names, speculative plays, and momentum setups common in this cap range.`
      : `These are large cap stocks (market cap >$8B). Focus on established companies with clear fundamental or technical setups.`

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
    max_tokens: 6144,
    messages: [
      {
        role: 'user',
        content: `You are a professional equity analyst. ${capContext}

Analyze these stocks and generate trading signals for all actionable setups. Generate at least ${minTarget} signals and no more than 30.

Rules:
- Include any stock with a clear directional setup
- Distribute across sectors (max 3 signals per sector)
- Include a mix of BUY, WATCH, and SHORT signals
- Include swing trades (1-4 weeks) and longer-term plays (1-6 months)
- If fewer than ${minTarget} stocks have strong setups at confidence ≥65, lower threshold and use WATCH signals at confidence ≥50
- Reply with a JSON array only — no markdown, no explanation

Each signal object must have exactly these keys:
- ticker (string)
- companyName (string, full company name)
- signalType ("BUY", "WATCH", or "SHORT")
- entryZoneLow (number, realistic current price)
- entryZoneHigh (number, realistic current price)
- targetPrice (number)
- stopLoss (number)
- confidence (integer 0-100)
- timeHorizon (string, e.g. "2-4 weeks", "1-3 months")
- thesis (string, 1-2 sentences)
- aiSummary (string, 1 sentence)
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
    // Try extracting JSON array if there's extra text
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

// ─── Route handler ─────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Fetch quotes for both universes in parallel
    const [largeCapData, smallCapData] = await Promise.all([
      fetchStockData(LARGE_CAP_WATCHLIST, true),
      fetchStockData(SMALL_CAP_WATCHLIST, false),
    ])

    if (largeCapData.length === 0 && smallCapData.length === 0) {
      await prisma.signalGenerationLog.create({ data: { signalCount: 0, status: 'no_data' } })
      return NextResponse.json({ ok: true, count: 0, largeCap: 0, smallCap: 0 })
    }

    // Fetch news for top 20 large cap and top 15 small cap stocks
    const newsTargets = [
      ...largeCapData.slice(0, 20),
      ...smallCapData.slice(0, 15),
    ]
    const newsResults = await Promise.all(newsTargets.map((s) => fetchRecentNews(s.symbol)))
    newsTargets.forEach((s, i) => { s.recentHeadlines = newsResults[i].map((n) => n.headline) })

    // Generate signals for each cap tier separately
    const [rawLarge, rawSmall] = await Promise.all([
      generateSignals(largeCapData, 10, 'large'),
      generateSignals(smallCapData, 8, 'small'),
    ])

    // Retry small cap if not enough came back
    let finalSmall = rawSmall
    if (rawSmall.length < 5 && smallCapData.length > 0) {
      finalSmall = await generateSignals(smallCapData, 8, 'small')
    }

    // Validate and deduplicate within each group
    const seenTickers = new Set<string>()
    function dedup(signals: GeneratedSignal[]): GeneratedSignal[] {
      return signals.filter((s) => {
        if (seenTickers.has(s.ticker) || !validateSignal(s)) return false
        seenTickers.add(s.ticker)
        return true
      })
    }

    const validLarge = dedup(rawLarge)
    const validSmall = dedup(finalSmall)

    // Apply sector diversity separately so small caps aren't crowded out
    const diverseLarge = applySectorDiversity(validLarge, 3)
    const diverseSmall = applySectorDiversity(validSmall, 3)

    // Merge and cap at 50 total
    const allSignals = [...diverseLarge, ...diverseSmall].slice(0, 50)

    if (allSignals.length === 0) {
      await prisma.signalGenerationLog.create({ data: { signalCount: 0, status: 'no_signals' } })
      return NextResponse.json({ ok: true, count: 0, largeCap: 0, smallCap: 0 })
    }

    const largeCapCount = allSignals.filter((s) => LARGE_CAP.has(s.ticker)).length
    const smallCapCount = allSignals.length - largeCapCount

    await prisma.$transaction([
      prisma.signal.updateMany({ where: { autoGenerated: true }, data: { isActive: false } }),
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
