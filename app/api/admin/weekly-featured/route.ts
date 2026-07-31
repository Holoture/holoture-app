/**
 * GET/POST /api/admin/weekly-featured
 *
 * Lets the admin manually pick which closed signal the landing page's
 * "Recent Result" card shows, instead of waiting for the weekly cron
 * (cron/weekly-featured) to re-run. The gain is never hand-typed — POST
 * recomputes it the exact same way the cron does (lib/weeklyFeatured.ts:
 * peak price since posting, gated by the same entry-price trustworthiness
 * guard) so a manual pick can't bypass the data-integrity checks that were
 * added after GS/SLB/CRWD turned out to have stale entry zones.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDailyCandles } from '@/lib/schwab'
import { PUBLIC_TRACK_RECORD_FILTER } from '@/lib/publicStats'
import { peakGainPercent, isEntryPriceTrustworthy, weekStartET } from '@/lib/weeklyFeatured'
import { requireAdmin, logAdminAction } from '@/lib/adminAuth'
import { checkRateLimit, tooManyRequests, ADMIN_LIMIT, ADMIN_WINDOW_MS } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [candidates, current] = await Promise.all([
    prisma.signal.findMany({
      where: { outcome: 'HIT_TARGET', ...PUBLIC_TRACK_RECORD_FILTER },
      select: { id: true, ticker: true, companyName: true, signalType: true, signalDate: true },
      orderBy: { signalDate: 'desc' },
    }),
    prisma.weeklyFeaturedSignal.findFirst({ orderBy: { weekStartDate: 'desc' } }),
  ])

  return NextResponse.json({
    candidates: candidates.map((c) => ({
      id: c.id, ticker: c.ticker, companyName: c.companyName,
      signalType: c.signalType, signalDate: c.signalDate.toISOString(),
    })),
    currentSignalId: current?.signalId ?? null,
    currentGainPercent: current?.realizedGainPercent ?? null,
  })
}

export async function POST(req: Request) {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = checkRateLimit(`admin-weekly-featured:${adminId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  let body: { signalId?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const signalId = String(body.signalId ?? '')
  if (!signalId) return NextResponse.json({ error: 'signalId is required' }, { status: 400 })

  const signal = await prisma.signal.findUnique({ where: { id: signalId } })
  if (!signal) return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
  if (signal.outcome !== 'HIT_TARGET' || signal.isManual) {
    return NextResponse.json({ error: 'Only closed, non-manual (HIT_TARGET) signals can be featured' }, { status: 400 })
  }

  const allCandles = await getDailyCandles(signal.ticker)
  const sincePosting = allCandles.filter((c) => c.datetime >= signal.signalDate.getTime())
  if (sincePosting.length === 0) {
    return NextResponse.json({ error: 'No candle data since this signal was posted' }, { status: 422 })
  }

  const entryPrice = (signal.entryZoneLow + signal.entryZoneHigh) / 2
  if (!isEntryPriceTrustworthy(entryPrice, sincePosting[0])) {
    const ref = (sincePosting[0].high + sincePosting[0].low) / 2
    return NextResponse.json({
      error: `Entry zone (${entryPrice.toFixed(2)}) doesn't match real price at posting (~${ref.toFixed(2)}) — likely stale data, refusing to feature`,
    }, { status: 422 })
  }

  const gain = peakGainPercent({ signalType: signal.signalType, entryPrice, candlesSincePosting: sincePosting })
  if (gain === null) {
    return NextResponse.json({ error: 'Could not compute a publishable gain for this signal' }, { status: 422 })
  }

  const weekStartDate = weekStartET(new Date())
  await prisma.weeklyFeaturedSignal.upsert({
    where: { weekStartDate },
    create: { signalId: signal.id, weekStartDate, realizedGainPercent: gain },
    update: { signalId: signal.id, realizedGainPercent: gain, selectedAt: new Date() },
  })

  await logAdminAction({
    adminId, action: 'featured.select',
    target: signal.ticker,
    detail: `manually featured ${signal.ticker} at +${gain.toFixed(2)}% peak gain`,
  })

  return NextResponse.json({ ok: true, ticker: signal.ticker, gainPercent: Math.round(gain * 100) / 100 })
}
