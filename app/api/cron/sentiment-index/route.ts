/**
 * GET /api/cron/sentiment-index
 *
 * Computes and stores today's Holoture Market Sentiment Index (see
 * lib/sentimentIndex.ts for the full formula/component breakdown). Runs
 * once daily, before the market open, ahead of the daily signals cron —
 * this is a heavier job than most crons (breadth requires a candle fetch
 * per TickerUniverse ticker, ~230-350 of them), so it's scheduled off
 * market hours rather than piggybacking on an existing cron.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeSentimentIndex, todayUtcMidnight } from '@/lib/sentimentIndex'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await computeSentimentIndex()
    const date = todayUtcMidnight()

    const row = await prisma.marketSentimentIndex.upsert({
      where: { date },
      create: { date, score: result.score, label: result.label, componentBreakdown: result.breakdown },
      update: { score: result.score, label: result.label, componentBreakdown: result.breakdown },
    })

    return NextResponse.json({ ok: true, date: row.date, score: row.score, label: row.label, breakdown: result.breakdown })
  } catch (err) {
    console.error('[cron/sentiment-index]', err)
    return NextResponse.json({ ok: false, error: 'Failed to compute sentiment index' }, { status: 500 })
  }
}
