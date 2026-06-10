import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'

export const maxDuration = 60

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// ─── Types ─────────────────────────────────────────────────────────────────

type RawTrade = {
  politician_name: string
  party: string
  chamber: string
  ticker: string
  company_name: string
  trade_type: string
  amount_range: string
  traded_at: string
  filed_at: string
}

// ─── Normalization ─────────────────────────────────────────────────────────

function normParty(raw: string): string {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('democrat') || lower === 'd') return 'Democrat'
  if (lower.includes('republican') || lower === 'r') return 'Republican'
  if (lower.includes('independent') || lower === 'i') return 'Independent'
  return raw || 'Unknown'
}

function normChamber(raw: string): string {
  return (raw ?? '').toLowerCase().includes('senate') ? 'Senate' : 'House'
}

function normTradeType(raw: string): string {
  const lower = (raw ?? '').toLowerCase()
  if (lower === 'buy' || lower.includes('purchase')) return 'BUY'
  if (lower === 'sell' || lower.includes('sale')) return 'SELL'
  return (raw ?? 'UNKNOWN').toUpperCase()
}

function safeDate(raw: string): Date {
  if (!raw) return new Date()
  const d = new Date(raw)
  return isNaN(d.getTime()) ? new Date() : d
}

// ─── Fetch data committed by the GitHub Action scraper ────────────────────
// The scraper runs daily and commits data/all_trades.json to master.
// raw.githubusercontent.com always returns fresh content from that branch.

const DATA_URL =
  'https://raw.githubusercontent.com/Holoture/holoture-app/master/data/all_trades.json'

async function fetchTrades(): Promise<{ trades: RawTrade[]; diagnostic: string }> {
  let diagnostic = ''
  try {
    const res = await fetch(DATA_URL, { cache: 'no-store' })
    diagnostic += `HTTP ${res.status}; `
    if (!res.ok) return { trades: [], diagnostic }

    const raw = await res.text()
    diagnostic += `body_len=${raw.length}; `

    const data = JSON.parse(raw) as RawTrade[]
    if (!Array.isArray(data)) return { trades: [], diagnostic: diagnostic + 'not an array; ' }

    // Discard incomplete rows and rows with an impossible (future) trade date —
    // PDF text extraction occasionally misreads a year and produces a date
    // that's after the filing date / in the future.
    const today = new Date().toISOString().slice(0, 10)
    const valid = data.filter(
      (t) =>
        t.politician_name &&
        t.ticker &&
        t.trade_type &&
        t.traded_at &&
        t.traded_at <= today
    )
    diagnostic += `records=${data.length} valid=${valid.length}; `
    return { trades: valid.slice(0, 50), diagnostic }
  } catch (e) {
    diagnostic += `error=${String(e).slice(0, 120)}`
    return { trades: [], diagnostic }
  }
}

// ─── Company name enrichment ───────────────────────────────────────────────
// House PTR PDFs sometimes don't yield a clean company name, leaving
// company_name === ticker. Backfill the real name from Finnhub's company
// profile endpoint (free tier).

async function fetchCompanyName(ticker: string): Promise<string | null> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return null
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${key}`,
      { cache: 'no-store', signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    return typeof data.name === 'string' && data.name.trim() ? data.name.trim() : null
  } catch { return null }
}

async function enrichCompanyNames(trades: RawTrade[]): Promise<RawTrade[]> {
  const needsLookup = [...new Set(
    trades.filter((t) => t.company_name === t.ticker).map((t) => t.ticker)
  )]
  if (needsLookup.length === 0) return trades

  const names = await Promise.all(needsLookup.map((t) => fetchCompanyName(t)))
  const nameMap = new Map<string, string>()
  needsLookup.forEach((ticker, i) => {
    if (names[i]) nameMap.set(ticker, names[i]!)
  })
  if (nameMap.size === 0) return trades

  return trades.map((t) =>
    t.company_name === t.ticker && nameMap.has(t.ticker)
      ? { ...t, company_name: nameMap.get(t.ticker)! }
      : t
  )
}

// ─── Commentary generation ─────────────────────────────────────────────────

type CommentaryResult = Map<string, { commentary: string; significance: 'Low' | 'Medium' | 'High' }>

async function generateCommentary(trades: RawTrade[]): Promise<CommentaryResult> {
  if (trades.length === 0) return new Map()
  const client = getAnthropicClient()

  const input = trades.map((t, i) => ({
    index: i,
    politician: t.politician_name,
    party: t.party,
    chamber: t.chamber,
    ticker: t.ticker,
    company: t.company_name,
    type: t.trade_type,
    amount: t.amount_range,
    tradeDate: t.traded_at,
  }))

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: `You are a financial analyst reviewing congressional stock disclosures. For each trade, write one sentence of commentary on whether it is noteworthy or routine, and rate its significance.

High = large amount, committee relevance, or unusual timing relative to legislation
Medium = notable company/sector tie to politician's committee or known position
Low = routine small-dollar trade with no obvious conflict

Reply ONLY with a JSON array, no markdown:
[{"index":0,"commentary":"...","significance":"Low"}]

Trades:
${JSON.stringify(input)}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  const cleaned = text.replace(/```json\s*/i, '').replace(/```/g, '').trim()

  const result: CommentaryResult = new Map()
  try {
    const parsed = JSON.parse(cleaned) as { index: number; commentary: string; significance: string }[]
    for (const item of parsed) {
      const trade = trades[item.index]
      if (!trade) continue
      const key = `${trade.politician_name}|${trade.ticker}|${trade.traded_at}`
      const sig: 'Low' | 'Medium' | 'High' =
        item.significance === 'High' ? 'High'
        : item.significance === 'Medium' ? 'Medium'
        : 'Low'
      result.set(key, { commentary: item.commentary, significance: sig })
    }
  } catch {
    for (const t of trades) {
      const key = `${t.politician_name}|${t.ticker}|${t.traded_at}`
      result.set(key, { commentary: 'Trade filed per STOCK Act disclosure requirements.', significance: 'Low' })
    }
  }
  return result
}

// ─── Route handler ─────────────────────────────────────────────────────────

export async function DELETE(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { count } = await prisma.politicianTrade.deleteMany({})
    return NextResponse.json({ ok: true, deleted: count })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { trades, diagnostic } = await fetchTrades()

    if (trades.length === 0) {
      return NextResponse.json({
        ok: true,
        count: 0,
        note: 'No trades in data file — GitHub Action may not have run yet',
        diagnostic,
      })
    }

    const enrichedTrades = await enrichCompanyNames(trades)

    const batch1 = enrichedTrades.slice(0, 25)
    const batch2 = enrichedTrades.slice(25)
    const [map1, map2] = await Promise.all([
      generateCommentary(batch1),
      generateCommentary(batch2),
    ])
    const commentaryMap = new Map([...map1, ...map2])

    let upserted = 0
    for (const trade of enrichedTrades) {
      const externalId = `${trade.politician_name}|${trade.ticker}|${trade.traded_at}|${trade.trade_type}`
        .toLowerCase()
        .replace(/[^a-z0-9|]/g, '-')
      const key = `${trade.politician_name}|${trade.ticker}|${trade.traded_at}`
      const commentary = commentaryMap.get(key)

      try {
        await prisma.politicianTrade.upsert({
          where: { externalId },
          create: {
            externalId,
            politicianName: trade.politician_name,
            party: normParty(trade.party),
            chamber: normChamber(trade.chamber),
            ticker: trade.ticker.toUpperCase(),
            companyName: trade.company_name ?? '',
            tradeType: normTradeType(trade.trade_type),
            amountRange: trade.amount_range ?? 'Unknown',
            tradedAt: safeDate(trade.traded_at),
            filedAt: safeDate(trade.filed_at),
            aiCommentary: commentary?.commentary ?? '',
            significance: commentary?.significance ?? 'Low',
          },
          update: {
            aiCommentary: commentary?.commentary ?? '',
            significance: commentary?.significance ?? 'Low',
            fetchedAt: new Date(),
          },
        })
        upserted++
      } catch { /* skip on constraint error */ }
    }

    return NextResponse.json({ ok: true, count: upserted, total: trades.length, diagnostic })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/politician]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
