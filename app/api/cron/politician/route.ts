import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'

export const maxDuration = 60

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

type CapitolTrade = {
  id: string
  attributes: {
    politician?: { name?: string; party?: string; chamber?: string }
    asset?: { ticker?: string; name?: string }
    type?: string
    amount?: string
    pubDate?: string
    txDate?: string
  }
}

async function fetchPoliticianTrades(): Promise<CapitolTrade[]> {
  try {
    const res = await fetch(
      'https://api.capitoltrades.com/trades?page[size]=50&sort=-pubDate',
      { cache: 'no-store', headers: { Accept: 'application/json' } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.data) ? data.data : []
  } catch {
    return []
  }
}

type TradeForCommentary = {
  id: string
  politician: string
  party: string
  ticker: string
  company: string
  type: string
  amount: string
  date: string
}

async function generateCommentary(
  trades: TradeForCommentary[]
): Promise<{ id: string; commentary: string; significance: 'Low' | 'Medium' | 'High' }[]> {
  if (trades.length === 0) return []
  const client = getAnthropicClient()

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are a financial analyst reviewing politician stock trades. For each trade, provide a 1-sentence commentary on whether the trade is notable or significant for retail investors, and rate its significance.

Reply with a JSON array only, no markdown.
Format: [{"id":"...","commentary":"...","significance":"Low"}]
Significance levels: "Low" (routine), "Medium" (notable), "High" (potentially market-moving)

Trades:
${JSON.stringify(trades, null, 2)}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  try {
    return JSON.parse(text)
  } catch {
    return trades.map((t) => ({ id: t.id, commentary: 'Trade filed per disclosure requirements.', significance: 'Low' as const }))
  }
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rawTrades = await fetchPoliticianTrades()
    if (rawTrades.length === 0) {
      return NextResponse.json({ ok: true, count: 0, note: 'No trades from Capitol Trades API' })
    }

    const validTrades = rawTrades.filter((t) => {
      const a = t.attributes
      return t.id && a.politician?.name && a.asset?.ticker && a.type && a.pubDate
    })

    const forCommentary: TradeForCommentary[] = validTrades.map((t) => ({
      id: t.id,
      politician: t.attributes.politician?.name ?? 'Unknown',
      party: t.attributes.politician?.party ?? 'Unknown',
      ticker: t.attributes.asset?.ticker ?? '',
      company: t.attributes.asset?.name ?? '',
      type: t.attributes.type ?? '',
      amount: t.attributes.amount ?? 'Unknown',
      date: t.attributes.txDate ?? t.attributes.pubDate ?? '',
    }))

    const commentaries = await generateCommentary(forCommentary.slice(0, 30))
    const commentaryMap = new Map(commentaries.map((c) => [c.id, c]))

    let upserted = 0
    for (const trade of validTrades.slice(0, 30)) {
      const a = trade.attributes
      const commentary = commentaryMap.get(trade.id)
      try {
        await prisma.politicianTrade.upsert({
          where: { externalId: trade.id },
          create: {
            externalId: trade.id,
            politicianName: a.politician?.name ?? 'Unknown',
            party: a.politician?.party ?? 'Unknown',
            chamber: a.politician?.chamber ?? 'House',
            ticker: a.asset?.ticker ?? '',
            companyName: a.asset?.name ?? '',
            tradeType: a.type ?? '',
            amountRange: a.amount ?? 'Unknown',
            tradedAt: new Date(a.txDate ?? a.pubDate ?? Date.now()),
            filedAt: new Date(a.pubDate ?? Date.now()),
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

    return NextResponse.json({ ok: true, count: upserted })
  } catch (err) {
    console.error('[cron/politician]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
