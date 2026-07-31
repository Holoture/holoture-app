/**
 * GET/POST /api/admin/weekly-featured
 *
 * Lets the admin hand-enter every field of the landing page's "Recent
 * Result" card (ticker, company name, entry zone, target, % gain, posted
 * date, summary) instead of waiting for the weekly cron. A manual entry
 * sets isManualOverride, which cron/weekly-featured checks so it won't
 * clobber a hand-entered card on its next weekly run.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { weekStartET } from '@/lib/weeklyFeatured'
import { requireAdmin, logAdminAction } from '@/lib/adminAuth'
import { checkRateLimit, tooManyRequests, ADMIN_LIMIT, ADMIN_WINDOW_MS } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET() {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const current = await prisma.weeklyFeaturedSignal.findFirst({ orderBy: { weekStartDate: 'desc' } })
  if (!current) return NextResponse.json({ current: null })

  return NextResponse.json({
    current: {
      ticker: current.ticker,
      companyName: current.companyName,
      signalType: current.signalType,
      entryZoneLow: current.entryZoneLow,
      entryZoneHigh: current.entryZoneHigh,
      targetPrice: current.targetPrice,
      gainPercent: current.realizedGainPercent,
      postedAt: current.postedAt.toISOString().slice(0, 10),
      thesis: current.thesis,
      isManualOverride: current.isManualOverride,
    },
  })
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

export async function POST(req: Request) {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = checkRateLimit(`admin-weekly-featured:${adminId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const ticker = String(body.ticker ?? '').trim().toUpperCase()
  const companyName = String(body.companyName ?? '').trim()
  const signalType = String(body.signalType ?? '').trim().toUpperCase()
  const thesis = String(body.thesis ?? '').trim()
  const postedAtRaw = String(body.postedAt ?? '').trim()

  const entryZoneLow = num(body.entryZoneLow)
  const entryZoneHigh = num(body.entryZoneHigh)
  const targetPrice = num(body.targetPrice)
  const gainPercent = num(body.gainPercent)

  if (!ticker) return NextResponse.json({ error: 'Ticker is required' }, { status: 400 })
  if (!companyName) return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
  if (!['BUY', 'WATCH', 'SHORT', 'SELL'].includes(signalType)) {
    return NextResponse.json({ error: 'Signal type must be BUY, WATCH, SHORT, or SELL' }, { status: 400 })
  }
  if (!thesis) return NextResponse.json({ error: 'Summary is required' }, { status: 400 })
  if (entryZoneLow === null || entryZoneHigh === null) return NextResponse.json({ error: 'Entry zone low/high must be numbers' }, { status: 400 })
  if (targetPrice === null) return NextResponse.json({ error: 'Target price must be a number' }, { status: 400 })
  if (gainPercent === null) return NextResponse.json({ error: '% gain must be a number' }, { status: 400 })

  const postedAt = new Date(postedAtRaw)
  if (!postedAtRaw || Number.isNaN(postedAt.getTime())) {
    return NextResponse.json({ error: 'Posted date is required and must be a valid date' }, { status: 400 })
  }

  const weekStartDate = weekStartET(new Date())
  await prisma.weeklyFeaturedSignal.upsert({
    where: { weekStartDate },
    create: {
      signalId: null, ticker, companyName, signalType,
      entryZoneLow, entryZoneHigh, targetPrice, realizedGainPercent: gainPercent,
      thesis, postedAt, isManualOverride: true, weekStartDate,
    },
    update: {
      signalId: null, ticker, companyName, signalType,
      entryZoneLow, entryZoneHigh, targetPrice, realizedGainPercent: gainPercent,
      thesis, postedAt, isManualOverride: true, selectedAt: new Date(),
    },
  })

  await logAdminAction({
    adminId, action: 'featured.select',
    target: ticker,
    detail: `manually set Recent Result card: ${ticker} at +${gainPercent}%`,
  })

  return NextResponse.json({ ok: true, ticker, gainPercent })
}
