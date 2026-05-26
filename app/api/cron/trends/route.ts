import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'

export const maxDuration = 60

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

const SECTOR_ETFS = [
  { sector: 'Technology', symbol: 'QQQ' },
  { sector: 'Energy', symbol: 'XLE' },
  { sector: 'Healthcare', symbol: 'XLV' },
  { sector: 'Finance', symbol: 'XLF' },
  { sector: 'Consumer Staples', symbol: 'XLP' },
  { sector: 'Real Estate', symbol: 'VNQ' },
  { sector: 'Industrials', symbol: 'XLI' },
]

type Quote = { c: number; d: number; dp: number; h: number; l: number; o: number; pc: number }

async function fetchQuote(symbol: string): Promise<Quote | null> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return null
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

async function generateMarketSummary(snapshots: { sector: string; symbol: string; change: number }[]): Promise<string> {
  const client = getAnthropicClient()
  const lines = snapshots.map((s) => `${s.sector} (${s.symbol}): ${s.change > 0 ? '+' : ''}${s.change.toFixed(2)}%`).join('\n')
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `Write a 2-sentence AI market summary based on these ETF performance numbers. Be direct and insightful. No intro phrases like "Today" or "The market":

${lines}`,
      },
    ],
  })
  return message.content[0].type === 'text' ? message.content[0].text.trim() : ''
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const results = await Promise.all(
      SECTOR_ETFS.map(async ({ sector, symbol }) => {
        const q = await fetchQuote(symbol)
        return { sector, symbol, quote: q }
      })
    )

    const snapshots = results.map(({ sector, symbol, quote }) => ({
      sector,
      symbol,
      price: quote?.c ?? 0,
      change: quote?.dp ?? 0,
      changeAmt: quote?.d ?? 0,
      high52w: quote?.h ?? 0,
      low52w: quote?.l ?? 0,
    }))

    await Promise.all(
      snapshots.map((s) =>
        prisma.sectorSnapshot.upsert({
          where: { sector: s.sector },
          create: s,
          update: { price: s.price, change: s.change, changeAmt: s.changeAmt, high52w: s.high52w, low52w: s.low52w },
        })
      )
    )

    const summary = await generateMarketSummary(snapshots)
    if (summary) {
      await prisma.marketSummary.upsert({
        where: { singleton: 'main' },
        create: { singleton: 'main', content: summary },
        update: { content: summary },
      })
    }

    return NextResponse.json({ ok: true, sectors: snapshots.length })
  } catch (err) {
    console.error('[cron/trends]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
