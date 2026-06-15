import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

function isIntraday(h: string): boolean {
  return /intraday|hour/i.test(h)
}
function is1to3Days(h: string): boolean {
  return /1[-–]3\s*day/i.test(h)
}
function isSwingTrade(h: string): boolean {
  return h.toLowerCase().includes('week')
}
function isLongTerm(h: string): boolean {
  const lower = h.toLowerCase()
  if (lower.includes('year')) return true
  if (lower.includes('month')) {
    const m = lower.match(/(\d+)/)
    return m != null && parseInt(m[1]) >= 3
  }
  return false
}
function isMomentum(confidence: number, signalType: string): boolean {
  return signalType === 'BUY' && confidence >= 75
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const signals = await prisma.signal.findMany({
    select: {
      ticker: true,
      signalType: true,
      confidence: true,
      signalCategory: true,
      timeHorizon: true,
      signalDate: true,
      outcome: true,
      entryZoneLow: true,
      entryZoneHigh: true,
      targetPrice: true,
    },
  })

  const optionsSignals = await prisma.optionsSignal.findMany({
    select: { confidence: true, ticker: true, createdAt: true },
  })

  // ── 1. Average confidence ──────────────────────────────────────────────
  const avgConfidenceAll = signals.length
    ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
    : 0
  const avgConfidenceOptions = optionsSignals.length
    ? optionsSignals.reduce((sum, s) => sum + s.confidence, 0) / optionsSignals.length
    : 0

  // ── 2. Average signals per day ─────────────────────────────────────────
  const dayKey = (d: Date) => d.toISOString().slice(0, 10)
  const distinctDates = new Set(signals.map((s) => dayKey(s.signalDate)))
  const distinctDateCount = distinctDates.size

  const byCategory: Record<string, { count: number; perDay: number }> = {}
  const categorize = (s: typeof signals[number]): string[] => {
    const cats: string[] = []
    const h = String(s.timeHorizon)
    if (isIntraday(h)) cats.push('Intraday')
    if (is1to3Days(h)) cats.push('1-3 Days')
    if (isSwingTrade(h)) cats.push('Swing')
    if (isLongTerm(h)) cats.push('Long Term')
    if (isMomentum(s.confidence, s.signalType)) cats.push('Momentum')
    if (s.signalCategory === 'large_cap') cats.push('Large Cap')
    if (s.signalCategory === 'small_cap') cats.push('Small Cap')
    return cats
  }
  for (const s of signals) {
    for (const cat of categorize(s)) {
      byCategory[cat] = byCategory[cat] ?? { count: 0, perDay: 0 }
      byCategory[cat].count++
    }
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].perDay = distinctDateCount ? byCategory[cat].count / distinctDateCount : 0
  }

  const optionsDistinctDates = new Set(optionsSignals.map((s) => dayKey(s.createdAt)))
  byCategory['Options'] = {
    count: optionsSignals.length,
    perDay: optionsDistinctDates.size ? optionsSignals.length / optionsDistinctDates.size : 0,
  }

  // ── 3. Signal outcomes / gains ───────────────────────────────────────────
  const hitTarget = signals.filter((s) => s.outcome === 'HIT_TARGET')
  const hitStop = signals.filter((s) => s.outcome === 'HIT_STOP')
  const expired = signals.filter((s) => s.outcome === 'EXPIRED')
  const pending = signals.filter((s) => s.outcome === null)
  const tracked = signals.filter((s) => s.outcome !== null)

  const gains = hitTarget.map((s) => {
    const entryMid = (s.entryZoneLow + s.entryZoneHigh) / 2
    const isShort = s.signalType === 'SELL' || s.signalType === 'SHORT'
    const pct = isShort
      ? ((entryMid - s.targetPrice) / entryMid) * 100
      : ((s.targetPrice - entryMid) / entryMid) * 100
    return pct
  })
  const avgGainPct = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : null

  // ── 4. Politicians tracked ────────────────────────────────────────────────
  const politicianTrades = await prisma.politicianTrade.findMany({
    select: { politicianName: true, ticker: true },
  })
  const distinctPoliticians = new Set(politicianTrades.map((t) => t.politicianName)).size
  const distinctPoliticianTickers = new Set(politicianTrades.map((t) => t.ticker)).size

  // ── 5. Stocks monitored ──────────────────────────────────────────────────
  const distinctSignalTickers = new Set(signals.map((s) => s.ticker)).size
  const insiderTickers = await prisma.insiderTrade.findMany({ select: { ticker: true } })
  const distinctInsiderTickers = new Set(insiderTickers.map((t) => t.ticker)).size

  return NextResponse.json({
    confidence: {
      avgAll: Number(avgConfidenceAll.toFixed(1)),
      avgStockSignals: Number(avgConfidenceAll.toFixed(1)),
      avgOptionsSignals: Number(avgConfidenceOptions.toFixed(1)),
      totalSignals: signals.length,
      totalOptionsSignals: optionsSignals.length,
    },
    signalsPerDay: {
      totalSignals: signals.length,
      distinctDates: distinctDateCount,
      avgPerDay: distinctDateCount ? Number((signals.length / distinctDateCount).toFixed(1)) : 0,
      byCategory: Object.fromEntries(
        Object.entries(byCategory).map(([k, v]) => [k, { count: v.count, avgPerDay: Number(v.perDay.toFixed(1)) }])
      ),
    },
    outcomes: {
      totalTracked: tracked.length,
      totalSignalsAllTime: signals.length,
      hitTarget: hitTarget.length,
      hitStop: hitStop.length,
      expired: expired.length,
      pending: pending.length,
      avgGainPctOnHitTarget: avgGainPct !== null ? Number(avgGainPct.toFixed(1)) : null,
    },
    politicians: {
      distinctPoliticians,
      distinctTickersTraded: distinctPoliticianTickers,
      totalTrades: politicianTrades.length,
    },
    stocksMonitored: {
      distinctSignalTickers,
      distinctInsiderTickers,
    },
  })
}
