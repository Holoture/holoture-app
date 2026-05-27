import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'

export const maxDuration = 120

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// ─── Types ─────────────────────────────────────────────────────────────────

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

// ─── Normalization helpers ─────────────────────────────────────────────────

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

function safeDate(raw: string | number | undefined | null): Date {
  if (!raw) return new Date()
  const d = new Date(raw)
  return isNaN(d.getTime()) ? new Date() : d
}

// ─── Quiver Quantitative parser ────────────────────────────────────────────
// Docs: https://api.quiverquant.com  (free tier, register at quiverquant.com)
// Add QUIVER_API_KEY to Vercel env vars

function parseQuiver(data: unknown): NormalizedTrade[] {
  if (!Array.isArray(data)) return []
  const trades: NormalizedTrade[] = []

  for (const item of data) {
    if (!item || typeof item !== 'object') continue
    const t = item as Record<string, unknown>

    const ticker = String(t['Ticker'] ?? '').toUpperCase().trim()
    if (!ticker || ticker === '--') continue

    const rep = String(t['Representative'] ?? '').trim()
    if (!rep) continue

    const txDate = String(t['Date'] ?? t['TransactionDate'] ?? '')
    const externalId = `quiver-${rep}-${ticker}-${txDate}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')

    trades.push({
      externalId,
      politicianName: rep,
      party: normalizeParty(String(t['Party'] ?? '')),
      chamber: normalizeChamber(String(t['House'] ?? t['Chamber'] ?? 'House')),
      ticker,
      companyName: String(t['Description'] ?? t['Company'] ?? ''),
      tradeType: normalizeTradeType(String(t['Transaction'] ?? t['Type'] ?? '')),
      amountRange: String(t['Range'] ?? t['Amount'] ?? 'Unknown'),
      tradedAt: safeDate(txDate),
      filedAt: safeDate(String(t['FilingDate'] ?? t['Date'] ?? '')),
    })
  }

  return trades
}

// ─── Fetch from available sources ─────────────────────────────────────────

async function fetchTrades(): Promise<{ trades: NormalizedTrade[]; diagnostic: string }> {
  let diagnostic = ''
  const quiverKey = process.env.QUIVER_API_KEY

  if (!quiverKey) {
    diagnostic = 'QUIVER_API_KEY not set — add it to Vercel env vars (free at quiverquant.com)'
    return { trades: [], diagnostic }
  }

  // Quiver Quantitative congressional trading endpoint
  const sources = [
    'https://api.quiverquant.com/beta/live/congresstrading',
    'https://api.quiverquant.com/beta/bulk/congresstrading',
  ]

  for (const url of sources) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          Authorization: `Token ${quiverKey}`,
          'X-CSRFToken': 'null',
        },
      })
      diagnostic += `[${url}] HTTP ${res.status}; `
      if (!res.ok) continue

      const raw = await res.text()
      diagnostic += `body_len=${raw.length} preview=${raw.slice(0, 150)}; `

      let data: unknown
      try { data = JSON.parse(raw) } catch { diagnostic += 'invalid JSON; '; continue }

      const trades = parseQuiver(data)
      diagnostic += `parsed=${trades.length}; `
      if (trades.length > 0) {
        // Sort by tradedAt descending, take the 50 most recent
        trades.sort((a, b) => b.tradedAt.getTime() - a.tradedAt.getTime())
        return { trades: trades.slice(0, 50), diagnostic }
      }
    } catch (e) {
      diagnostic += `error=${String(e).slice(0, 100)}; `
    }
  }

  return { trades: [], diagnostic }
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
    const { trades, diagnostic } = await fetchTrades()

    if (trades.length === 0) {
      return NextResponse.json({ ok: true, count: 0, note: 'No trades fetched', diagnostic })
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
      } catch { /* skip on constraint error */ }
    }

    return NextResponse.json({ ok: true, count: upserted, total: trades.length, diagnostic })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/politician]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
