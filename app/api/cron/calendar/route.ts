import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'

export const maxDuration = 60

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

type EarningsEntry = {
  date: string
  epsActual: number | null
  epsEstimate: number | null
  hour: string
  quarter: number | null
  symbol: string
  year: number | null
}

type EarningsResponse = { earningsCalendar: EarningsEntry[] }

async function fetchEarnings(): Promise<EarningsEntry[]> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return []
  const today = new Date()
  const future = new Date(today)
  future.setDate(today.getDate() + 30)
  const from = today.toISOString().split('T')[0]
  const to = future.toISOString().split('T')[0]
  try {
    const res = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${key}`, { cache: 'no-store' })
    if (!res.ok) return []
    const data: EarningsResponse = await res.json()
    return data.earningsCalendar ?? []
  } catch { return [] }
}

async function rateImpacts(entries: EarningsEntry[]): Promise<Map<string, string>> {
  const client = getAnthropicClient()
  const symbols = entries.map((e) => e.symbol)
  const unique = [...new Set(symbols)]
  const list = unique.join(', ')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Rate the market impact (High, Medium, or Low) of these earnings reports based on company size and market influence. Reply with JSON only, no markdown.
Format: {"AAPL":"High","XYZ":"Low",...}

Symbols: ${list}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  try {
    const parsed: Record<string, string> = JSON.parse(text)
    return new Map(Object.entries(parsed))
  } catch {
    return new Map()
  }
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const entries = await fetchEarnings()
    const top = entries.slice(0, 60)
    if (top.length === 0) return NextResponse.json({ ok: true, count: 0 })

    const impactMap = await rateImpacts(top)

    await Promise.all(
      top.map((e) => {
        const impact = impactMap.get(e.symbol) ?? 'Low'
        return prisma.calendarEntry.upsert({
          where: { symbol_date: { symbol: e.symbol, date: e.date } },
          create: {
            symbol: e.symbol,
            date: e.date,
            hour: e.hour ?? '',
            epsEstimate: e.epsEstimate ?? null,
            epsActual: e.epsActual ?? null,
            quarter: e.quarter ?? null,
            year: e.year ?? null,
            impactRating: impact,
          },
          update: {
            impactRating: impact,
            fetchedAt: new Date(),
          },
        })
      })
    )

    return NextResponse.json({ ok: true, count: top.length })
  } catch (err) {
    console.error('[cron/calendar]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
