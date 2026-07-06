/**
 * GET /api/cron/politician-backfill   (TEMPORARY — delete after running)
 *
 * One-time 90-day backfill of the PoliticianTrade table plus before/after
 * diagnostics. Ingests every trade in data/all_trades.json within the window
 * without AI commentary (fast); the daily cron fills commentary/significance
 * for the freshest trades over subsequent runs.
 *
 * Auth: static header token (x-backfill-token), since the encrypted CRON_SECRET
 * isn't available locally.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const maxDuration = 300

const WINDOW_DAYS = 90
const DATA_URL =
  'https://raw.githubusercontent.com/Holoture/holoture-app/master/data/all_trades.json'

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

function normParty(raw: string): string {
  const l = (raw ?? '').toLowerCase()
  if (l.includes('democrat') || l === 'd') return 'Democrat'
  if (l.includes('republican') || l === 'r') return 'Republican'
  if (l.includes('independent') || l === 'i') return 'Independent'
  return raw || 'Unknown'
}
function normChamber(raw: string): string {
  return (raw ?? '').toLowerCase().includes('senate') ? 'Senate' : 'House'
}
function normTradeType(raw: string): string {
  const l = (raw ?? '').toLowerCase()
  if (l === 'buy' || l.includes('purchase')) return 'BUY'
  if (l === 'sell' || l.includes('sale')) return 'SELL'
  return (raw ?? 'UNKNOWN').toUpperCase()
}
function safeDate(raw: string): Date {
  if (!raw) return new Date()
  const d = new Date(raw)
  return isNaN(d.getTime()) ? new Date() : d
}

async function stats() {
  const total = await prisma.politicianTrade.count()
  const distinct = (await prisma.politicianTrade.findMany({
    distinct: ['politicianName'],
    select: { politicianName: true },
  })).length
  const oldest = await prisma.politicianTrade.findFirst({ orderBy: { tradedAt: 'asc' }, select: { tradedAt: true } })
  const newest = await prisma.politicianTrade.findFirst({ orderBy: { tradedAt: 'desc' }, select: { tradedAt: true } })
  return {
    totalTrades: total,
    distinctPoliticians: distinct,
    dateRange: {
      earliest: oldest?.tradedAt?.toISOString().slice(0, 10) ?? null,
      latest: newest?.tradedAt?.toISOString().slice(0, 10) ?? null,
    },
  }
}

export async function GET(req: Request) {
  if (req.headers.get('x-backfill-token') !== 'ht-politician-backfill-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const before = await stats()

    const res = await fetch(DATA_URL, { cache: 'no-store' })
    if (!res.ok) return NextResponse.json({ error: `data fetch HTTP ${res.status}`, before }, { status: 502 })
    const data = JSON.parse(await res.text()) as RawTrade[]
    if (!Array.isArray(data)) return NextResponse.json({ error: 'data not an array', before }, { status: 502 })

    const today = new Date().toISOString().slice(0, 10)
    const cutoff = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString().slice(0, 10)
    const valid = data.filter(
      (t) =>
        t.politician_name && t.ticker && t.trade_type && t.traded_at &&
        t.traded_at <= today &&
        ((t.filed_at && t.filed_at >= cutoff) || t.traded_at >= cutoff)
    )

    let upserted = 0
    const CHUNK = 25
    for (let i = 0; i < valid.length; i += CHUNK) {
      await Promise.all(
        valid.slice(i, i + CHUNK).map(async (trade) => {
          const externalId = `${trade.politician_name}|${trade.ticker}|${trade.traded_at}|${trade.trade_type}`
            .toLowerCase().replace(/[^a-z0-9|]/g, '-')
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
                aiCommentary: '',
                significance: 'Low',
              },
              update: { fetchedAt: new Date() },
            })
            upserted++
          } catch { /* skip constraint errors */ }
        })
      )
    }

    const after = await stats()
    return NextResponse.json({
      ok: true,
      dataFileRecords: data.length,
      inWindow: valid.length,
      upserted,
      before,
      after,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
