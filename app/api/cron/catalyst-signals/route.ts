/**
 * GET /api/cron/catalyst-signals
 *
 * UNVETTED catalyst-only signal generation — per explicit instruction, this
 * pipeline deliberately does NOT apply the liquidity floor
 * (lib/liquidityFloor.ts) that every other signal-generation cron enforces.
 * This is a direct reversal of this feature's original design (see
 * prisma/schema.prisma's Signal.catalystType comment, written when the
 * liquidity floor was "the critical difference" from the separate News
 * Catalyst Alerts feature) — flagged when this route was added, not
 * silently changed.
 *
 * Universe: a broad small/micro/nano-cap screen (screenBand, same function
 * cron/movers-snapshot uses) with NO minMarketCap/dollarVolume floor — thin,
 * illiquid names ARE eligible here, unlike cron/signals' large/small-cap
 * universes.
 *
 * Acceptance is asymmetric from every other signal cron: a candidate is
 * only ever written if Claude's own catalystType comes back non-null.
 * Anything Claude doesn't tie to a real, identifiable event (earnings,
 * contract win, M&A, FDA decision, guidance change) is discarded outright
 * — this route exists to admit thin catalyst movers that the normal floor
 * would reject, not to become a second general-purpose no-floor signal
 * generator.
 *
 * Writes to the SAME Signal table as cron/signals (signalCategory:
 * 'catalyst', catalystType set) — /signals/catalyst-driven's query
 * (catalystType != null) picks these up automatically alongside any
 * floor-gated catalyst signals cron/signals itself produces.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { getQuotesWithFundamentals } from '@/lib/schwab'
import { screenBand } from '@/lib/nasdaqScreener'
import { isValidCatalystType } from '@/lib/catalystType'
import { notifySignalDigest } from '@/lib/notifications'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// Deliberately no market-cap/dollar-volume bound — see file doc comment.
// Capped per sector so the Claude payload stays a reasonable size.
const PER_SECTOR_CAP = 15
const BUCKETS = ['small', 'micro', 'nano'] as const

async function getUnfilteredUniverse(): Promise<string[]> {
  const rows = await screenBand([...BUCKETS], PER_SECTOR_CAP, { min: 0, minInclusive: true, max: Infinity, maxInclusive: true })
  return rows.map((r) => r.ticker)
}

type CatalystCandidate = {
  ticker: string
  companyName: string
  signalType: 'BUY' | 'WATCH' | 'SHORT'
  entryZoneLow: number
  entryZoneHigh: number
  targetPrice: number
  stopLoss: number
  confidence: number
  timeHorizon: string
  timeframeCategory: string
  thesis: string
  aiSummary: string
  sector: string
  catalystType: string | null
  catalystSummary: string | null
}

async function generateCatalystSignals(tickers: string[]): Promise<CatalystCandidate[]> {
  if (tickers.length === 0) return []
  const client = getAnthropicClient()

  const quoteMap = await getQuotesWithFundamentals(tickers)
  const stocksJson = Array.from(quoteMap.entries())
    .filter(([, v]) => v.quote.lastPrice > 0)
    .map(([symbol, v]) => ({
      symbol,
      price: v.quote.lastPrice,
      changePct: v.quote.netPercentChange,
      volume: v.quote.totalVolume,
      avg10DaysVolume: v.fundamental.avg10DaysVolume ?? null,
    }))

  if (stocksJson.length === 0) return []

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: `You are screening a broad, UNFILTERED list of small/micro/nano-cap stocks (no liquidity or market-cap floor has been applied — many of these are thin, illiquid names) for genuine catalyst-driven setups only.

Your ONLY job: identify which of these stocks are moving because of an identifiable, concrete event — an earnings beat/miss, a contract or purchase-order win, an M&A announcement, an FDA decision, or a guidance change — and generate a trading signal ONLY for those. Do NOT generate a signal for a stock just because it's on this list; most should be skipped entirely. Do NOT invent a catalyst that isn't supported by the price/volume data you were given (large day volume relative to avg10DaysVolume, and a large changePct, are your only real signals of a catalyst-driven move here — you have no news feed).

Rules:
- Only include a stock if you have genuine reason to believe an event is driving the move (large changePct + volume well above avg10DaysVolume is the strongest signal available to you)
- Every included signal MUST have a non-null catalystType and a matching catalystSummary
- BUY, WATCH, or SHORT as appropriate
- Reply with a JSON array ONLY — no markdown, no explanation. Empty array is a valid and expected answer if nothing here looks catalyst-driven.

Each object must have exactly these keys:
- ticker (string)
- companyName (string)
- signalType ("BUY", "WATCH", or "SHORT")
- entryZoneLow (number), entryZoneHigh (number), targetPrice (number), stopLoss (number)
- confidence (float 0-100, one decimal)
- timeHorizon (string, e.g. "1-3 days"), timeframeCategory ("days_1_3", "swing", or "long_term")
- thesis (string — "SETUP: [...] | CATALYST: [...] | RISK: [...]")
- aiSummary (string, 1 sentence)
- sector (string)
- catalystType (EXACTLY one of "EARNINGS", "CONTRACT", "MA", "FDA", "GUIDANCE", "OTHER" — never null for an included signal)
- catalystSummary (string — short plain-language description of the real event, e.g. "Q2 earnings beat: gross margin expanded 530bps")

Stock data (UNFILTERED — no liquidity floor applied):
${JSON.stringify(stocksJson, null, 2)}`,
    }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    return JSON.parse(cleaned) as CatalystCandidate[]
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (match) { try { return JSON.parse(match[0]) as CatalystCandidate[] } catch { return [] } }
    return []
  }
}

const MIN_CONFIDENCE = 55

function validate(s: CatalystCandidate): boolean {
  if (!s.ticker || !s.entryZoneLow || !s.entryZoneHigh || !s.targetPrice || !s.stopLoss) return false
  if (s.entryZoneLow <= 0 || s.entryZoneHigh <= 0 || s.targetPrice <= 0 || s.stopLoss <= 0) return false
  if (typeof s.confidence !== 'number' || Number.isNaN(s.confidence) || s.confidence < MIN_CONFIDENCE) return false
  // The whole point of this route: reject anything without a real catalyst tag.
  if (!isValidCatalystType(s.catalystType) || !s.catalystSummary?.trim()) return false
  return true
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const activeSignals = await prisma.signal.findMany({
      where: { isActive: true, session: 'regular' },
      select: { ticker: true },
    })
    const activeTickers = new Set(activeSignals.map((s) => s.ticker))

    const universe = (await getUnfilteredUniverse()).filter((t) => !activeTickers.has(t))
    if (universe.length === 0) {
      await prisma.signalGenerationLog.create({ data: { signalCount: 0, status: 'skipped' } })
      return NextResponse.json({ ok: true, count: 0, universeSize: 0 })
    }

    const raw = await generateCatalystSignals(universe)
    const valid = raw.filter(validate)

    if (valid.length === 0) {
      await prisma.signalGenerationLog.create({ data: { signalCount: 0, status: 'no_signals' } })
      return NextResponse.json({ ok: true, count: 0, universeSize: universe.length, scanned: raw.length })
    }

    await prisma.$transaction([
      ...valid.map((s) =>
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
            // Distinct from 'large_cap'/'small_cap' — these bypassed the
            // liquidity floor entirely, unlike every other signalCategory.
            signalCategory: 'catalyst',
            timeframeCategory: ['days_1_3', 'swing', 'long_term'].includes(s.timeframeCategory) ? s.timeframeCategory : 'swing',
            marketCap: 0, // unknown/unbounded — this pipeline never checked it
            catalystType: s.catalystType,
            catalystSummary: s.catalystSummary,
            isActive: true,
            autoGenerated: true,
          },
        })
      ),
      prisma.signalGenerationLog.create({ data: { signalCount: valid.length, status: 'success' } }),
    ])

    await notifySignalDigest({ createdCount: valid.length, runLabel: 'catalyst scan (unvetted)', freeDigest: false })

    return NextResponse.json({ ok: true, count: valid.length, universeSize: universe.length, scanned: raw.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/catalyst-signals]', msg)
    await prisma.signalGenerationLog.create({ data: { signalCount: 0, status: 'error', error: msg } }).catch(() => {})
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
