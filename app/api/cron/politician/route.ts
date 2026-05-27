import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'

export const maxDuration = 120

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// ─── Capitol Trades API ────────────────────────────────────────────────────

type NormalizedTrade = {
  externalId: string
  politicianName: string
  party: string
  chamber: string
  ticker: string
  companyName: string
  tradeType: string
  amountRange: string
  tradedAt: Date
  filedAt: Date
}

function normalizeParty(raw: string): string {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('democrat') || lower === 'd') return 'Democrat'
  if (lower.includes('republican') || lower === 'r') return 'Republican'
  if (lower.includes('independent') || lower === 'i') return 'Independent'
  return raw || 'Unknown'
}

function normalizeChamber(raw: string): string {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('senate') || lower === 's') return 'Senate'
  return 'House'
}

function normalizeTradeType(raw: string): string {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('purchase') || lower === 'buy' || lower === 'p') return 'BUY'
  if (lower.includes('sale') || lower === 'sell' || lower === 's') return 'SELL'
  return (raw ?? 'UNKNOWN').toUpperCase()
}

function safeDate(raw: string | undefined | null): Date {
  if (!raw) return new Date()
  const d = new Date(raw)
  return isNaN(d.getTime()) ? new Date() : d
}

function parseCapitolTrades(data: unknown): NormalizedTrade[] {
  if (!data || typeof data !== 'object') return []
  const obj = data as Record<string, unknown>

  // Try top-level array first
  const rawArray: unknown[] = Array.isArray(obj) ? obj
    : Array.isArray(obj['data']) ? (obj['data'] as unknown[])
    : Array.isArray(obj['trades']) ? (obj['trades'] as unknown[])
    : []

  const trades: NormalizedTrade[] = []

  for (const item of rawArray) {
    if (!item || typeof item !== 'object') continue
    const t = item as Record<string, unknown>

    // Determine external ID (handle _id, id, uuid)
    const externalId = String(t['_id'] ?? t['id'] ?? t['uuid'] ?? '')
    if (!externalId) continue

    // Handle flat format: { politician: {...}, asset: {...}, txType, txDate, filingDate }
    // Handle JSON:API format: { attributes: { politician: {...}, asset: {...}, ... } }
    const attrs = (t['attributes'] && typeof t['attributes'] === 'object')
      ? (t['attributes'] as Record<string, unknown>)
      : t

    const politician = (attrs['politician'] && typeof attrs['politician'] === 'object')
      ? attrs['politician'] as Record<string, unknown>
      : {}
    const asset = (attrs['asset'] && typeof attrs['asset'] === 'object')
      ? attrs['asset'] as Record<string, unknown>
      : {}

    const politicianName = String(politician['name'] ?? attrs['politicianName'] ?? t['politicianName'] ?? '')
    const party = normalizeParty(String(politician['party'] ?? attrs['party'] ?? t['party'] ?? ''))
    const chamber = normalizeChamber(String(politician['chamber'] ?? attrs['chamber'] ?? t['chamber'] ?? 'house'))

    const ticker = String(asset['ticker'] ?? asset['assetTicker'] ?? attrs['ticker'] ?? t['ticker'] ?? '').toUpperCase()
    const companyName = String(asset['name'] ?? asset['assetName'] ?? attrs['companyName'] ?? attrs['assetName'] ?? '')

    const tradeType = normalizeTradeType(String(
      attrs['txType'] ?? attrs['type'] ?? attrs['tradeType'] ?? t['txType'] ?? t['type'] ?? ''
    ))

    const amountRange = String(
      attrs['amount'] ?? attrs['amountRange'] ?? t['amount'] ?? 'Unknown'
    )

    const tradedAt = safeDate(String(
      attrs['txDate'] ?? attrs['tradeDate'] ?? attrs['transactionDate'] ?? t['txDate'] ?? ''
    ))
    const filedAt = safeDate(String(
      attrs['filingDate'] ?? attrs['pubDate'] ?? attrs['filedDate'] ?? t['filingDate'] ?? t['pubDate'] ?? ''
    ))

    if (!politicianName || !ticker) continue

    trades.push({ externalId, politicianName, party, chamber, ticker, companyName, tradeType, amountRange, tradedAt, filedAt })
  }

  return trades
}

async function fetchFromCapitolTrades(): Promise<NormalizedTrade[]> {
  const urls = [
    'https://api.capitoltrades.com/trades?page[size]=50&sort=-pubDate',
    'https://api.capitoltrades.com/trades?pageSize=50&sort=-filingDate',
    'https://api.capitoltrades.com/trades?limit=50',
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json', 'User-Agent': 'Holoture/1.0' },
      })
      if (!res.ok) continue
      const data = await res.json()
      const trades = parseCapitolTrades(data)
      if (trades.length > 0) return trades
    } catch { continue }
  }
  return []
}

// ─── Commentary generation ─────────────────────────────────────────────────

async function generateCommentary(
  trades: NormalizedTrade[]
): Promise<Map<string, { commentary: string; significance: 'Low' | 'Medium' | 'High' }>> {
  if (trades.length === 0) return new Map()
  const client = getAnthropicClient()

  const input = trades.map((t, i) => ({
    index: i,
    politician: t.politicianName,
    party: t.party,
    chamber: t.chamber,
    ticker: t.ticker,
    company: t.companyName,
    type: t.tradeType,
    amount: t.amountRange,
    tradeDate: t.tradedAt.toISOString().split('T')[0],
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

  const result = new Map<string, { commentary: string; significance: 'Low' | 'Medium' | 'High' }>()
  try {
    const parsed = JSON.parse(cleaned) as { index: number; commentary: string; significance: string }[]
    for (const item of parsed) {
      const trade = trades[item.index]
      if (trade) {
        const sig: 'Low' | 'Medium' | 'High' =
          item.significance === 'High' ? 'High'
          : item.significance === 'Medium' ? 'Medium'
          : 'Low'
        result.set(trade.externalId, { commentary: item.commentary, significance: sig })
      }
    }
  } catch {
    for (const t of trades) {
      result.set(t.externalId, { commentary: 'Trade filed per STOCK Act disclosure requirements.', significance: 'Low' })
    }
  }
  return result
}

// ─── Route handler ─────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const trades = await fetchFromCapitolTrades()

    if (trades.length === 0) {
      return NextResponse.json({ ok: true, count: 0, note: 'Capitol Trades API returned no data' })
    }

    // Generate commentary in batches of 25 to stay under token limits
    const batch1 = trades.slice(0, 25)
    const batch2 = trades.slice(25)
    const [map1, map2] = await Promise.all([
      generateCommentary(batch1),
      generateCommentary(batch2),
    ])
    const commentaryMap = new Map([...map1, ...map2])

    let upserted = 0
    for (const trade of trades) {
      const commentary = commentaryMap.get(trade.externalId)
      try {
        await prisma.politicianTrade.upsert({
          where: { externalId: trade.externalId },
          create: {
            externalId: trade.externalId,
            politicianName: trade.politicianName,
            party: trade.party,
            chamber: trade.chamber,
            ticker: trade.ticker,
            companyName: trade.companyName,
            tradeType: trade.tradeType,
            amountRange: trade.amountRange,
            tradedAt: trade.tradedAt,
            filedAt: trade.filedAt,
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
      } catch { /* skip duplicate constraint */ }
    }

    return NextResponse.json({ ok: true, count: upserted, total: trades.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/politician]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
