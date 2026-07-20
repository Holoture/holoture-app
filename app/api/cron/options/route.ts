import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { getQuotes, getOptionChain, type OptionContract } from '@/lib/schwab'

export const maxDuration = 120

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// High-volume tickers well-suited for options analysis (mega-cap options
// liquidity list — separate from the daily-signal universe, left untouched).
const OPTIONS_TICKERS = [
  'AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'AMZN', 'GOOGL', 'AMD', 'SPY', 'QQQ',
  'PLTR', 'COIN', 'NFLX', 'UBER', 'CRM', 'AVGO', 'V', 'JPM', 'BAC', 'XOM',
]

// Candidate contracts handed to Claude are pre-filtered to a sane
// directional-trade band — mid-delta, has an actual quote, not dead. Claude
// picks ONE real contract per idea from this list; it never sees (and can
// never invent) a strike/expiration that isn't on the real chain.
function curateContracts(contracts: OptionContract[]): OptionContract[] {
  return contracts
    .filter((c) => c.bid > 0 && c.ask > 0 && c.delta !== null && Math.abs(c.delta) >= 0.15 && Math.abs(c.delta) <= 0.75)
    .filter((c) => c.openInterest > 0 || c.totalVolume > 0)
    .sort((a, b) => b.openInterest - a.openInterest)
    .slice(0, 25)
}

// Cross-sectional IV percentile of one contract against the curated
// candidate set for the same underlying (same chain snapshot). Explicitly
// NOT a historical IV rank — Schwab has no IV-history endpoint to compute
// that from.
function ivPercentileOf(contract: OptionContract, pool: OptionContract[]): number | null {
  if (contract.volatility === null) return null
  const ivs = pool.map((c) => c.volatility).filter((v): v is number => v !== null)
  if (ivs.length < 2) return null
  const below = ivs.filter((v) => v <= contract.volatility!).length
  return Math.round((below / ivs.length) * 1000) / 10
}

type ClaudePick = {
  ticker: string
  optionSymbol: string // must be an exact symbol from the curated list handed to Claude
  confidence: number
  reasoning: string
  summary: string
  riskLevel: 'High' | 'Medium' | 'Low'
}

async function pickContracts(
  perTicker: Array<{
    symbol: string
    price: number
    changePct: number
    high52w: number
    low52w: number
    candidates: OptionContract[]
  }>
): Promise<ClaudePick[]> {
  const client = getAnthropicClient()

  const prompt = perTicker.map((t) => ({
    ticker: t.symbol,
    price: t.price,
    changePct: t.changePct,
    high52w: t.high52w,
    low52w: t.low52w,
    // Real, currently-quoted contracts only. Claude may recommend ONLY
    // one of these exact optionSymbol values per ticker it chooses to use.
    realCandidateContracts: t.candidates.map((c) => ({
      optionSymbol: c.symbol,
      putCall: c.putCall,
      strike: c.strike,
      expirationDate: c.expirationDate,
      dte: c.dte,
      bid: c.bid,
      ask: c.ask,
      mark: c.mark,
      impliedVolatility: c.volatility,
      openInterest: c.openInterest,
      delta: c.delta,
    })),
  }))

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are an expert options trader. For each ticker below you are given real, currently-quoted option contracts (real strikes, real expirations, real bid/ask, real IV, real open interest, real delta) — NOT hypothetical numbers.

Your job: for the tickers where you have genuine directional conviction, pick exactly ONE contract from that ticker's realCandidateContracts list that best fits a directional trade thesis (e.g. ~30-45 DTE, delta 0.30-0.45 for a clean directional bet; shorter DTE only for a high-conviction near-term catalyst).

CRITICAL RULES:
- optionSymbol in your response MUST be copied EXACTLY, character-for-character, from one of the realCandidateContracts you were given for that ticker. Never invent, modify, or guess a symbol.
- Do not invent a strike, expiration, premium, or any other numeric field — you are selecting from real data only, not generating new numbers.
- Skip any ticker where nothing in its candidate list fits a clean directional thesis. Quality over coverage — 4-10 picks total is fine.
- Reply with a JSON array ONLY, no markdown, no explanation outside the JSON.

Each item must have exactly these keys:
- ticker (string)
- optionSymbol (string — copied exactly from realCandidateContracts)
- confidence (integer 0-100)
- reasoning (string, 2-3 sentences — why this specific contract fits the thesis)
- summary (string, 1 sentence)
- riskLevel ("High", "Medium", or "Low")

Today: ${new Date().toISOString().split('T')[0]}

Data:
${JSON.stringify(prompt, null, 2)}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    return JSON.parse(cleaned) as ClaudePick[]
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (match) {
      try { return JSON.parse(match[0]) as ClaudePick[] } catch { return [] }
    }
    return []
  }
}

const COMPANY_NAMES: Record<string, string> = {
  AAPL: 'Apple Inc.', MSFT: 'Microsoft Corporation', NVDA: 'NVIDIA Corporation', TSLA: 'Tesla, Inc.',
  META: 'Meta Platforms, Inc.', AMZN: 'Amazon.com, Inc.', GOOGL: 'Alphabet Inc.', AMD: 'Advanced Micro Devices, Inc.',
  SPY: 'SPDR S&P 500 ETF Trust', QQQ: 'Invesco QQQ Trust', PLTR: 'Palantir Technologies Inc.', COIN: 'Coinbase Global, Inc.',
  NFLX: 'Netflix, Inc.', UBER: 'Uber Technologies, Inc.', CRM: 'Salesforce, Inc.', AVGO: 'Broadcom Inc.',
  V: 'Visa Inc.', JPM: 'JPMorgan Chase & Co.', BAC: 'Bank of America Corporation', XOM: 'Exxon Mobil Corporation',
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [quotes, chains] = await Promise.all([
      getQuotes(OPTIONS_TICKERS),
      Promise.all(OPTIONS_TICKERS.map((sym) => getOptionChain(sym))),
    ])

    const chainByTicker = new Map<string, { underlyingPrice: number | null; contracts: OptionContract[] }>()
    OPTIONS_TICKERS.forEach((sym, i) => {
      const chain = chains[i]
      if (chain) chainByTicker.set(sym, chain)
    })

    const perTicker = OPTIONS_TICKERS.map((symbol) => {
      const q = quotes.get(symbol)
      const chain = chainByTicker.get(symbol)
      const candidates = chain ? curateContracts(chain.contracts) : []
      return {
        symbol,
        price: q?.lastPrice ?? 0,
        changePct: q?.netPercentChange ?? 0,
        high52w: q?.week52High ?? 0,
        low52w: q?.week52Low ?? 0,
        candidates,
      }
    }).filter((t) => t.price > 0 && t.candidates.length > 0)

    if (perTicker.length === 0) return NextResponse.json({ ok: true, count: 0, reason: 'no_chain_data' })

    const picks = await pickContracts(perTicker)
    if (picks.length === 0) return NextResponse.json({ ok: true, count: 0, reason: 'no_picks' })

    // Validate every pick against the real chain before saving — reject
    // anything whose optionSymbol doesn't actually exist on that ticker's
    // fetched chain. This is the hard guarantee against fabrication: no
    // signal is stored unless its exact contract was present in Schwab's
    // live chain response for that ticker.
    const validated = picks
      .map((p) => {
        const ticker = perTicker.find((t) => t.symbol === p.ticker)
        if (!ticker) return null
        const contract = ticker.candidates.find((c) => c.symbol === p.optionSymbol)
        if (!contract) return null
        return { pick: p, ticker, contract }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    if (validated.length === 0) {
      return NextResponse.json({ ok: true, count: 0, reason: 'all_picks_failed_chain_validation', rawPickCount: picks.length })
    }

    await prisma.$transaction([
      prisma.optionsSignal.updateMany({ where: { autoGenerated: true }, data: { isActive: false } }),
      ...validated.map(({ pick, ticker, contract }) => {
        const ivPercentile = ivPercentileOf(contract, ticker.candidates)
        // Long-option max risk = premium paid x 100 shares/contract. These
        // are single-leg directional recommendations, not spreads, so risk
        // is bounded exactly at the debit paid.
        const maxRisk = Math.round(contract.mark * 100 * 100) / 100
        return prisma.optionsSignal.create({
          data: {
            ticker: pick.ticker,
            companyName: COMPANY_NAMES[pick.ticker] ?? pick.ticker,
            contractType: contract.putCall,
            strikePrice: contract.strike,
            expirationDate: contract.expirationDate,
            premiumEstimate: contract.mark,
            confidence: pick.confidence,
            reasoning: pick.reasoning,
            summary: pick.summary,
            riskLevel: pick.riskLevel,
            optionSymbol: contract.symbol,
            bid: contract.bid,
            ask: contract.ask,
            openInterest: contract.openInterest,
            impliedVolatility: contract.volatility,
            delta: contract.delta,
            gamma: contract.gamma,
            theta: contract.theta,
            vega: contract.vega,
            breakeven: contract.breakEven,
            maxRisk,
            ivPercentile,
            isActive: true,
            autoGenerated: true,
          },
        })
      }),
    ])

    return NextResponse.json({
      ok: true,
      count: validated.length,
      rejectedByChainValidation: picks.length - validated.length,
    })
  } catch (err) {
    console.error('[cron/options]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
