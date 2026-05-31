/**
 * POST /api/admin/render-video
 *
 * Triggers a Remotion server-side render for the requested template.
 * Fetches live data from the database and passes it as inputProps.
 *
 * ── LOCAL DEVELOPMENT ───────────────────────────────────────────────────────
 * Works fully when Chrome is available (standard macOS/Linux/Windows desktop).
 * Output is written to /public/generated-videos/.
 *
 * ── VERCEL PRODUCTION ────────────────────────────────────────────────────────
 * Vercel serverless functions do NOT bundle Chrome or FFmpeg, so renderMedia()
 * will throw "No usable Chrome browser could be found on your system".
 * For cloud rendering, set up @remotion/lambda (AWS) — see:
 *   https://www.remotion.dev/docs/lambda
 * The UI surfaces this limitation clearly when running on Vercel.
 *
 * ── SECURITY ─────────────────────────────────────────────────────────────────
 * Admin auth required. Rate limited 20/min per admin.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, tooManyRequests, ADMIN_LIMIT, ADMIN_WINDOW_MS } from '@/lib/rate-limit'
import path from 'path'
import fs from 'fs'

export const maxDuration = 120

type TemplateId = 'SignalReel' | 'PoliticianReel' | 'WeeklyRecap' | 'SectorTrends'

// Duration (frames) per template at 30fps
const DURATIONS: Record<TemplateId, number> = {
  SignalReel:    900,
  PoliticianReel: 900,
  WeeklyRecap:  1350,
  SectorTrends:  600,
}

/** Fetch live data from DB and build inputProps for the requested template */
async function buildInputProps(templateId: TemplateId): Promise<Record<string, unknown>> {
  switch (templateId) {

    case 'SignalReel': {
      const signal = await prisma.signal.findFirst({
        where: { isActive: true, signalType: { in: ['BUY', 'SHORT', 'WATCH'] } },
        orderBy: [{ confidence: 'desc' }, { signalDate: 'desc' }],
      })
      if (!signal) throw new Error('No active signals found')

      // Attempt to fetch 30-day price history from Finnhub
      let priceHistory: number[] = []
      try {
        const to   = Math.floor(Date.now() / 1000)
        const from = to - 30 * 24 * 60 * 60
        const url  = `https://finnhub.io/api/v1/stock/candle?symbol=${signal.ticker}&resolution=D&from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`
        const res  = await fetch(url)
        const data = await res.json()
        if (data.s === 'ok' && Array.isArray(data.c)) {
          priceHistory = data.c.slice(-30)
        }
      } catch { /* fall back to synthetic data */ }

      if (priceHistory.length < 2) {
        // Synthetic fallback so the composition still renders
        const base = signal.entryZoneLow ?? 100
        priceHistory = Array.from({ length: 30 }, (_, i) =>
          base * (1 + (Math.random() - 0.48) * 0.03 + i * 0.001)
        )
      }

      return {
        ticker:       signal.ticker,
        signalType:   signal.signalType,
        confidence:   signal.confidence,
        entryZoneLow:  signal.entryZoneLow,
        entryZoneHigh: signal.entryZoneHigh,
        targetPrice:   signal.targetPrice,
        stopLoss:      signal.stopLoss,
        companyName:   signal.companyName,
        priceHistory,
      }
    }

    case 'PoliticianReel': {
      const trade = await prisma.politicianTrade.findFirst({
        orderBy: { tradedAt: 'desc' },
      })
      if (!trade) throw new Error('No politician trades found')
      return {
        politicianName:  trade.politicianName,
        party:           trade.party ?? 'Independent',
        ticker:          trade.ticker,
        companyName:     trade.companyName ?? trade.ticker,
        tradeType:       trade.tradeType,
        amountRange:     trade.amountRange ?? 'Undisclosed',
        transactionDate: trade.tradedAt.toISOString(),
        aiCommentary:    trade.aiCommentary || 'This trade was recently filed with the House or Senate disclosure office.',
      }
    }

    case 'WeeklyRecap': {
      const since   = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const signals = await prisma.signal.findMany({
        where: { isActive: true, signalDate: { gte: since } },
        orderBy: { confidence: 'desc' },
        take: 5,
      })
      if (signals.length === 0) throw new Error('No signals from the past 7 days')
      const now = new Date()
      const weekLabel = `Week of ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
      return {
        weekLabel,
        signals: signals.map(s => ({
          ticker:     s.ticker,
          signalType: s.signalType,
          companyName: s.companyName,
          confidence: s.confidence,
        })),
      }
    }

    case 'SectorTrends': {
      const snapshots = await prisma.sectorSnapshot.findMany({ orderBy: { change: 'desc' } })
      const summary   = await prisma.marketSummary.findFirst({ orderBy: { updatedAt: 'desc' } }).catch(() => null)
      if (snapshots.length === 0) throw new Error('No sector data found')
      return {
        sectors:       snapshots.map(s => ({ sector: s.sector, change: s.change })),
        marketSummary: summary?.content ?? '',
      }
    }
  }
}

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const rl = checkRateLimit(`render-video:${userId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  let body: { templateId?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const templateId = body.templateId as TemplateId
  const validTemplates: TemplateId[] = ['SignalReel', 'PoliticianReel', 'WeeklyRecap', 'SectorTrends']
  if (!validTemplates.includes(templateId)) {
    return NextResponse.json({ error: 'Invalid templateId' }, { status: 400 })
  }

  // ── Fetch live data ─────────────────────────────────────────────────────────
  let inputProps: Record<string, unknown>
  try {
    inputProps = await buildInputProps(templateId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch data'
    return NextResponse.json({ error: msg }, { status: 422 })
  }

  // ── Ensure output directory exists ──────────────────────────────────────────
  const outputDir = path.join(process.cwd(), 'public', 'generated-videos')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename  = `${templateId}-${timestamp}.mp4`
  const outputPath = path.join(outputDir, filename)

  // ── Render with @remotion/renderer (requires local Chrome + FFmpeg) ──────────
  try {
    const { bundle }       = await import('@remotion/bundler')
    const { renderMedia, selectComposition } = await import('@remotion/renderer')

    const entryPoint = path.join(process.cwd(), 'remotion', 'index.ts')
    const bundleLocation = await bundle({ entryPoint })

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: templateId,
      inputProps,
    })

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps,
    })

    return NextResponse.json({
      ok: true,
      filename,
      url: `/generated-videos/${filename}`,
      templateId,
      renderedAt: new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)

    // Detect the "no Chrome" error that will always occur on Vercel
    const isNoBrowser = msg.toLowerCase().includes('chrome') || msg.toLowerCase().includes('browser')
    if (isNoBrowser) {
      return NextResponse.json({
        error: 'RENDER_NOT_AVAILABLE',
        detail: 'Remotion rendering requires Chrome + FFmpeg, which are not available in Vercel serverless functions. See setup instructions below.',
        inputProps, // Return the props so local render is possible
      }, { status: 503 })
    }

    console.error('[render-video] render failed')
    return NextResponse.json({ error: 'Render failed. Check server logs.' }, { status: 500 })
  }
}

/** GET — list previously generated videos */
export async function GET(_req: NextRequest) {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const outputDir = path.join(process.cwd(), 'public', 'generated-videos')

  if (!fs.existsSync(outputDir)) {
    return NextResponse.json({ videos: [] })
  }

  const files = fs
    .readdirSync(outputDir)
    .filter(f => f.endsWith('.mp4'))
    .map(f => {
      const stat = fs.statSync(path.join(outputDir, f))
      return {
        filename: f,
        url: `/generated-videos/${f}`,
        size: stat.size,
        createdAt: stat.birthtime.toISOString(),
      }
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)

  return NextResponse.json({ videos: files })
}
